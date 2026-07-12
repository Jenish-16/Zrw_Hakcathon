import { supabase, unwrap } from '../lib/supabase';
import { notify } from './notify';

/**
 * Find ACTIVE allocations past their expected return date and create an
 * OVERDUE_RETURN notification for each one that hasn't been notified yet.
 * Dedupe uses Notification.entityId = allocation id, so re-running never
 * spams the same allocation twice. Never throws (safe for background use).
 *
 * Returns { checked, notified } counts for the caller.
 */
export async function checkOverdueAllocations(): Promise<{ checked: number; notified: number }> {
  try {
    const overdue = unwrap(
      await supabase
        .from('Allocation')
        .select(
          '*, ' +
            'asset:Asset!Allocation_assetId_fkey(id,assetTag,name), ' +
            'holder:User!Allocation_holderId_fkey(id,name), ' +
            'holderDepartment:Department!Allocation_holderDepartmentId_fkey(id,name,headId)'
        )
        .eq('status', 'ACTIVE')
        .lt('expectedReturnDate', new Date().toISOString())
    ) as any[];

    if (overdue.length === 0) return { checked: 0, notified: 0 };

    // Which of these allocations were already notified?
    const { data: existing, error } = await supabase
      .from('Notification')
      .select('entityId')
      .eq('type', 'OVERDUE_RETURN')
      .in('entityId', overdue.map((a) => a.id));
    if (error) throw error;
    const alreadyNotified = new Set((existing ?? []).map((n) => n.entityId));

    let notified = 0;
    for (const a of overdue) {
      if (alreadyNotified.has(a.id)) continue;
      // Employee allocations notify the holder; department allocations notify
      // the department head (if one is set).
      const recipient = a.holder?.id ?? a.holderDepartment?.headId ?? null;
      if (!recipient) continue;
      await notify({
        userId: recipient,
        type: 'OVERDUE_RETURN',
        title: 'Asset return overdue',
        message: `${a.asset.assetTag} — ${a.asset.name} was due back on ${new Date(a.expectedReturnDate).toLocaleDateString()}. Please arrange its return.`,
        link: '/allocations?overdue=true',
        entityId: a.id,
      });
      notified += 1;
    }
    return { checked: overdue.length, notified };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[overdue] check failed', err);
    return { checked: 0, notified: 0 };
  }
}
