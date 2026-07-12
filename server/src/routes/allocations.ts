import { Router } from 'express';
import { z } from 'zod';
import { supabase, unwrap, unwrapMaybe } from '../lib/supabase';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors';
import { logActivity } from '../services/activity';
import { notify } from '../services/notify';
import { checkOverdueAllocations } from '../services/overdue';

const router = Router();
router.use(authenticate);

// Embedded select mirroring the old Prisma `include`. Named FK constraints
// disambiguate the two User relations (holder vs allocatedBy). The holder is
// EITHER a user (holder) or a whole department (holderDepartment).
const allocationSelect =
  '*, ' +
  'asset:Asset!Allocation_assetId_fkey(id,assetTag,name,status), ' +
  'holder:User!Allocation_holderId_fkey(id,name,email,departmentId), ' +
  'holderDepartment:Department!Allocation_holderDepartmentId_fkey(id,name,code), ' +
  'allocatedBy:User!Allocation_allocatedById_fkey(id,name)';

/** Display name for whoever holds an allocation (person or department). */
function holderName(a: any): string {
  return a.holder?.name ?? (a.holderDepartment ? `${a.holderDepartment.name} (department)` : 'Unknown');
}

// List allocations. Employees see their own; managers/admin see everything;
// department heads see their department's allocations (including assets
// allocated to the department itself).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, overdue, holderId } = req.query as Record<string, string>;
    const user = req.user!;

    let q = supabase.from('Allocation').select(allocationSelect);

    if (overdue === 'true') {
      q = q.eq('status', 'ACTIVE').lt('expectedReturnDate', new Date().toISOString());
    } else if (status) {
      q = q.eq('status', status);
    }

    // Determine the effective holder filter (EMPLOYEE is always scoped to self).
    let holderIdFilter = holderId;
    if (user.role === 'EMPLOYEE') holderIdFilter = user.id;
    if (holderIdFilter) q = q.eq('holderId', holderIdFilter);

    let allocations = unwrap(await q.order('allocatedAt', { ascending: false })) as any[];

    // Department heads: their members' allocations + allocations made to the
    // department itself. (Filtered in JS: a parent-level OR across an embedded
    // column and an own column isn't expressible in one PostgREST filter.)
    if (user.role === 'DEPARTMENT_HEAD' && !holderIdFilter) {
      allocations = user.departmentId
        ? allocations.filter(
            (a) =>
              a.holder?.departmentId === user.departmentId ||
              a.holderDepartmentId === user.departmentId
          )
        : allocations.filter((a) => a.holderId === user.id);
    }

    const now = Date.now();
    res.json(
      allocations.map((a) => ({
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
  holderId: z.string().min(1).optional(),
  holderDepartmentId: z.string().min(1).optional(),
  expectedReturnDate: z.coerce.date().nullable().optional(),
  note: z.string().optional(),
});

// Allocate an asset to an employee OR a department. Blocks double-allocation
// and suggests a transfer instead.
router.post(
  '/',
  requireRole('ADMIN', 'ASSET_MANAGER'),
  asyncHandler(async (req, res) => {
    const data = allocateSchema.parse(req.body);
    if (data.holderId && data.holderDepartmentId) {
      throw badRequest('Choose either an employee or a department as the holder, not both');
    }
    if (!data.holderId && !data.holderDepartmentId) {
      throw badRequest('Select an employee or a department to allocate this asset to');
    }

    const asset = unwrapMaybe<any>(
      await supabase
        .from('Asset')
        .select(
          '*, allocations:Allocation!Allocation_assetId_fkey(status, holder:User!Allocation_holderId_fkey(id,name,email), holderDepartment:Department!Allocation_holderDepartmentId_fkey(id,name))'
        )
        .eq('id', data.assetId)
        .single()
    );
    if (!asset) throw notFound('Asset not found');

    const activeAllocation = (asset.allocations ?? []).find((al: any) => al.status === 'ACTIVE');
    if (activeAllocation) {
      throw conflict(
        `This asset is currently held by ${holderName(activeAllocation)}. Raise a transfer request to reassign it.`
      );
    }
    if (['UNDER_MAINTENANCE', 'LOST', 'RETIRED', 'DISPOSED'].includes(asset.status)) {
      throw badRequest(`This asset is ${asset.status.replace('_', ' ').toLowerCase()} and cannot be allocated.`);
    }

    // Resolve the holder — a person or a whole department.
    let holderLabel: string;
    let notifyUserId: string | null = null;
    if (data.holderId) {
      const holder = unwrapMaybe<any>(
        await supabase.from('User').select('id, name').eq('id', data.holderId).single()
      );
      if (!holder) throw badRequest('Selected employee does not exist');
      holderLabel = holder.name;
      notifyUserId = holder.id;
    } else {
      const dept = unwrapMaybe<any>(
        await supabase.from('Department').select('id, name, headId').eq('id', data.holderDepartmentId!).single()
      );
      if (!dept) throw badRequest('Selected department does not exist');
      holderLabel = `${dept.name} (department)`;
      notifyUserId = dept.headId ?? null; // tell the department head, if any
    }

    // (was prisma.$transaction) create allocation, then flip asset status.
    const allocation = unwrap(
      await supabase
        .from('Allocation')
        .insert({
          assetId: data.assetId,
          holderId: data.holderId ?? null,
          holderDepartmentId: data.holderDepartmentId ?? null,
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
      details: `${asset.assetTag} → ${holderLabel}`,
    });
    if (notifyUserId) {
      await notify({
        userId: notifyUserId,
        type: 'ASSET_ASSIGNED',
        title: data.holderId ? 'Asset assigned to you' : 'Asset assigned to your department',
        message: `${asset.assetTag} — ${asset.name} has been allocated to ${data.holderId ? 'you' : holderLabel}.`,
        link: '/allocations',
      });
    }

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
          '*, asset:Asset!Allocation_assetId_fkey(*), holder:User!Allocation_holderId_fkey(*), holderDepartment:Department!Allocation_holderDepartmentId_fkey(id,name)'
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
      (user.role === 'DEPARTMENT_HEAD' &&
        (user.departmentId === allocation.holder?.departmentId ||
          user.departmentId === allocation.holderDepartmentId));
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
      details: `${allocation.asset.assetTag} returned by ${holderName(allocation)}`,
    });
    res.json({ message: 'Asset returned', assetId: allocation.assetId });
  })
);

// Scan ACTIVE allocations past their expected return date and create real
// OVERDUE_RETURN notifications (deduped per allocation). Also runs on server
// startup and every 15 minutes; this endpoint lets an admin trigger it on
// demand.
router.post(
  '/check-overdue',
  requireRole('ADMIN', 'ASSET_MANAGER'),
  asyncHandler(async (req, res) => {
    const result = await checkOverdueAllocations();
    if (result.notified > 0) {
      await logActivity(req.user!, {
        action: 'Overdue check',
        entityType: 'Allocation',
        details: `${result.notified} overdue notification${result.notified === 1 ? '' : 's'} sent (${result.checked} overdue allocations)`,
      });
    }
    res.json(result);
  })
);

export default router;
