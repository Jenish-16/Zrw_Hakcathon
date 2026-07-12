import { Router } from 'express';
import { z } from 'zod';
import { supabase, unwrap, unwrapMaybe } from '../lib/supabase';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { notFound } from '../utils/errors';
import { logActivity } from '../services/activity';

const router = Router();
router.use(authenticate);

const customFieldSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: z.enum(['text', 'number', 'date', 'boolean']).default('text'),
});

const baseSchema = z.object({
  name: z.string().trim().min(2, 'Category name is required'),
  description: z.string().nullable().optional(),
  customFields: z
    .array(customFieldSchema)
    .nullable()
    .optional()
    // Keys become the storage path for each asset's custom value, so a
    // collision would silently overwrite data — reject duplicates outright.
    .refine(
      (fields) => !fields || new Set(fields.map((f) => f.key)).size === fields.length,
      { message: 'Custom fields must have distinct names' }
    ),
});

async function assetCount(categoryId: string): Promise<number> {
  const { count, error } = await supabase
    .from('Asset')
    .select('*', { count: 'exact', head: true })
    .eq('categoryId', categoryId);
  if (error) throw error;
  return count ?? 0;
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const categories = unwrap(
      await supabase.from('AssetCategory').select('*').order('name', { ascending: true })
    );
    const withCounts = await Promise.all(
      categories.map(async (c: any) => ({ ...c, _count: { assets: await assetCount(c.id) } }))
    );
    res.json(withCounts);
  })
);

router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = baseSchema.parse(req.body);
    const category = unwrap(
      await supabase
        .from('AssetCategory')
        .insert({
          name: data.name,
          description: data.description ?? null,
          customFields: data.customFields ?? null,
        })
        .select('*')
        .single()
    );
    await logActivity(req.user!, {
      action: 'Created category',
      entityType: 'AssetCategory',
      entityId: category.id,
      details: category.name,
    });
    res.status(201).json({ ...category, _count: { assets: 0 } });
  })
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = baseSchema.partial().parse(req.body);
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.description !== undefined) payload.description = data.description;
    if (data.customFields !== undefined) payload.customFields = data.customFields ?? null;
    const category = unwrap(
      await supabase.from('AssetCategory').update(payload).eq('id', req.params.id).select('*').single()
    );
    await logActivity(req.user!, {
      action: 'Updated category',
      entityType: 'AssetCategory',
      entityId: category.id,
      details: category.name,
    });
    res.json({ ...category, _count: { assets: await assetCount(category.id) } });
  })
);

router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const category = unwrapMaybe(
      await supabase.from('AssetCategory').select('*').eq('id', req.params.id).single()
    );
    if (!category) throw notFound('Category not found');
    if ((await assetCount(req.params.id)) > 0) {
      throw notFound('Cannot delete a category that still has assets. Reassign those assets first.');
    }
    const { error } = await supabase.from('AssetCategory').delete().eq('id', req.params.id);
    if (error) throw error;
    await logActivity(req.user!, {
      action: 'Deleted category',
      entityType: 'AssetCategory',
      entityId: category.id,
      details: category.name,
    });
    res.json({ deleted: true });
  })
);

export default router;
