import { Router } from 'express';
import { z } from 'zod';
import { supabase, unwrap, unwrapMaybe } from '../lib/supabase';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { badRequest, notFound } from '../utils/errors';
import { logActivity } from '../services/activity';
import { nextAssetTag } from '../services/assetTag';
import { AssetStatus } from '../lib/types';

const router = Router();
router.use(authenticate);

// Base + active-allocation embed used by list/create/patch/status responses.
const LIST_SELECT =
  '*, category:AssetCategory!Asset_categoryId_fkey(id,name), department:Department!Asset_departmentId_fkey(id,name,code), allocations:Allocation!Allocation_assetId_fkey(status, holder:User!Allocation_holderId_fkey(id,name,email))';

// Full history embed for the detail view.
const DETAIL_SELECT =
  '*, category:AssetCategory!Asset_categoryId_fkey(*), department:Department!Asset_departmentId_fkey(id,name,code), allocations:Allocation!Allocation_assetId_fkey(*, holder:User!Allocation_holderId_fkey(id,name,email), allocatedBy:User!Allocation_allocatedById_fkey(id,name)), maintenanceRequests:MaintenanceRequest!MaintenanceRequest_assetId_fkey(*, raisedBy:User!MaintenanceRequest_raisedById_fkey(id,name), approvedBy:User!MaintenanceRequest_approvedById_fkey(id,name)), bookings:Booking!Booking_resourceId_fkey(*, bookedBy:User!Booking_bookedById_fkey(id,name))';

function activeHolder(allocations: any[] | undefined | null) {
  return (allocations ?? []).find((al) => al.status === 'ACTIVE')?.holder ?? null;
}

// List + search/filter assets.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { search, category, status, department, location, bookable } = req.query as Record<string, string>;
    let q = supabase.from('Asset').select(LIST_SELECT);
    if (search) {
      q = q.or(
        `assetTag.ilike.%${search}%,name.ilike.%${search}%,serialNumber.ilike.%${search}%,location.ilike.%${search}%`
      );
    }
    if (category) q = q.eq('categoryId', category);
    if (status) q = q.eq('status', status);
    if (department) q = q.eq('departmentId', department);
    if (location) q = q.ilike('location', `%${location}%`);
    if (bookable === 'true') q = q.eq('isBookable', true);

    const assets = unwrap(await q.order('createdAt', { ascending: false }));

    const shaped = (assets as any[]).map((a) => {
      const { allocations, ...rest } = a;
      return { ...rest, currentHolder: activeHolder(allocations) };
    });
    res.json(shaped);
  })
);

// Per-asset detail with full allocation + maintenance history.
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const asset = unwrapMaybe<any>(
      await supabase.from('Asset').select(DETAIL_SELECT).eq('id', req.params.id).single()
    );
    if (!asset) throw notFound('Asset not found');

    // Order/limit child collections in JS (PostgREST embedded ordering is avoided).
    asset.allocations = (asset.allocations ?? []).sort(
      (a: any, b: any) => new Date(b.allocatedAt).getTime() - new Date(a.allocatedAt).getTime()
    );
    asset.maintenanceRequests = (asset.maintenanceRequests ?? []).sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    asset.bookings = (asset.bookings ?? [])
      .sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 20);

    const currentHolder = activeHolder(asset.allocations);
    res.json({ ...asset, currentHolder });
  })
);

const createSchema = z.object({
  name: z.string().trim().min(2, 'Asset name is required'),
  categoryId: z.string().min(1, 'Category is required'),
  serialNumber: z.string().nullable().optional(),
  acquisitionDate: z.coerce.date().nullable().optional(),
  acquisitionCost: z.coerce.number().min(0).nullable().optional(),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED']).optional(),
  location: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  documentUrl: z.string().nullable().optional(),
  isBookable: z.boolean().optional(),
  departmentId: z.string().nullable().optional(),
  customData: z.record(z.any()).nullable().optional(),
});

