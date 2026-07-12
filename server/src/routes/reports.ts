import { Router } from 'express';
import { supabase, unwrap } from '../lib/supabase';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';

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

    // Maintenance frequency by category.
    const maintenance = unwrap(
      await supabase
        .from('MaintenanceRequest')
        .select('asset:Asset!MaintenanceRequest_assetId_fkey(category:AssetCategory!Asset_categoryId_fkey(name))')
    ) as any[];
    const maintByCategoryMap = new Map<string, number>();
    maintenance.forEach((m) => {
      const key = m.asset.category.name;
      maintByCategoryMap.set(key, (maintByCategoryMap.get(key) ?? 0) + 1);
    });
    const maintenanceByCategory = [...maintByCategoryMap.entries()].map(([category, count]) => ({ category, count }));

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

    res.json({
      mostUsed,
      idle,
      maintenanceByCategory,
      nearingRetirement,
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
