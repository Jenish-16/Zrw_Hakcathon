import { supabase, unwrap } from '../lib/supabase';
import { notify } from './notify';

/**
 * How soon before a slot starts we send the reminder. 30 minutes gives the
 * booker useful lead time without firing so early the reminder feels stale.
 * Named constant (not a magic number) so the window is easy to tune.
 */
const REMINDER_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Find UPCOMING bookings whose startTime falls within the next
 * REMINDER_WINDOW_MS and send each booker a one-time BOOKING_REMINDER.
 * Dedupe uses Notification.entityId = booking id (type BOOKING_REMINDER), so
 * re-running never reminds the same booking twice. Never throws (safe for
 * background use). Mirrors checkOverdueAllocations in ./overdue.ts.
 *
 * Returns { checked, notified } counts for the caller.
 */
export async function checkUpcomingBookingReminders(): Promise<{ checked: number; notified: number }> {
  try {
    const now = Date.now();
    const windowEnd = new Date(now + REMINDER_WINDOW_MS).toISOString();
    const upcoming = unwrap(
      await supabase
        .from('Booking')
        .select('*, resource:Asset!Booking_resourceId_fkey(id,assetTag,name,location)')
        .eq('status', 'UPCOMING')
        .gte('startTime', new Date(now).toISOString())
        .lte('startTime', windowEnd)
    ) as any[];

    if (upcoming.length === 0) return { checked: 0, notified: 0 };

    // Which of these bookings were already reminded?
    const { data: existing, error } = await supabase
      .from('Notification')
      .select('entityId')
      .eq('type', 'BOOKING_REMINDER')
      .in('entityId', upcoming.map((b) => b.id));
    if (error) throw error;
    const alreadyNotified = new Set((existing ?? []).map((n) => n.entityId));

    let notified = 0;
    for (const b of upcoming) {
      if (alreadyNotified.has(b.id)) continue;
      await notify({
        userId: b.bookedById,
        type: 'BOOKING_REMINDER',
        title: 'Upcoming booking reminder',
        message: `Your booking for ${b.resource.assetTag} — ${b.resource.name} starts at ${new Date(b.startTime).toLocaleString()}.`,
        link: '/bookings',
        entityId: b.id,
      });
      notified += 1;
    }
    return { checked: upcoming.length, notified };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[bookingReminder] check failed', err);
    return { checked: 0, notified: 0 };
  }
}
