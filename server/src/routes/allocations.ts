import { Router } from 'express';
import { z } from 'zod';
import { supabase, unwrap, unwrapMaybe } from '../lib/supabase';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors';
import { logActivity } from '../services/activity';
import { notify } from '../services/notify';

const router = Router();
router.use(authenticate);

// Embedded select mirroring the old Prisma `include`. Named FK constraints
// disambiguate the two User relations (holder vs allocatedBy).
const allocationSelect =
  '*, ' +
  'asset:Asset!Allocation_assetId_fkey(id,assetTag,name,status), ' +
  'holder:User!Allocation_holderId_fkey(id,name,email,departmentId), ' +
  'allocatedBy:User!Allocation_allocatedById_fkey(id,name)';

// List allocations. Employees see their own; managers/admin see everything;
// department heads see their department's allocations.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, overdue, holderId } = req.query as Record<string, string>;
    const user = req.user!;

    // holder is joined as inner so we can filter parents by holder.departmentId.
    let q = supabase
      .from('Allocation')
      .select(
        '*, ' +
          'asset:Asset!Allocation_assetId_fkey(id,assetTag,name,status), ' +
          'holder:User!Allocation_holderId_fkey!inner(id,name,email,departmentId), ' +
          'allocatedBy:User!Allocation_allocatedById_fkey(id,name)'
      );

    if (overdue === 'true') {
      q = q.eq('status', 'ACTIVE').lt('expectedReturnDate', new Date().toISOString());
    } else if (status) {
      q = q.eq('status', status);
    }

    // Determine the effective holder filter (EMPLOYEE is always scoped to self).
    let holderIdFilter = holderId;
    if (user.role === 'EMPLOYEE') holderIdFilter = user.id;
    if (holderIdFilter) q = q.eq('holderId', holderIdFilter);

    if (user.role === 'DEPARTMENT_HEAD') {
      if (user.departmentId) q = q.eq('holder.departmentId', user.departmentId);
      else if (!holderIdFilter) q = q.eq('holderId', user.id);
    }

    const allocations = unwrap(await q.order('allocatedAt', { ascending: false }));
    const now = Date.now();
    res.json(
      (allocations as any[]).map((a) => ({
        ...a,
        isOverdue:
          a.status === 'ACTIVE' &&
          !!a.expectedReturnDate &&
          new Date(a.expectedReturnDate).getTime() < now,
      }))
    );
  })
);

const allocateSchema = z.object({
  assetId: z.string().min(1),
  holderId: z.string().min(1),
  expectedReturnDate: z.coerce.date().nullable().optional(),
  note: z.string().optional(),
});

// Allocate an asset. Blocks double-allocation and suggests a transfer instead.
router.post(
  '/',
  requireRole('ADMIN', 'ASSET_MANAGER'),
  asyncHandler(async (req, res) => {
    const data = allocateSchema.parse(req.body);
    const asset = unwrapMaybe<any>(
      await supabase
        .from('Asset')
        .select(
          '*, allocations:Allocation!Allocation_assetId_fkey(status, holder:User!Allocation_holderId_fkey(id,name,email))'
        )
        .eq('id', data.assetId)
        .single()
    );
    if (!asset) throw notFound('Asset not found');

    const activeAllocation = (asset.allocations ?? []).find((al: any) => al.status === 'ACTIVE');
    if (activeAllocation) {
      throw conflict(
        `This asset is currently held by ${activeAllocation.holder.name}. Raise a transfer request to reassign it.`
      );
    }
    if (['UNDER_MAINTENANCE', 'LOST', 'RETIRED', 'DISPOSED'].includes(asset.status)) {
      throw badRequest(`This asset is ${asset.status.replace('_', ' ').toLowerCase()} and cannot be allocated.`);
    }

    const holder = unwrapMaybe<any>(
      await supabase.from('User').select('id, name').eq('id', data.holderId).single()
    );
    if (!holder) throw badRequest('Selected employee does not exist');

    // (was prisma.$transaction) create allocation, then flip asset status.
    const allocation = unwrap(
      await supabase
        .from('Allocation')
        .insert({
          assetId: data.assetId,
          holderId: data.holderId,
          allocatedById: req.user!.id,
          expectedReturnDate: data.expectedReturnDate ? data.expectedReturnDate.toISOString() : null,
          checkInNotes: data.note ?? null,
          status: 'ACTIVE',
        })
        .select(allocationSelect)
        .single()
    );
    const assetUpdate = await supabase.from('Asset').update({ status: 'ALLOCATED' }).eq('id', data.assetId);
    if (assetUpdate.error) throw assetUpdate.error;

    await logActivity(req.user!, {
      action: 'Allocated asset',
      entityType: 'Asset',
      entityId: asset.id,
      details: `${asset.assetTag} → ${holder.name}`,
    });
    await notify({
      userId: holder.id,
      type: 'ASSET_ASSIGNED',
      title: 'Asset assigned to you',
      message: `${asset.assetTag} — ${asset.name} has been allocated to you.`,
      link: '/allocations',
    });

    res.status(201).json(allocation);
  })
);

const returnSchema = z.object({
  returnCondition: z.enum(['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED']).optional(),
  checkInNotes: z.string().optional(),
});

// Return an allocated asset (manager/admin/dept-head, or the holder themselves).
router.post(
  '/:id/return',
  asyncHandler(async (req, res) => {
    const data = returnSchema.parse(req.body);
    const allocation = unwrapMaybe<any>(
      await supabase
        .from('Allocation')
        .select(
          '*, asset:Asset!Allocation_assetId_fkey(*), holder:User!Allocation_holderId_fkey(*)'
        )
        .eq('id', req.params.id)
        .single()
    );
    if (!allocation) throw notFound('Allocation not found');
    if (allocation.status === 'RETURNED') throw badRequest('This allocation has already been returned');

    const user = req.user!;
    const canReturn =
      user.role === 'ADMIN' ||
      user.role === 'ASSET_MANAGER' ||
      user.id === allocation.holderId ||
      (user.role === 'DEPARTMENT_HEAD' && user.departmentId === allocation.holder.departmentId);
    if (!canReturn) throw forbidden('You cannot process this return');

    // (was prisma.$transaction) close the allocation, then free the asset.
    const allocUpdate = await supabase
      .from('Allocation')
      .update({
        status: 'RETURNED',
        returnedAt: new Date().toISOString(),
        returnCondition: data.returnCondition ?? allocation.asset.condition,
        checkInNotes: data.checkInNotes ?? allocation.checkInNotes,
      })
      .eq('id', allocation.id);
    if (allocUpdate.error) throw allocUpdate.error;

    const assetUpdate = await supabase
      .from('Asset')
      .update({
        status: 'AVAILABLE',
        ...(data.returnCondition ? { condition: data.returnCondition } : {}),
      })
      .eq('id', allocation.assetId);
    if (assetUpdate.error) throw assetUpdate.error;

    await logActivity(user, {
      action: 'Returned asset',
      entityType: 'Asset',
      entityId: allocation.assetId,
      details: `${allocation.asset.assetTag} returned by ${allocation.holder.name}`,
    });
    res.json({ message: 'Asset returned', assetId: allocation.assetId });
  })
);

export default router;
