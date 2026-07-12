import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import multer from 'multer';
import { supabase, unwrap, unwrapMaybe } from '../lib/supabase';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { badRequest, forbidden, notFound } from '../utils/errors';
import { logActivity } from '../services/activity';
import { notify, notifyMany, getManagerIds } from '../services/notify';

const router = Router();
router.use(authenticate);

const requestSelect =
  '*, asset:Asset!MaintenanceRequest_assetId_fkey(id,assetTag,name,status), raisedBy:User!MaintenanceRequest_raisedById_fkey(id,name), approvedBy:User!MaintenanceRequest_approvedById_fkey(id,name)';

// --- Photo upload -----------------------------------------------------------
// Maintenance photos live in their own dedicated public bucket, separate from
// asset media, so repair evidence is easy to manage/purge independently. The
// handler stores one image and returns its public URL for the `photoUrl` field
// (whose name/shape is unchanged — AssetDetail's history tab still reads it).
const MAINTENANCE_BUCKET = 'maintenance-photos';
const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only image files (JPEG/PNG/WebP/GIF) are allowed'));
  },
});

// Create the dedicated public bucket on first use (service-role can do this),
// so the feature works without a manual Supabase console step. Memoized; a
// failure clears the cache so the next upload retries.
let bucketReady: Promise<void> | null = null;
function ensureMaintenanceBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { data } = await supabase.storage.getBucket(MAINTENANCE_BUCKET);
      if (!data) {
        const { error } = await supabase.storage.createBucket(MAINTENANCE_BUCKET, {
          public: true,
          fileSizeLimit: 10 * 1024 * 1024,
        });
        // Ignore "already exists" races between concurrent uploads.
        if (error && !/exist/i.test(error.message)) throw error;
      }
    })().catch((err) => {
      bucketReady = null;
      throw err;
    });
  }
  return bucketReady;
}

// Any authenticated user may raise a request, so any authenticated user may
// attach a photo (no manager role required here).
router.post(
  '/upload',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw badRequest('No file provided (field name must be "file")');
    await ensureMaintenanceBucket();

    const clean = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
    const path = `photos/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${clean}`;
    const { error } = await supabase.storage
      .from(MAINTENANCE_BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype });
    if (error) throw error;

    const { data } = supabase.storage.from(MAINTENANCE_BUCKET).getPublicUrl(path);
    res.status(201).json({ url: data.publicUrl });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, assetId } = req.query as Record<string, string>;
    const user = req.user!;
    let q = supabase.from('MaintenanceRequest').select(requestSelect);
    if (status) q = q.eq('status', status);
    if (assetId) q = q.eq('assetId', assetId);
    if (user.role === 'EMPLOYEE') q = q.eq('raisedById', user.id);
    const requests = unwrap(await q.order('createdAt', { ascending: false }));
    res.json(requests);
  })
);

const createSchema = z.object({
  assetId: z.string().min(1),
  description: z.string().trim().min(5, 'Please describe the issue'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  photoUrl: z.string().nullable().optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const asset = unwrapMaybe<any>(
      await supabase.from('Asset').select('*').eq('id', data.assetId).single()
    );
    if (!asset) throw notFound('Asset not found');

    // Employees may only raise requests for assets currently allocated to them.
    if (req.user!.role === 'EMPLOYEE') {
      const mine = unwrap(
        await supabase
          .from('Allocation')
          .select('id')
          .eq('status', 'ACTIVE')
          .eq('holderId', req.user!.id)
          .eq('assetId', data.assetId)
      ) as any[];
      if (mine.length === 0) throw forbidden('You can only raise requests for assets allocated to you');
    }

    const request = unwrap(
      await supabase
        .from('MaintenanceRequest')
        .insert({
          assetId: data.assetId,
          raisedById: req.user!.id,
          description: data.description,
          priority: data.priority ?? 'MEDIUM',
          photoUrl: data.photoUrl ?? null,
          status: 'PENDING',
        })
        .select(requestSelect)
        .single()
    );
    await logActivity(req.user!, {
      action: 'Raised maintenance request',
      entityType: 'Asset',
      entityId: asset.id,
      details: `${asset.assetTag} — ${data.priority ?? 'MEDIUM'} priority`,
    });
    await notifyMany(await getManagerIds(), {
      type: 'MAINTENANCE_REQUESTED',
      title: 'Maintenance request pending',
      message: `${req.user!.name} raised a ${data.priority ?? 'MEDIUM'} priority request for ${asset.assetTag}.`,
      link: '/maintenance',
    });
    res.status(201).json(request);
  })
);

