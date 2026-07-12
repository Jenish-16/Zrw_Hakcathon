import { Router } from 'express';
import { z } from 'zod';
import { supabase, unwrap, unwrapMaybe } from '../lib/supabase';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { badRequest, notFound } from '../utils/errors';
import { logActivity } from '../services/activity';
import { notify, notifyMany, getManagerIds } from '../services/notify';

const router = Router();
router.use(authenticate);

// Embedded select mirroring the old Prisma `include`. Named FK constraints
// disambiguate the four User relations.
const transferSelect =
  '*, ' +
  'asset:Asset!TransferRequest_assetId_fkey(id,assetTag,name,status), ' +
  'fromUser:User!TransferRequest_fromUserId_fkey(id,name), ' +
  'toUser:User!TransferRequest_toUserId_fkey(id,name), ' +
  'requestedBy:User!TransferRequest_requestedById_fkey(id,name), ' +
  'approvedBy:User!TransferRequest_approvedById_fkey(id,name)';

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status } = req.query as Record<string, string>;
    let q = supabase.from('TransferRequest').select(transferSelect);
    if (status) q = q.eq('status', status);
    const transfers = unwrap(await q.order('createdAt', { ascending: false }));
    res.json(transfers);
  })
);

const createSchema = z.object({
  assetId: z.string().min(1),
  toUserId: z.string().min(1),
  note: z.string().optional(),
});

// Any user can request a transfer of an asset to another employee.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
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
    const toUser = unwrapMaybe<any>(
      await supabase.from('User').select('id, name').eq('id', data.toUserId).single()
    );
    if (!toUser) throw badRequest('Target employee does not exist');

    const currentHolder =
      (asset.allocations ?? []).find((a: any) => a.status === 'ACTIVE')?.holder ?? null;
    if (currentHolder && currentHolder.id === data.toUserId) {
      throw badRequest(`${toUser.name} already holds this asset`);
    }

    const existingPending = await supabase
      .from('TransferRequest')
      .select('id')
      .eq('assetId', data.assetId)
      .eq('status', 'REQUESTED')
      .limit(1)
      .maybeSingle();
    if (existingPending.error) throw existingPending.error;
    if (existingPending.data) throw badRequest('There is already a pending transfer request for this asset');

    const transfer = unwrap(
      await supabase
        .from('TransferRequest')
        .insert({
          assetId: data.assetId,
          fromUserId: currentHolder?.id ?? null,
          toUserId: data.toUserId,
          requestedById: req.user!.id,
          note: data.note ?? null,
          status: 'REQUESTED',
        })
        .select(transferSelect)
        .single()
    );

    await logActivity(req.user!, {
      action: 'Requested transfer',
      entityType: 'Asset',
      entityId: asset.id,
      details: `${asset.assetTag} → ${toUser.name}`,
    });
    await notifyMany(await getManagerIds(), {
      type: 'TRANSFER_REQUESTED',
      title: 'Transfer request pending',
      message: `${req.user!.name} requested to transfer ${asset.assetTag} to ${toUser.name}.`,
      link: '/transfers',
    });
    res.status(201).json(transfer);
  })
);

const decisionSchema = z.object({ decisionNote: z.string().optional() });

// Approve -> re-allocate the asset to the target user (history updated automatically).
router.post(
  '/:id/approve',
  requireRole('ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'),
  asyncHandler(async (req, res) => {
    const { decisionNote } = decisionSchema.parse(req.body);
    const transfer = unwrapMaybe<any>(
      await supabase
        .from('TransferRequest')
        .select('*, asset:Asset!TransferRequest_assetId_fkey(*), toUser:User!TransferRequest_toUserId_fkey(id,name)')
        .eq('id', req.params.id)
        .single()
    );
    if (!transfer) throw notFound('Transfer request not found');
    if (transfer.status !== 'REQUESTED') throw badRequest('This request has already been decided');

    // (was prisma.$transaction) close active allocation, re-allocate, flip asset,
    // then mark the request completed — same order as before.
    const close = await supabase
      .from('Allocation')
      .update({ status: 'RETURNED', returnedAt: new Date().toISOString() })
      .eq('assetId', transfer.assetId)
      .eq('status', 'ACTIVE');
    if (close.error) throw close.error;

    const reallocate = await supabase.from('Allocation').insert({
      assetId: transfer.assetId,
      holderId: transfer.toUserId,
      allocatedById: req.user!.id,
      status: 'ACTIVE',
    });
    if (reallocate.error) throw reallocate.error;

    const assetUpdate = await supabase
      .from('Asset')
      .update({ status: 'ALLOCATED' })
      .eq('id', transfer.assetId);
    if (assetUpdate.error) throw assetUpdate.error;

    const transferUpdate = await supabase
      .from('TransferRequest')
      .update({ status: 'COMPLETED', approvedById: req.user!.id, decisionNote: decisionNote ?? null })
      .eq('id', transfer.id);
    if (transferUpdate.error) throw transferUpdate.error;

    await logActivity(req.user!, {
      action: 'Approved transfer',
      entityType: 'Asset',
      entityId: transfer.assetId,
      details: `${transfer.asset.assetTag} re-allocated to ${transfer.toUser.name}`,
    });
    await notify({
      userId: transfer.toUserId,
      type: 'TRANSFER_APPROVED',
      title: 'Transfer approved',
      message: `${transfer.asset.assetTag} — ${transfer.asset.name} has been allocated to you.`,
      link: '/allocations',
    });
    if (transfer.requestedById !== transfer.toUserId) {
      await notify({
        userId: transfer.requestedById,
        type: 'TRANSFER_APPROVED',
        title: 'Transfer approved',
        message: `Your transfer request for ${transfer.asset.assetTag} was approved.`,
        link: '/transfers',
      });
    }
    res.json({ message: 'Transfer approved and asset re-allocated' });
  })
);

router.post(
  '/:id/reject',
  requireRole('ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'),
  asyncHandler(async (req, res) => {
    const { decisionNote } = decisionSchema.parse(req.body);
    const transfer = unwrapMaybe<any>(
      await supabase
        .from('TransferRequest')
        .select('*, asset:Asset!TransferRequest_assetId_fkey(id,assetTag,name,status)')
        .eq('id', req.params.id)
        .single()
    );
    if (!transfer) throw notFound('Transfer request not found');
    if (transfer.status !== 'REQUESTED') throw badRequest('This request has already been decided');

    const update = await supabase
      .from('TransferRequest')
      .update({ status: 'REJECTED', approvedById: req.user!.id, decisionNote: decisionNote ?? null })
      .eq('id', transfer.id);
    if (update.error) throw update.error;

    await logActivity(req.user!, {
      action: 'Rejected transfer',
      entityType: 'Asset',
      entityId: transfer.assetId,
      details: `${transfer.asset.assetTag}`,
    });
    await notify({
      userId: transfer.requestedById,
      type: 'TRANSFER_REJECTED',
      title: 'Transfer rejected',
      message: `Your transfer request for ${transfer.asset.assetTag} was rejected.${decisionNote ? ` Reason: ${decisionNote}` : ''}`,
      link: '/transfers',
    });
    res.json({ message: 'Transfer rejected' });
  })
);

export default router;