router.post(
  '/',
  requireRole('ADMIN', 'ASSET_MANAGER'),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const category = unwrapMaybe(
      await supabase.from('AssetCategory').select('id').eq('id', data.categoryId).single()
    );
    if (!category) throw badRequest('Selected category does not exist');

    // Previously wrapped in a transaction; supabase-js has none, so the tag is
    // generated atomically via the next_asset_tag() RPC, then the row inserted.
    const assetTag = await nextAssetTag();
    const asset = unwrap(
      await supabase
        .from('Asset')
        .insert({
          assetTag,
          name: data.name,
          categoryId: data.categoryId,
          serialNumber: data.serialNumber ?? null,
          acquisitionDate: data.acquisitionDate ?? null,
          acquisitionCost: data.acquisitionCost ?? null,
          condition: data.condition ?? 'GOOD',
          location: data.location ?? null,
          photoUrl: data.photoUrl ?? null,
          documentUrl: data.documentUrl ?? null,
          isBookable: data.isBookable ?? false,
          departmentId: data.departmentId || null,
          customData: data.customData ?? null,
          status: 'AVAILABLE',
        })
        .select(LIST_SELECT)
        .single()
    );

    await logActivity(req.user!, {
      action: 'Registered asset',
      entityType: 'Asset',
      entityId: (asset as any).id,
      details: `${(asset as any).assetTag} — ${(asset as any).name}`,
    });
    res.status(201).json({ ...(asset as any), currentHolder: null });
  })
);

const updateSchema = createSchema.partial().omit({ categoryId: true }).extend({
  categoryId: z.string().min(1).optional(),
});

router.patch(
  '/:id',
  requireRole('ADMIN', 'ASSET_MANAGER'),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.categoryId !== undefined) payload.categoryId = data.categoryId;
    if (data.serialNumber !== undefined) payload.serialNumber = data.serialNumber;
    if (data.acquisitionDate !== undefined) payload.acquisitionDate = data.acquisitionDate;
    if (data.acquisitionCost !== undefined) payload.acquisitionCost = data.acquisitionCost;
    if (data.condition !== undefined) payload.condition = data.condition;
    if (data.location !== undefined) payload.location = data.location;
    if (data.photoUrl !== undefined) payload.photoUrl = data.photoUrl;
    if (data.documentUrl !== undefined) payload.documentUrl = data.documentUrl;
    if (data.isBookable !== undefined) payload.isBookable = data.isBookable;
    if (data.departmentId !== undefined) payload.departmentId = data.departmentId || null;
    if (data.customData !== undefined) payload.customData = data.customData ?? null;

    const asset = unwrap(
      await supabase.from('Asset').update(payload).eq('id', req.params.id).select(LIST_SELECT).single()
    );
    await logActivity(req.user!, {
      action: 'Updated asset',
      entityType: 'Asset',
      entityId: (asset as any).id,
      details: `${(asset as any).assetTag} — ${(asset as any).name}`,
    });
    const { allocations, ...rest } = asset as any;
    res.json({ ...rest, currentHolder: activeHolder(allocations) });
  })
);

// Manual lifecycle transition (Retire, Dispose, mark Lost, return from maintenance, etc.).
const statusSchema = z.object({
  status: z.nativeEnum(AssetStatus),
  note: z.string().optional(),
});

const MANUAL_TARGETS: AssetStatus[] = ['AVAILABLE', 'RESERVED', 'LOST', 'RETIRED', 'DISPOSED', 'UNDER_MAINTENANCE'];

router.post(
  '/:id/status',
  requireRole('ADMIN', 'ASSET_MANAGER'),
  asyncHandler(async (req, res) => {
    const { status, note } = statusSchema.parse(req.body);
    const asset = unwrapMaybe<any>(
      await supabase.from('Asset').select('*').eq('id', req.params.id).single()
    );
    if (!asset) throw notFound('Asset not found');
    if (!MANUAL_TARGETS.includes(status)) throw badRequest('That status cannot be set manually');
    if (asset.status === 'ALLOCATED' && status !== 'LOST') {
      throw badRequest('This asset is currently allocated. Process a return before changing its status.');
    }
    const updated = unwrap(
      await supabase.from('Asset').update({ status }).eq('id', req.params.id).select(LIST_SELECT).single()
    );
    await logActivity(req.user!, {
      action: 'Changed asset status',
      entityType: 'Asset',
      entityId: asset.id,
      details: `${asset.assetTag}: ${asset.status} → ${status}${note ? ` (${note})` : ''}`,
    });
    const { allocations, ...rest } = updated as any;
    res.json({ ...rest, currentHolder: activeHolder(allocations) });
  })
);

export default router;
