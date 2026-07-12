import { Router } from 'express';
import { z } from 'zod';
import { supabase, unwrap, unwrapMaybe } from '../lib/supabase';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { notFound } from '../utils/errors';
import { logActivity } from '../services/activity';

const router = Router();
router.use(authenticate);

// Managers-only analytics.
router.get(
  '/overview',
  requireRole('ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'),
  asyncHandler(async (_req, res) => {
    const now = new Date();

    // Utilization: how many times each asset has been allocated.
    const allAllocs = unwrap(await supabase.from('Allocation').select('assetId'));
    const allocCountByAsset = new Map<string, number>();
    (allAllocs as { assetId: string }[]).forEach((a) =>
      allocCountByAsset.set(a.assetId, (allocCountByAsset.get(a.assetId) ?? 0) + 1)
    );
    const assets = unwrap(
      await supabase
        .from('Asset')
        .select(
          '*, category:AssetCategory!Asset_categoryId_fkey(name), department:Department!Asset_departmentId_fkey(name)'
        )
    ) as any[];

    const utilization = assets
      .map((a) => ({
        id: a.id,
        assetTag: a.assetTag,
        name: a.name,
        category: a.category.name,
        status: a.status,
        timesAllocated: allocCountByAsset.get(a.id) ?? 0,
      }))
      .sort((x, y) => y.timesAllocated - x.timesAllocated);

    const mostUsed = utilization.slice(0, 8);
    const idle = utilization.filter((u) => u.timesAllocated === 0).slice(0, 8);

    // Maintenance frequency — aggregated both by category and per individual asset.
    const maintenance = unwrap(
      await supabase
        .from('MaintenanceRequest')
        .select(
          'assetId, asset:Asset!MaintenanceRequest_assetId_fkey(assetTag,name,category:AssetCategory!Asset_categoryId_fkey(name))'
        )
    ) as any[];
    const maintByCategoryMap = new Map<string, number>();
    const maintByAssetCount = new Map<string, number>();
    const assetInfo = new Map<string, { assetTag: string; name: string; category: string }>();
    maintenance.forEach((m) => {
      const category = m.asset?.category?.name ?? 'Uncategorized';
      maintByCategoryMap.set(category, (maintByCategoryMap.get(category) ?? 0) + 1);
      maintByAssetCount.set(m.assetId, (maintByAssetCount.get(m.assetId) ?? 0) + 1);
      if (!assetInfo.has(m.assetId)) {
        assetInfo.set(m.assetId, {
          assetTag: m.asset?.assetTag ?? '—',
          name: m.asset?.name ?? 'Unknown asset',
          category,
        });
      }
    });
    const maintenanceByCategory = [...maintByCategoryMap.entries()].map(([category, count]) => ({ category, count }));
    const maintenanceByAsset = [...maintByAssetCount.entries()]
      .map(([id, count]) => ({ id, count, ...assetInfo.get(id)! }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Assets nearing retirement (>4 years old) or in poor condition.
    const fourYearsAgo = new Date(now.getFullYear() - 4, now.getMonth(), now.getDate());
    const nearingRetirement = assets
      .filter(
        (a) =>
          (a.acquisitionDate && new Date(a.acquisitionDate).getTime() < fourYearsAgo.getTime()) ||
          a.condition === 'POOR' ||
          a.condition === 'DAMAGED'
      )
      .filter((a) => !['RETIRED', 'DISPOSED'].includes(a.status))
      .map((a) => ({
        id: a.id,
        assetTag: a.assetTag,
        name: a.name,
        condition: a.condition,
        acquisitionDate: a.acquisitionDate,
        category: a.category.name,
      }))
      .slice(0, 20);

    // Department-wise allocation summary (active allocations by holder's department).
    const activeAllocations = unwrap(
      await supabase
        .from('Allocation')
        .select('holder:User!Allocation_holderId_fkey(department:Department!User_departmentId_fkey(name))')
        .eq('status', 'ACTIVE')
    ) as any[];
    const deptMap = new Map<string, number>();
    activeAllocations.forEach((al) => {
      const key = al.holder.department?.name ?? 'Unassigned';
      deptMap.set(key, (deptMap.get(key) ?? 0) + 1);
    });
    const departmentAllocation = [...deptMap.entries()].map(([department, count]) => ({ department, count }));

    // Booking heatmap: weekday x hour.
    const bookings = unwrap(await supabase.from('Booking').select('startTime').neq('status', 'CANCELLED')) as {
      startTime: string;
    }[];
    const heatmap: { day: number; hour: number; count: number }[] = [];
    const heatMap = new Map<string, number>();
    bookings.forEach((b) => {
      const start = new Date(b.startTime);
      const d = start.getDay();
      const h = start.getHours();
      const key = `${d}-${h}`;
      heatMap.set(key, (heatMap.get(key) ?? 0) + 1);
    });
    heatMap.forEach((count, key) => {
      const [day, hour] = key.split('-').map(Number);
      heatmap.push({ day, hour, count });
    });

    // Category distribution (asset count per category).
    const catCountById = new Map<string, number>();
    assets.forEach((a) => catCountById.set(a.categoryId, (catCountById.get(a.categoryId) ?? 0) + 1));
    const categories = unwrap(await supabase.from('AssetCategory').select('id, name')) as {
      id: string;
      name: string;
    }[];
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    const categoryDistribution = [...catCountById.entries()].map(([categoryId, count]) => ({
      category: catName.get(categoryId) ?? 'Unknown',
      count,
    }));

    // Assets due for maintenance — driven by the real nextMaintenanceDueDate
    // (kept separate from the age/condition "nearing retirement" heuristic).
    const dayMs = 24 * 60 * 60 * 1000;
    const dueForMaintenance = assets
      .filter((a) => a.nextMaintenanceDueDate && !['RETIRED', 'DISPOSED'].includes(a.status))
      .map((a) => ({
        id: a.id,
        assetTag: a.assetTag,
        name: a.name,
        category: a.category.name,
        status: a.status,
        nextMaintenanceDueDate: a.nextMaintenanceDueDate,
        daysUntilDue: Math.floor((new Date(a.nextMaintenanceDueDate).getTime() - now.getTime()) / dayMs),
      }))
      .filter((a) => a.daysUntilDue <= 60) // overdue or due within 60 days
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
      .slice(0, 30);

    // Predictive maintenance risk score: weighted blend of maintenance
    // frequency (relative to the busiest asset), age, and condition.
    const maxMaint = Math.max(1, ...maintByAssetCount.values());
    const conditionWeight: Record<string, number> = { NEW: 0, GOOD: 0.25, FAIR: 0.5, POOR: 0.8, DAMAGED: 1 };
    const assetsAtRisk = assets
      .filter((a) => !['RETIRED', 'DISPOSED'].includes(a.status))
      .map((a) => {
        const timesMaintained = maintByAssetCount.get(a.id) ?? 0;
        const freqNorm = timesMaintained / maxMaint; // 0..1, relative to portfolio
        const ageYears = a.acquisitionDate
          ? (now.getTime() - new Date(a.acquisitionDate).getTime()) / (365.25 * dayMs)
          : 0;
        const ageNorm = Math.min(Math.max(ageYears, 0) / 6, 1); // cap at 6 years
        const condNorm = conditionWeight[a.condition] ?? 0.25;
        const riskScore = Math.round((0.4 * freqNorm + 0.3 * ageNorm + 0.3 * condNorm) * 100);
        return {
          id: a.id,
          assetTag: a.assetTag,
          name: a.name,
          category: a.category.name,
          condition: a.condition,
          status: a.status,
          timesMaintained,
          ageYears: Math.round(ageYears * 10) / 10,
          riskScore,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 15);

    res.json({
      mostUsed,
      idle,
      maintenanceByCategory,
      maintenanceByAsset,
      nearingRetirement,
      dueForMaintenance,
      assetsAtRisk,
      departmentAllocation,
      heatmap,
      categoryDistribution,
      totals: {
        totalAssets: assets.length,
        totalValue: assets.reduce((sum, a) => sum + (a.acquisitionCost ?? 0), 0),
        totalMaintenance: maintenance.length,
        totalBookings: bookings.length,
      },
    });
  })
);

// Manual override for an asset's next scheduled maintenance date. Lives here
// (rather than the asset route) because it's a reporting/scheduling concern;
// managers only. Passing null clears the schedule.
const maintenanceDueSchema = z.object({
  nextMaintenanceDueDate: z.coerce.date().nullable(),
});

router.patch(
  '/assets/:id/maintenance-due',
  requireRole('ADMIN', 'ASSET_MANAGER'),
  asyncHandler(async (req, res) => {
    const { nextMaintenanceDueDate } = maintenanceDueSchema.parse(req.body);
    const asset = unwrapMaybe<{ id: string; assetTag: string }>(
      await supabase.from('Asset').select('id, assetTag').eq('id', req.params.id).single()
    );
    if (!asset) throw notFound('Asset not found');

    const iso = nextMaintenanceDueDate ? nextMaintenanceDueDate.toISOString() : null;
    unwrap(
      await supabase.from('Asset').update({ nextMaintenanceDueDate: iso }).eq('id', req.params.id).select('id').single()
    );
    await logActivity(req.user!, {
      action: iso ? 'Scheduled next maintenance' : 'Cleared maintenance schedule',
      entityType: 'Asset',
      entityId: asset.id,
      details: `${asset.assetTag}${iso ? ` → ${iso.slice(0, 10)}` : ''}`,
    });
    res.json({ ok: true, nextMaintenanceDueDate: iso });
  })
);

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  rows.forEach((r) => lines.push(headers.map((h) => escape(r[h])).join(',')));
  return lines.join('\n');
}

const day = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : '');

router.get(
  '/export',
  requireRole('ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'),
  asyncHandler(async (req, res) => {
    const type = (req.query.type as string) ?? 'assets';
    let rows: Record<string, unknown>[] = [];
    let filename = 'assetflow-report.csv';

    if (type === 'assets') {
      const assets = unwrap(
        await supabase
          .from('Asset')
          .select(
            '*, category:AssetCategory!Asset_categoryId_fkey(name), department:Department!Asset_departmentId_fkey(name), allocations:Allocation!Allocation_assetId_fkey(status, holder:User!Allocation_holderId_fkey(name))'
          )
          .order('assetTag', { ascending: true })
      ) as any[];
      rows = assets.map((a) => {
        const active = (a.allocations ?? []).find((al: any) => al.status === 'ACTIVE');
        return {
          AssetTag: a.assetTag,
          Name: a.name,
          Category: a.category.name,
          Status: a.status,
          Condition: a.condition,
          Location: a.location ?? '',
          Department: a.department?.name ?? '',
          CurrentHolder: active?.holder?.name ?? '',
          SerialNumber: a.serialNumber ?? '',
          AcquisitionCost: a.acquisitionCost ?? '',
          AcquisitionDate: day(a.acquisitionDate),
        };
      });
      filename = 'assets.csv';
    } else if (type === 'allocations') {
      const allocations = unwrap(
        await supabase
          .from('Allocation')
          .select(
            '*, asset:Asset!Allocation_assetId_fkey(assetTag,name), holder:User!Allocation_holderId_fkey(name)'
          )
          .order('allocatedAt', { ascending: false })
      ) as any[];
      rows = allocations.map((a) => ({
        AssetTag: a.asset.assetTag,
        Asset: a.asset.name,
        Holder: a.holder.name,
        Status: a.status,
        AllocatedAt: day(a.allocatedAt),
        ExpectedReturn: day(a.expectedReturnDate),
        ReturnedAt: day(a.returnedAt),
      }));
      filename = 'allocations.csv';
    } else if (type === 'maintenance') {
      const maintenance = unwrap(
        await supabase
          .from('MaintenanceRequest')
          .select(
            '*, asset:Asset!MaintenanceRequest_assetId_fkey(assetTag,name), raisedBy:User!MaintenanceRequest_raisedById_fkey(name)'
          )
          .order('createdAt', { ascending: false })
      ) as any[];
      rows = maintenance.map((m) => ({
        AssetTag: m.asset.assetTag,
        Asset: m.asset.name,
        RaisedBy: m.raisedBy.name,
        Priority: m.priority,
        Status: m.status,
        Description: m.description,
        CreatedAt: day(m.createdAt),
      }));
      filename = 'maintenance.csv';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(toCsv(rows));
  })
);

export default router;
