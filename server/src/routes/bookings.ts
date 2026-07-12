import { Router } from 'express';
import { z } from 'zod';
import { supabase, unwrap, unwrapMaybe } from '../lib/supabase';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors';
import { logActivity } from '../services/activity';
import { notify } from '../services/notify';
import { syncBookingStatuses } from '../services/sync';

const router = Router();
router.use(authenticate);

const bookingSelect =
  '*, resource:Asset!Booking_resourceId_fkey(id,assetTag,name,location), bookedBy:User!Booking_bookedById_fkey(id,name,email)';

// Bookable resources (assets flagged shared/bookable and still in service).
router.get(
  '/resources',
  asyncHandler(async (_req, res) => {
    const resources = unwrap(
      await supabase
        .from('Asset')
        .select('id, assetTag, name, location, category:AssetCategory!Asset_categoryId_fkey(name)')
        .eq('isBookable', true)
        .not('status', 'in', '("RETIRED","DISPOSED","LOST")')
        .order('name', { ascending: true })
    );
    res.json(resources);
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    await syncBookingStatuses();
    const { resourceId, mine, status, from, to } = req.query as Record<string, string>;
    let q = supabase.from('Booking').select(bookingSelect);
    if (resourceId) q = q.eq('resourceId', resourceId);
    if (status) q = q.eq('status', status);
    if (mine === 'true') q = q.eq('bookedById', req.user!.id);
    if (from) q = q.gte('startTime', new Date(from).toISOString());
    if (to) q = q.lte('startTime', new Date(to).toISOString());
    const bookings = unwrap(await q.order('startTime', { ascending: true }));
    res.json(bookings);
  })
);

const createSchema = z.object({
  resourceId: z.string().min(1),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  purpose: z.string().optional(),
});

// Helper: does [start,end) overlap an existing active booking? Boundary touching is allowed.
async function findOverlap(resourceId: string, start: Date, end: Date, excludeId?: string) {
  let q = supabase
    .from('Booking')
    .select('id, startTime, endTime, bookedBy:User!Booking_bookedById_fkey(name)')
    .eq('resourceId', resourceId)
    .in('status', ['UPCOMING', 'ONGOING'])
    .lt('startTime', end.toISOString())
    .gt('endTime', start.toISOString());
  if (excludeId) q = q.neq('id', excludeId);
  return unwrap(await q.limit(1).maybeSingle());
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    if (data.endTime <= data.startTime) throw badRequest('End time must be after the start time');
    if (data.startTime < new Date(Date.now() - 60_000)) throw badRequest('You cannot book a slot in the past');

    const resource = unwrapMaybe<any>(
      await supabase.from('Asset').select('*').eq('id', data.resourceId).single()
    );
    if (!resource) throw notFound('Resource not found');
    if (!resource.isBookable) throw badRequest('This asset is not marked as a bookable resource');

    const overlap = await findOverlap(data.resourceId, data.startTime, data.endTime);
    if (overlap) {
      throw conflict(
        `This slot overlaps an existing booking by ${overlap.bookedBy.name} (${new Date(overlap.startTime).toLocaleString()} – ${new Date(overlap.endTime).toLocaleString()}).`
      );
    }

    const now = new Date();
    const status = data.startTime <= now && data.endTime > now ? 'ONGOING' : 'UPCOMING';
    const booking = unwrap(
      await supabase
        .from('Booking')
        .insert({
          resourceId: data.resourceId,
          bookedById: req.user!.id,
          startTime: data.startTime.toISOString(),
          endTime: data.endTime.toISOString(),
          purpose: data.purpose ?? null,
          status,
        })
        .select(bookingSelect)
        .single()
    );

    await logActivity(req.user!, {
      action: 'Booked resource',
      entityType: 'Booking',
      entityId: booking.id,
      details: `${resource.assetTag} — ${resource.name}`,
    });
    await notify({
      userId: req.user!.id,
      type: 'BOOKING_CONFIRMED',
      title: 'Booking confirmed',
      message: `You booked ${resource.name} from ${data.startTime.toLocaleString()}.`,
      link: '/bookings',
    });
    res.status(201).json(booking);
  })
);

const rescheduleSchema = z.object({
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  purpose: z.string().optional(),
});

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = rescheduleSchema.parse(req.body);
    const booking = unwrapMaybe<any>(
      await supabase
        .from('Booking')
        .select('*, resource:Asset!Booking_resourceId_fkey(*)')
        .eq('id', req.params.id)
        .single()
    );
    if (!booking) throw notFound('Booking not found');
    const user = req.user!;
    const canEdit = user.id === booking.bookedById || ['ADMIN', 'ASSET_MANAGER'].includes(user.role);
    if (!canEdit) throw forbidden('You cannot modify this booking');
    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      throw badRequest('This booking can no longer be modified');
    }
    if (data.endTime <= data.startTime) throw badRequest('End time must be after the start time');

    const overlap = await findOverlap(booking.resourceId, data.startTime, data.endTime, booking.id);
    if (overlap) {
      throw conflict(
        `This slot overlaps an existing booking by ${overlap.bookedBy.name} (${new Date(overlap.startTime).toLocaleString()} – ${new Date(overlap.endTime).toLocaleString()}).`
      );
    }

    const updated = unwrap(
      await supabase
        .from('Booking')
        .update({
          startTime: data.startTime.toISOString(),
          endTime: data.endTime.toISOString(),
          purpose: data.purpose ?? booking.purpose,
        })
        .eq('id', booking.id)
        .select(bookingSelect)
        .single()
    );
    await logActivity(user, {
      action: 'Rescheduled booking',
      entityType: 'Booking',
      entityId: booking.id,
      details: `${booking.resource.assetTag}`,
    });
    res.json(updated);
  })
);

router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const booking = unwrapMaybe<any>(
      await supabase
        .from('Booking')
        .select('*, resource:Asset!Booking_resourceId_fkey(*)')
        .eq('id', req.params.id)
        .single()
    );
    if (!booking) throw notFound('Booking not found');
    const user = req.user!;
    const canCancel = user.id === booking.bookedById || ['ADMIN', 'ASSET_MANAGER'].includes(user.role);
    if (!canCancel) throw forbidden('You cannot cancel this booking');
    if (booking.status === 'COMPLETED') throw badRequest('Completed bookings cannot be cancelled');

    const updated = unwrap(
      await supabase
        .from('Booking')
        .update({ status: 'CANCELLED' })
        .eq('id', booking.id)
        .select(bookingSelect)
        .single()
    );
    await logActivity(user, {
      action: 'Cancelled booking',
      entityType: 'Booking',
      entityId: booking.id,
      details: `${booking.resource.assetTag}`,
    });
    await notify({
      userId: booking.bookedById,
      type: 'BOOKING_CANCELLED',
      title: 'Booking cancelled',
      message: `Your booking for ${booking.resource.name} was cancelled.`,
      link: '/bookings',
    });
    res.json(updated);
  })
);

export default router;