const noteSchema = z.object({ decisionNote: z.string().optional() });

router.post(
  '/:id/approve',
  requireRole('ADMIN', 'ASSET_MANAGER'),
  asyncHandler(async (req, res) => {
    const { decisionNote } = noteSchema.parse(req.body);
    const request = unwrapMaybe<any>(
      await supabase
        .from('MaintenanceRequest')
        .select('*, asset:Asset!MaintenanceRequest_assetId_fkey(id,assetTag,name,status)')
        .eq('id', req.params.id)
        .single()
    );
    if (!request) throw notFound('Request not found');
    if (request.status !== 'PENDING') throw badRequest('This request has already been processed');

    // No multi-statement transaction in supabase-js — run the two writes in order.
    unwrap(
      await supabase
        .from('MaintenanceRequest')
        .update({ status: 'APPROVED', approvedById: req.user!.id, decisionNote: decisionNote ?? null })
        .eq('id', request.id)
        .select()
        .single()
    );
    // Asset flips to Under Maintenance only after approval.
    unwrap(
      await supabase
        .from('Asset')
        .update({ status: 'UNDER_MAINTENANCE' })
        .eq('id', request.assetId)
        .select()
        .single()
    );
    await logActivity(req.user!, {
      action: 'Approved maintenance',
      entityType: 'Asset',
      entityId: request.assetId,
      details: `${request.asset.assetTag}`,
    });
    await notify({
      userId: request.raisedById,
      type: 'MAINTENANCE_APPROVED',
      title: 'Maintenance approved',
      message: `Your maintenance request for ${request.asset.assetTag} was approved.`,
      link: '/maintenance',
    });
    res.json({ message: 'Maintenance approved' });
  })
);

router.post(
  '/:id/reject',
  requireRole('ADMIN', 'ASSET_MANAGER'),
  asyncHandler(async (req, res) => {
    const { decisionNote } = noteSchema.parse(req.body);
    const request = unwrapMaybe<any>(
      await supabase
        .from('MaintenanceRequest')
        .select('*, asset:Asset!MaintenanceRequest_assetId_fkey(id,assetTag,name,status)')
        .eq('id', req.params.id)
        .single()
    );
    if (!request) throw notFound('Request not found');
    if (request.status !== 'PENDING') throw badRequest('This request has already been processed');

    unwrap(
      await supabase
        .from('MaintenanceRequest')
        .update({ status: 'REJECTED', approvedById: req.user!.id, decisionNote: decisionNote ?? null })
        .eq('id', request.id)
        .select()
        .single()
    );
    await logActivity(req.user!, {
      action: 'Rejected maintenance',
      entityType: 'Asset',
      entityId: request.assetId,
      details: `${request.asset.assetTag}`,
    });
    await notify({
      userId: request.raisedById,
      type: 'MAINTENANCE_REJECTED',
      title: 'Maintenance rejected',
      message: `Your maintenance request for ${request.asset.assetTag} was rejected.${decisionNote ? ` Reason: ${decisionNote}` : ''}`,
      link: '/maintenance',
    });
    res.json({ message: 'Maintenance rejected' });
  })
);

const assignSchema = z.object({ technicianName: z.string().trim().min(2, 'Technician name is required') });

router.post(
  '/:id/assign',
  requireRole('ADMIN', 'ASSET_MANAGER'),
  asyncHandler(async (req, res) => {
    const { technicianName } = assignSchema.parse(req.body);
    const request = unwrapMaybe<any>(
      await supabase.from('MaintenanceRequest').select('*').eq('id', req.params.id).single()
    );
    if (!request) throw notFound('Request not found');
    if (request.status !== 'APPROVED') throw badRequest('Approve the request before assigning a technician');
    const updated = unwrap(
      await supabase
        .from('MaintenanceRequest')
        .update({ status: 'TECHNICIAN_ASSIGNED', technicianName })
        .eq('id', request.id)
        .select(requestSelect)
        .single()
    );
    await logActivity(req.user!, {
      action: 'Assigned technician',
      entityType: 'MaintenanceRequest',
      entityId: request.id,
      details: technicianName,
    });
    res.json(updated);
  })
);

