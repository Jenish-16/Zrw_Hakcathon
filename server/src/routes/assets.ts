import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import multer from 'multer';
import { supabase, unwrap, unwrapMaybe } from '../lib/supabase';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { badRequest, notFound } from '../utils/errors';
import { logActivity } from '../services/activity';
import { nextAssetTag } from '../services/assetTag';
import { AssetStatus } from '../lib/types';

const router = Router();
router.use(authenticate);

/**
 * Scannable QR identifier, e.g. "QR-AF-0001-3F7A2B". Ties the code to the
 * human-readable asset tag while a random suffix keeps it unguessable and
 * unique (enforced by the Asset_qrCode_key index).
 */
function makeQrCode(assetTag: string): string {
  return `QR-${assetTag}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

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
        `assetTag.ilike.%${search}%,name.ilike.%${search}%,serialNumber.ilike.%${search}%,location.ilike.%${search}%,qrCode.ilike.%${search}%`
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

// --- File upload (photos & documents) --------------------------------------
// Receives one multipart file, stores it in the public "asset-files" Supabase
// Storage bucket, and returns its public URL for photoUrl/documentUrl.
const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // matches the bucket's 10 MB limit
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only images (JPEG/PNG/WebP/GIF) or documents (PDF/DOC/DOCX) are allowed'));
  },
});

router.post(
  '/upload',
  requireRole('ADMIN', 'ASSET_MANAGER'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw badRequest('No file provided (field name must be "file")');

    // Unique, URL-safe object path: uploads/<timestamp>-<random>-<clean name>
    const clean = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
    const path = `uploads/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${clean}`;

    const { error } = await supabase.storage
      .from('asset-files')
      .upload(path, file.buffer, { contentType: file.mimetype });
    if (error) throw error;

    const { data } = supabase.storage.from('asset-files').getPublicUrl(path);
    res.status(201).json({ url: data.publicUrl });
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
          qrCode: makeQrCode(assetTag),
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

// --- Bulk CSV import --------------------------------------------------------
// Symmetric to the /reports/export CSV. Each row is validated against the SAME
// createSchema used for single-asset creation; category/department may be given
// by name or id. Returns a per-row success/failure report. Additive endpoint —
// existing asset routes and flows are untouched.

/** Minimal RFC-4180-style CSV parser: handles quoted fields, escaped quotes
 *  ("") and CRLF. Returns row objects keyed by normalized (lowercased, alnum)
 *  headers, skipping blank lines. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') pushField();
    else if (c === '\n') pushRow();
    else if (c !== '\r') field += c;
  }
  if (field.length > 0 || row.length > 0) pushRow();
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  return rows
    .slice(1)
    .filter((r) => r.some((v) => v.trim() !== ''))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
      return obj;
    });
}

const MAX_IMPORT_ROWS = 1000;

router.post(
  '/import',
  requireRole('ADMIN', 'ASSET_MANAGER'),
  asyncHandler(async (req, res) => {
    const csv = (req.body as { csv?: unknown }).csv;
    if (typeof csv !== 'string' || !csv.trim()) throw badRequest('Provide CSV content in the "csv" field');
    const rows = parseCsv(csv);
    if (rows.length === 0) throw badRequest('No data rows found in the CSV');
    if (rows.length > MAX_IMPORT_ROWS) throw badRequest(`Too many rows (${rows.length}); the limit is ${MAX_IMPORT_ROWS}`);

    // Resolve category/department by id or (case-insensitive) name.
    const categories = unwrap(await supabase.from('AssetCategory').select('id, name')) as { id: string; name: string }[];
    const departments = unwrap(await supabase.from('Department').select('id, name')) as { id: string; name: string }[];
    const catById = new Set(categories.map((c) => c.id));
    const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
    const deptById = new Set(departments.map((d) => d.id));
    const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));
    const resolveCat = (v: string) => (catById.has(v) ? v : catByName.get(v.toLowerCase()));
    const resolveDept = (v: string) => (deptById.has(v) ? v : deptByName.get(v.toLowerCase()));
    const parseBool = (v: string): boolean | undefined => {
      const t = v.toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(t)) return true;
      if (['false', '0', 'no', 'n'].includes(t)) return false;
      return undefined;
    };

    const results: { line: number; name: string; assetTag?: string; ok: boolean; error?: string }[] = [];
    let created = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const line = i + 2; // +1 for header, +1 for 1-based
      try {
        const categoryRaw = r.category ?? '';
        if (!categoryRaw) throw new Error('Category is required');
        const categoryId = resolveCat(categoryRaw);
        if (!categoryId) throw new Error(`Unknown category "${categoryRaw}"`);

        let departmentId: string | undefined;
        const deptRaw = r.department ?? '';
        if (deptRaw) {
          departmentId = resolveDept(deptRaw);
          if (!departmentId) throw new Error(`Unknown department "${deptRaw}"`);
        }

        const data = createSchema.parse({
          name: r.name,
          categoryId,
          serialNumber: r.serialnumber || undefined,
          acquisitionDate: r.acquisitiondate || undefined,
          acquisitionCost: r.acquisitioncost || undefined,
          condition: r.condition ? r.condition.toUpperCase() : undefined,
          location: r.location || undefined,
          departmentId,
          isBookable: parseBool(r.isbookable ?? ''),
        });

        const assetTag = await nextAssetTag();
        const inserted = unwrap(
          await supabase
            .from('Asset')
            .insert({
              assetTag,
              qrCode: makeQrCode(assetTag),
              name: data.name,
              categoryId: data.categoryId,
              serialNumber: data.serialNumber ?? null,
              acquisitionDate: data.acquisitionDate ?? null,
              acquisitionCost: data.acquisitionCost ?? null,
              condition: data.condition ?? 'GOOD',
              location: data.location ?? null,
              photoUrl: null,
              documentUrl: null,
              isBookable: data.isBookable ?? false,
              departmentId: data.departmentId || null,
              customData: null,
              status: 'AVAILABLE',
            })
            .select('assetTag')
            .single()
        ) as { assetTag: string };
        created += 1;
        results.push({ line, name: data.name, assetTag: inserted.assetTag, ok: true });
      } catch (err) {
        let error = 'Invalid row';
        if (err instanceof z.ZodError) {
          const f = err.errors[0];
          error = f ? `${f.path.join('.') || 'input'}: ${f.message}` : 'Validation failed';
        } else if (err instanceof Error) {
          error = err.message;
        }
        results.push({ line, name: r.name ?? '', ok: false, error });
      }
    }

    if (created > 0) {
      await logActivity(req.user!, {
        action: 'Imported assets',
        entityType: 'Asset',
        details: `${created} of ${results.length} row(s) imported via CSV`,
      });
    }
    res.status(201).json({ created, failed: results.length - created, total: results.length, results });
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
