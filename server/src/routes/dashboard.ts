import { Router } from 'express';
import { supabase, unwrap } from '../lib/supabase';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { syncBookingStatuses } from '../services/sync';

const router = Router();
router.use(authenticate);

// Resolve a head+count query to a plain number (throws on error).
async function n(q: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}
const head = (table: string) => supabase.from(table).select('*', { count: 'exact', head: true });

router.get(
  '/',
  // The org-wide dashboard is not for employees — they land on their own assets.
  requireRole('ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'),
  asyncHandler(async (req, res) => {
    await syncBookingStatuses();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nowIso = now.toISOString();
    const user = req.user!;

    const [
      assetsAvailable,
      assetsAllocated,
      underMaintenance,
      maintenanceToday,
      activeBookings,
      pendingTransfers,
      totalAssets,
      allStatuses,
      overdueRaw,
      upcomingReturnsRaw,
      recentActivity,
      myAssets,
      myBookings,
      myOpenMaintenance,
    ] = await Promise.all([
      n(head('Asset').eq('status', 'AVAILABLE')),
      n(head('Asset').eq('status', 'ALLOCATED')),
      n(head('Asset').eq('status', 'UNDER_MAINTENANCE')),
      n(head('MaintenanceRequest').gte('createdAt', startOfToday.toISOString())),
      n(head('Booking').in('status', ['UPCOMING', 'ONGOING'])),
      n(head('TransferRequest').eq('status', 'REQUESTED')),
      n(head('Asset')),
      // status breakdown — aggregate in JS
      Promise.resolve(unwrap(await supabase.from('Asset').select('status'))),
      Promise.resolve(
        unwrap(
          await supabase
            .from('Allocation')
            .select(
              '*, asset:Asset!Allocation_assetId_fkey(assetTag,name), holder:User!Allocation_holderId_fkey(id,name)'
            )
            .eq('status', 'ACTIVE')
            .lt('expectedReturnDate', nowIso)
            .order('expectedReturnDate', { ascending: true })
            .limit(25)
        )
      ),
      Promise.resolve(
        unwrap(
          await supabase
            .from('Allocation')
            .select(
              '*, asset:Asset!Allocation_assetId_fkey(assetTag,name), holder:User!Allocation_holderId_fkey(id,name)'
            )
            .eq('status', 'ACTIVE')
            .gte('expectedReturnDate', nowIso)
            .lte('expectedReturnDate', in7Days.toISOString())
            .order('expectedReturnDate', { ascending: true })
            .limit(25)
        )
      ),
      Promise.resolve(
        unwrap(await supabase.from('ActivityLog').select('*').order('createdAt', { ascending: false }).limit(10))
      ),
      n(head('Allocation').eq('status', 'ACTIVE').eq('holderId', user.id)),
      n(head('Booking').eq('bookedById', user.id).in('status', ['UPCOMING', 'ONGOING'])),
      n(head('MaintenanceRequest').eq('raisedById', user.id).not('status', 'in', '(RESOLVED,REJECTED)')),
    ]);

    const statusMap = new Map<string, number>();
    (allStatuses as { status: string }[]).forEach((a) =>
      statusMap.set(a.status, (statusMap.get(a.status) ?? 0) + 1)
    );
    const statusBreakdown = [...statusMap.entries()].map(([status, count]) => ({ status, count }));

    res.json({
      kpis: {
        assetsAvailable,
        assetsAllocated,
        underMaintenance,
        maintenanceToday,
        activeBookings,
        pendingTransfers,
        upcomingReturns: (upcomingReturnsRaw as unknown[]).length,
        overdueReturns: (overdueRaw as unknown[]).length,
        totalAssets,
      },
      statusBreakdown,
      overdue: overdueRaw,
      upcomingReturns: upcomingReturnsRaw,
      recentActivity,
      personal: { myAssets, myBookings, myOpenMaintenance },
    });
  })
);

export default router;