router.post(
  '/:id/start',
  requireRole('ADMIN', 'ASSET_MANAGER'),
  asyncHandler(async (req, res) => {
    const request = unwrapMaybe<any>(
      await supabase.from('MaintenanceRequest').select('*').eq('id', req.params.id).single()
    );
    if (!request) throw notFound('Request not found');
    if (!['APPROVED', 'TECHNICIAN_ASSIGNED'].includes(request.status)) {
      throw badRequest('Work can only start after approval / technician assignment');
    }
    const updated = unwrap(
      await supabase
        .from('MaintenanceRequest')
        .update({ status: 'IN_PROGRESS' })
        .eq('id', request.id)
        .select(requestSelect)
        .single()
    );
    res.json(updated);
  })
);

// Default preventive-maintenance interval when the resolver doesn't specify one.
const DEFAULT_MAINTENANCE_INTERVAL_DAYS = 180;

const resolveSchema = z.object({
  resolutionNotes: z.string().trim().min(3, 'Add resolution notes'),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED']).optional(),
  // Configurable interval until the asset's next scheduled maintenance.
  nextMaintenanceInDays: z.coerce.number().int().min(1).max(3650).optional(),
});

router.post(
  '/:id/resolve',
  requireRole('ADMIN', 'ASSET_MANAGER'),
  asyncHandler(async (req, res) => {
    const data = resolveSchema.parse(req.body);
    const request = unwrapMaybe<any>(
      await supabase
        .from('MaintenanceRequest')
        .select('*, asset:Asset!MaintenanceRequest_assetId_fkey(id,assetTag,name,status)')
        .eq('id', req.params.id)
        .single()
    );
    if (!request) throw notFound('Request not found');
    if (['RESOLVED', 'REJECTED', 'PENDING'].includes(request.status)) {
      throw badRequest('This request cannot be resolved from its current state');
    }

    // Sequential writes in place of the former $transaction.
    const resolvedAt = new Date();
    unwrap(
      await supabase
        .from('MaintenanceRequest')
        .update({ status: 'RESOLVED', resolutionNotes: data.resolutionNotes, resolvedAt: resolvedAt.toISOString() })
        .eq('id', request.id)
        .select()
        .single()
    );

    // Core behavior (unchanged): asset returns to Available on resolution,
    // unless it was retired/disposed meanwhile.
    if (request.asset.status === 'UNDER_MAINTENANCE') {
      unwrap(
        await supabase
          .from('Asset')
          .update({ status: 'AVAILABLE', ...(data.condition ? { condition: data.condition } : {}) })
          .eq('id', request.assetId)
          .select()
          .single()
      );
    }

    // Schedule the next preventive maintenance (resolved date + interval).
    // Best-effort: if the nextMaintenanceDueDate column isn't present yet
    // (additive migration not applied), log and continue instead of failing the
    // resolve — this keeps the maintenance flow working pre-migration.
    const intervalDays = data.nextMaintenanceInDays ?? DEFAULT_MAINTENANCE_INTERVAL_DAYS;
    const nextDue = new Date(resolvedAt.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    const dueUpdate = await supabase
      .from('Asset')
      .update({ nextMaintenanceDueDate: nextDue.toISOString() })
      .eq('id', request.assetId);
    if (dueUpdate.error) {
      // eslint-disable-next-line no-console
      console.error('[maintenance] could not set nextMaintenanceDueDate — is the schema migration applied?', dueUpdate.error.message);
    }
    await logActivity(req.user!, {
      action: 'Resolved maintenance',
      entityType: 'Asset',
      entityId: request.assetId,
      details: `${request.asset.assetTag}`,
    });
    await notify({
      userId: request.raisedById,
      type: 'MAINTENANCE_RESOLVED',
      title: 'Maintenance resolved',
      message: `${request.asset.assetTag} — ${request.asset.name} is back in service.`,
      link: '/maintenance',
    });
    res.json({ message: 'Maintenance resolved' });
  })
);

export default router;
