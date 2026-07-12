import { Router } from 'express';
import { z } from 'zod';
import { supabase, unwrap, unwrapMaybe } from '../lib/supabase';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { badRequest, forbidden, notFound } from '../utils/errors';
import { logActivity } from '../services/activity';
import { notifyMany, getManagerIds } from '../services/notify';

const router = Router();
router.use(authenticate);

// Base cycle select: createdBy + assignments (with auditor). The items `_count`
// is assembled in JS (see itemStats) to preserve the original response shape.
const cycleSelect =
  '*, createdBy:User!AuditCycle_createdById_fkey(id,name), assignments:AuditAssignment!AuditAssignment_cycleId_fkey(*, auditor:User!AuditAssignment_auditorId_fkey(id,name,email))';

// Fetch the per-status item counts and total for a cycle.
async function itemStats(cycleId: string): Promise<{ counts: Record<string, number>; total: number }> {
  const items = unwrap(await supabase.from('AuditItem').select('status').eq('cycleId', cycleId)) as {
    status: string;
  }[];
  const counts = { PENDING: 0, VERIFIED: 0, MISSING: 0, DAMAGED: 0 } as Record<string, number>;
  items.forEach((i) => (counts[i.status] = (counts[i.status] ?? 0) + 1));
  return { counts, total: items.length };
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const cycles = unwrap(
      await supabase.from('AuditCycle').select(cycleSelect).order('createdAt', { ascending: false })
    ) as any[];
    const withCounts = await Promise.all(
      cycles.map(async (c) => {
        const { counts, total } = await itemStats(c.id);
        return { ...c, _count: { items: total }, counts };
      })
    );
    res.json(withCounts);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const cycle = unwrapMaybe(
      await supabase
        .from('AuditCycle')
        .select(
          `${cycleSelect}, items:AuditItem!AuditItem_cycleId_fkey(*, asset:Asset!AuditItem_assetId_fkey(id,assetTag,name,location,status), auditedBy:User!AuditItem_auditedById_fkey(id,name))`
        )
        .eq('id', req.params.id)
        .single()
    ) as any;
    if (!cycle) throw notFound('Audit cycle not found');
    // Order items by asset tag (was orderBy asset.assetTag asc in Prisma).
    (cycle.items ?? []).sort((a: any, b: any) => a.asset.assetTag.localeCompare(b.asset.assetTag));
    const { counts, total } = await itemStats(cycle.id);
    res.json({ ...cycle, _count: { items: total }, counts });
  })
);

const createSchema = z.object({
  name: z.string().trim().min(3, 'Cycle name is required'),
  scopeType: z.enum(['DEPARTMENT', 'LOCATION']),
  scopeValue: z.string().min(1, 'Select a scope'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  auditorIds: z.array(z.string()).min(1, 'Assign at least one auditor'),
});

router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    if (data.endDate < data.startDate) throw badRequest('End date must be after the start date');

    // Resolve assets in scope (exclude disposed/retired).
    let assetQuery = supabase.from('Asset').select('id').not('status', 'in', '(DISPOSED,RETIRED)');
    if (data.scopeType === 'DEPARTMENT') {
      assetQuery = assetQuery.eq('departmentId', data.scopeValue);
    } else {
      assetQuery = assetQuery.ilike('location', `%${data.scopeValue}%`);
    }
    const assets = unwrap(await assetQuery) as { id: string }[];
    if (assets.length === 0) throw badRequest('No assets found in the selected scope');

    // No transaction support — perform the writes sequentially in order.
    const cycle = unwrap(
      await supabase
        .from('AuditCycle')
        .insert({
          name: data.name,
          scopeType: data.scopeType,
          scopeValue: data.scopeValue,
          startDate: data.startDate.toISOString(),
          endDate: data.endDate.toISOString(),
          createdById: req.user!.id,
        })
        .select('*')
        .single()
    ) as { id: string; name: string };

    const uniqueAuditorIds = [...new Set(data.auditorIds)];
    const assignmentRes = await supabase
      .from('AuditAssignment')
      .insert(uniqueAuditorIds.map((auditorId) => ({ cycleId: cycle.id, auditorId })));
    if (assignmentRes.error) throw assignmentRes.error;

    const itemRes = await supabase
      .from('AuditItem')
      .insert(assets.map((a) => ({ cycleId: cycle.id, assetId: a.id, status: 'PENDING' })));
    if (itemRes.error) throw itemRes.error;

    await logActivity(req.user!, {
      action: 'Created audit cycle',
      entityType: 'AuditCycle',
      entityId: cycle.id,
      details: `${cycle.name} (${assets.length} assets)`,
    });
    await notifyMany(data.auditorIds, {
      type: 'AUDIT_ASSIGNED',
      title: 'You were assigned to an audit',
      message: `You are an auditor for "${cycle.name}". Verify ${assets.length} assets before ${data.endDate.toLocaleDateString()}.`,
      link: '/audits',
    });

    const full = unwrapMaybe(
      await supabase.from('AuditCycle').select(cycleSelect).eq('id', cycle.id).single()
    ) as any;
    const { counts, total } = await itemStats(cycle.id);
    res.status(201).json({ ...full, _count: { items: total }, counts });
  })
);

const itemSchema = z.object({
  status: z.enum(['VERIFIED', 'MISSING', 'DAMAGED', 'PENDING']),
  notes: z.string().optional(),
});

