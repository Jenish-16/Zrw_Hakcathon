import { Router } from 'express';
import { z } from 'zod';
import { supabase, unwrap, unwrapMaybe } from '../lib/supabase';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { badRequest, notFound } from '../utils/errors';
import { logActivity } from '../services/activity';

const router = Router();
router.use(authenticate);

const RELATIONS =
  '*, head:User!Department_headId_fkey(id,name,email), parent:Department!Department_parentId_fkey(id,name,code)';

/** Count the linked records the Prisma `_count` relation used to provide. */
async function countsFor(deptId: string) {
  const [members, assets, children] = await Promise.all([
    supabase.from('User').select('*', { count: 'exact', head: true }).eq('departmentId', deptId),
    supabase.from('Asset').select('*', { count: 'exact', head: true }).eq('departmentId', deptId),
    supabase.from('Department').select('*', { count: 'exact', head: true }).eq('parentId', deptId),
  ]);
  return {
    members: members.count ?? 0,
    assets: assets.count ?? 0,
    children: children.count ?? 0,
  };
}

async function withCounts<T extends { id: string }>(dept: T) {
  return { ...dept, _count: await countsFor(dept.id) };
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const departments = unwrap(
      await supabase.from('Department').select(RELATIONS).order('name', { ascending: true })
    );
    const shaped = await Promise.all((departments as { id: string }[]).map(withCounts));
    res.json(shaped);
  })
);

const baseSchema = z.object({
  name: z.string().trim().min(2, 'Department name is required'),
  code: z.string().trim().min(1, 'Code is required').toUpperCase(),
  headId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = baseSchema.parse(req.body);
    const dept = unwrap(
      await supabase
        .from('Department')
        .insert({
          name: data.name,
          code: data.code,
          headId: data.headId || null,
          parentId: data.parentId || null,
          status: data.status ?? 'ACTIVE',
        })
        .select(RELATIONS)
        .single()
    );
    const shaped = await withCounts(dept as { id: string });
    await logActivity(req.user!, {
      action: 'Created department',
      entityType: 'Department',
      entityId: (dept as any).id,
      details: (dept as any).name,
    });
    res.status(201).json(shaped);
  })
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = baseSchema.partial().parse(req.body);
    if (data.parentId && data.parentId === req.params.id) {
      throw badRequest('A department cannot be its own parent');
    }
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.code !== undefined) payload.code = data.code;
    if (data.headId !== undefined) payload.headId = data.headId || null;
    if (data.parentId !== undefined) payload.parentId = data.parentId || null;
    if (data.status !== undefined) payload.status = data.status;

    const dept = unwrap(
      await supabase.from('Department').update(payload).eq('id', req.params.id).select(RELATIONS).single()
    );
    const shaped = await withCounts(dept as { id: string });
    await logActivity(req.user!, {
      action: 'Updated department',
      entityType: 'Department',
      entityId: (dept as any).id,
      details: (dept as any).name,
    });
    res.json(shaped);
  })
);

router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const dept = unwrapMaybe<{ id: string; name: string }>(
      await supabase.from('Department').select('id, name').eq('id', req.params.id).single()
    );
    if (!dept) throw notFound('Department not found');
    const counts = await countsFor(dept.id);
    if (counts.members > 0 || counts.assets > 0 || counts.children > 0) {
      // Preserve referential integrity — deactivate instead of hard-deleting.
      const updated = unwrap(
        await supabase
          .from('Department')
          .update({ status: 'INACTIVE' })
          .eq('id', req.params.id)
          .select(RELATIONS)
          .single()
      );
      const shaped = await withCounts(updated as { id: string });
      await logActivity(req.user!, {
        action: 'Deactivated department',
        entityType: 'Department',
        entityId: dept.id,
        details: `${dept.name} (has linked records, deactivated instead of deleted)`,
      });
      return res.json({ deactivated: true, department: shaped });
    }
    const del = await supabase.from('Department').delete().eq('id', req.params.id);
    if (del.error) throw del.error;
    await logActivity(req.user!, {
      action: 'Deleted department',
      entityType: 'Department',
      entityId: dept.id,
      details: dept.name,
    });
    res.json({ deleted: true });
  })
);

export default router;
