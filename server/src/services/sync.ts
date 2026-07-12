import { supabase } from '../lib/supabase';

/**
 * Roll booking statuses forward based on the current time.
 * UPCOMING -> ONGOING once started, ONGOING/UPCOMING -> COMPLETED once ended.
 * CANCELLED bookings are never touched. Safe to call on any read.
 *
 * Note: supabase-js has no multi-statement transaction, so the two updates run
 * sequentially. They target disjoint rows (COMPLETED by endTime, then ONGOING
 * by an open time window), so the end result is equivalent.
 */
export async function syncBookingStatuses(): Promise<void> {
  const now = new Date().toISOString();

  const completed = await supabase
    .from('Booking')
    .update({ status: 'COMPLETED' })
    .in('status', ['UPCOMING', 'ONGOING'])
    .lte('endTime', now);
  if (completed.error) throw completed.error;

  const ongoing = await supabase
    .from('Booking')
    .update({ status: 'ONGOING' })
    .eq('status', 'UPCOMING')
    .lte('startTime', now)
    .gt('endTime', now);
  if (ongoing.error) throw ongoing.error;
}