router.patch(
  '/:id/items/:itemId',
  asyncHandler(async (req, res) => {
    const data = itemSchema.parse(req.body);
    const cycle = unwrapMaybe(
      await supabase
        .from('AuditCycle')
        .select('id, name, status, createdById, assignments:AuditAssignment!AuditAssignment_cycleId_fkey(auditorId)')
        .eq('id', req.params.id)
        .single()
    ) as { id: string; name: string; status: string; createdById: string; assignments: { auditorId: string }[] } | null;
    if (!cycle) throw notFound('Audit cycle not found');
    if (cycle.status === 'CLOSED') throw badRequest('This audit cycle is closed and locked');

    const user = req.user!;
    const isAuditor = cycle.assignments.some((a) => a.auditorId === user.id);
    if (!isAuditor && user.role !== 'ADMIN') throw forbidden('Only assigned auditors can verify items');

    const item = unwrap(
      await supabase
        .from('AuditItem')
        .update({
          status: data.status,
          notes: data.notes ?? null,
          auditedById: user.id,
          auditedAt: new Date().toISOString(),
        })
        .eq('id', req.params.itemId)
        .select('*, asset:Asset!AuditItem_assetId_fkey(assetTag,name)')
        .single()
    ) as any;
    if (data.status === 'MISSING' || data.status === 'DAMAGED') {
      await logActivity(user, {
        action: 'Flagged audit discrepancy',
        entityType: 'Asset',
        entityId: item.assetId,
        details: `${item.asset.assetTag} marked ${data.status}`,
      });
      // Alert the managers (Admins + Asset Managers) and the cycle's creator so
      // the discrepancy can be resolved. De-duplicated by notifyMany.
      await notifyMany([...(await getManagerIds()), cycle.createdById], {
        type: 'AUDIT_DISCREPANCY_FLAGGED',
        title: 'Audit discrepancy flagged',
        message: `${item.asset.assetTag} — ${item.asset.name} was flagged ${data.status} during "${cycle.name}".`,
        link: `/audits/${cycle.id}`,
      });
    }
    res.json(item);
  })
);

router.get(
  '/:id/discrepancies',
  asyncHandler(async (req, res) => {
    const items = unwrap(
      await supabase
        .from('AuditItem')
        .select(
          '*, asset:Asset!AuditItem_assetId_fkey(id,assetTag,name,location), auditedBy:User!AuditItem_auditedById_fkey(name)'
        )
        .eq('cycleId', req.params.id)
        .in('status', ['MISSING', 'DAMAGED'])
        .order('status', { ascending: true })
    );
    res.json(items);
  })
);

router.post(
  '/:id/close',
  // Closing a cycle IS the discrepancy-resolution step (it applies the
  // Lost/Damaged outcomes), which the spec assigns to the Asset Manager as well
  // as the Admin. Matches the requireRole('ADMIN', 'ASSET_MANAGER') pattern used
  // for other approval actions (e.g. assets.ts, allocations.ts).
  requireRole('ADMIN', 'ASSET_MANAGER'),
  asyncHandler(async (req, res) => {
    const cycle = unwrapMaybe(
      await supabase
        .from('AuditCycle')
        .select('id, name, status, createdById, items:AuditItem!AuditItem_cycleId_fkey(assetId,status)')
        .eq('id', req.params.id)
        .single()
    ) as { id: string; name: string; status: string; createdById: string; items: { assetId: string; status: string }[] } | null;
    if (!cycle) throw notFound('Audit cycle not found');
    if (cycle.status === 'CLOSED') throw badRequest('This cycle is already closed');

    const missing = cycle.items.filter((i) => i.status === 'MISSING');
    const damaged = cycle.items.filter((i) => i.status === 'DAMAGED');

    // Sequential (no transaction). Confirmed-missing assets become Lost.
    if (missing.length) {
      const r = await supabase
        .from('Asset')
        .update({ status: 'LOST' })
        .in(
          'id',
          missing.map((i) => i.assetId)
        )
        .not('status', 'in', '(DISPOSED,RETIRED)');
      if (r.error) throw r.error;
    }
    // Damaged assets get their condition downgraded.
    if (damaged.length) {
      const r = await supabase
        .from('Asset')
        .update({ condition: 'DAMAGED' })
        .in(
          'id',
          damaged.map((i) => i.assetId)
        );
      if (r.error) throw r.error;
    }
    const closeRes = await supabase
      .from('AuditCycle')
      .update({ status: 'CLOSED', closedAt: new Date().toISOString() })
      .eq('id', cycle.id);
    if (closeRes.error) throw closeRes.error;

    await logActivity(req.user!, {
      action: 'Closed audit cycle',
      entityType: 'AuditCycle',
      entityId: cycle.id,
      details: `${cycle.name}: ${missing.length} lost, ${damaged.length} damaged`,
    });
    // Notify the managers and the cycle creator of the resolution outcome.
    await notifyMany([...(await getManagerIds()), cycle.createdById], {
      type: 'AUDIT_CYCLE_CLOSED',
      title: 'Audit cycle closed',
      message: `Audit cycle "${cycle.name}" closed: ${missing.length} asset(s) marked Lost, ${damaged.length} marked Damaged.`,
      link: `/audits/${cycle.id}`,
    });
    res.json({
      message: 'Audit cycle closed',
      lost: missing.length,
      damaged: damaged.length,
    });
  })
);

export default router;
