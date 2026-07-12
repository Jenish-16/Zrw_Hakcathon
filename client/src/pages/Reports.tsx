import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import {
  Download,
  Boxes,
  IndianRupee,
  Wrench,
  CalendarDays,
  TrendingUp,
  PieChart as PieIcon,
  Layers,
  Building2,
  Flame,
  Moon,
  AlertTriangle,
} from 'lucide-react';
import { useApi } from '../lib/useApi';
import { api, errorMessage } from '../lib/api';
import { Card, Spinner, PageHeader, Badge, Button, EmptyState } from '../components/ui';
import { fmtCurrency, fmtDate, titleCase } from '../lib/format';
import { conditionStyle, assetStatusStyle } from '../lib/status';

interface ReportData {
  mostUsed: { id: string; assetTag: string; name: string; category: string; status: string; timesAllocated: number }[];
  idle: { id: string; assetTag: string; name: string; category: string; status: string; timesAllocated: number }[];
  maintenanceByCategory: { category: string; count: number }[];
  nearingRetirement: { id: string; assetTag: string; name: string; condition: string; acquisitionDate: string | null; category: string }[];
  departmentAllocation: { department: string; count: number }[];
  heatmap: { day: number; hour: number; count: number }[];
  categoryDistribution: { category: string; count: number }[];
  totals: { totalAssets: number; totalValue: number; totalMaintenance: number; totalBookings: number };
}

const PALETTE = ['#1f42f5', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f43f5e'];
const BRAND = '#1f42f5';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 – 20:00

export default function Reports() {
  const { data, loading } = useApi<ReportData>('/reports/overview');
  const [exporting, setExporting] = useState<string | null>(null);

  const exportCsv = async (type: 'assets' | 'allocations' | 'maintenance') => {
    setExporting(type);
    try {
      const res = await api.get(`/reports/export?type=${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${titleCase(type)} report downloaded`);
    } catch (err) {
      toast.error(errorMessage(err, 'Export failed'));
    } finally {
      setExporting(null);
    }
  };

  if (loading || !data) return <Spinner label="Crunching analytics..." />;

  const maxHeat = Math.max(1, ...data.heatmap.map((h) => h.count));
  const heatLookup = new Map(data.heatmap.map((h) => [`${h.day}-${h.hour}`, h.count]));

  const kpis = [
    { label: 'Total Assets', value: data.totals.totalAssets, icon: <Boxes className="h-5 w-5" />, tone: 'text-brand-600 bg-brand-50' },
    { label: 'Total Value', value: fmtCurrency(data.totals.totalValue), icon: <IndianRupee className="h-5 w-5" />, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Maintenance Requests', value: data.totals.totalMaintenance, icon: <Wrench className="h-5 w-5" />, tone: 'text-amber-600 bg-amber-50' },
    { label: 'Bookings', value: data.totals.totalBookings, icon: <CalendarDays className="h-5 w-5" />, tone: 'text-violet-600 bg-violet-50' },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Actionable operational insight across your asset portfolio."
        actions={
          <>
            <Button variant="secondary" size="sm" loading={exporting === 'assets'} onClick={() => exportCsv('assets')}>
              <Download className="h-4 w-4" /> Assets CSV
            </Button>
            <Button variant="secondary" size="sm" loading={exporting === 'allocations'} onClick={() => exportCsv('allocations')}>
              <Download className="h-4 w-4" /> Allocations CSV
            </Button>
            <Button variant="secondary" size="sm" loading={exporting === 'maintenance'} onClick={() => exportCsv('maintenance')}>
              <Download className="h-4 w-4" /> Maintenance CSV
            </Button>
          </>
        }
      />

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((c) => (
          <Card key={c.label} className="p-4">
            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${c.tone}`}>{c.icon}</div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{c.value}</p>
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Most used assets */}
        <ChartCard icon={<TrendingUp className="h-4 w-4" />} title="Most Used Assets" subtitle="By number of allocations">
          {data.mostUsed.length === 0 ? (
            <EmptyState title="No allocation data" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.mostUsed} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="timesAllocated" name="Allocations" fill={BRAND} radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Category distribution */}
        <ChartCard icon={<PieIcon className="h-4 w-4" />} title="Category Distribution" subtitle="Assets per category">
          {data.categoryDistribution.length === 0 ? (
            <EmptyState title="No categories" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.categoryDistribution}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    label={(e) => `${e.category} (${e.count})`}
                    labelLine={false}
                  >
                    {data.categoryDistribution.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Maintenance by category */}
        <ChartCard icon={<Layers className="h-4 w-4" />} title="Maintenance Frequency" subtitle="Requests by asset category">
          {data.maintenanceByCategory.length === 0 ? (
            <EmptyState title="No maintenance data" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.maintenanceByCategory} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="count" name="Requests" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Department allocation */}
        <ChartCard icon={<Building2 className="h-4 w-4" />} title="Department-wise Allocation" subtitle="Active allocations by department">
          {data.departmentAllocation.length === 0 ? (
            <EmptyState title="No allocations" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.departmentAllocation} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="department" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="count" name="Assets" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Booking heatmap */}
      <ChartCard className="mt-4" icon={<Flame className="h-4 w-4" />} title="Resource Booking Heatmap" subtitle="Peak usage windows (by weekday & hour)">
        {data.heatmap.length === 0 ? (
          <EmptyState title="No bookings yet" />
        ) : (
          <div className="overflow-x-auto pt-2">
            <div className="min-w-[720px]">
              <div className="flex">
                <div className="w-12" />
                {HOURS.map((h) => (
                  <div key={h} className="flex-1 text-center text-[10px] font-medium text-slate-400">{h}:00</div>
                ))}
              </div>
              {DAYS.map((day, di) => (
                <div key={day} className="flex items-center">
                  <div className="w-12 py-1 text-xs font-semibold text-slate-500">{day}</div>
                  {HOURS.map((h) => {
                    const count = heatLookup.get(`${di}-${h}`) ?? 0;
                    const opacity = count === 0 ? 0 : 0.15 + (count / maxHeat) * 0.85;
                    return (
                      <div key={h} className="flex-1 px-0.5 py-0.5">
                        <div
                          title={`${day} ${h}:00 — ${count} booking${count === 1 ? '' : 's'}`}
                          className="flex h-7 items-center justify-center rounded-md text-[10px] font-semibold"
                          style={{
                            backgroundColor: count === 0 ? '#f1f5f9' : `rgba(31,66,245,${opacity})`,
                            color: opacity > 0.5 ? '#fff' : '#334155',
                          }}
                        >
                          {count || ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </ChartCard>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Idle assets */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Moon className="h-4 w-4 text-slate-400" />
            <h3 className="font-semibold text-slate-900">Idle Assets</h3>
            <Badge className="bg-slate-100 text-slate-600 ring-slate-500/20">{data.idle.length}</Badge>
          </div>
          {data.idle.length === 0 ? (
            <EmptyState title="Every asset has been used 🎉" />
          ) : (
            <ul className="divide-y divide-surface-border">
              {data.idle.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{a.name}</p>
                    <p className="font-mono text-xs text-slate-400">{a.assetTag} · {a.category}</p>
                  </div>
                  <Badge className={assetStatusStyle[a.status] ?? 'bg-slate-100 text-slate-600 ring-slate-500/20'}>{titleCase(a.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Nearing retirement */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="font-semibold text-slate-900">Nearing Retirement / Due for Maintenance</h3>
            <Badge className="bg-amber-50 text-amber-700 ring-amber-600/20">{data.nearingRetirement.length}</Badge>
          </div>
          {data.nearingRetirement.length === 0 ? (
            <EmptyState title="Nothing needs attention" />
          ) : (
            <ul className="divide-y divide-surface-border">
              {data.nearingRetirement.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{a.name}</p>
                    <p className="font-mono text-xs text-slate-400">
                      {a.assetTag} · {a.category} · acquired {fmtDate(a.acquisitionDate)}
                    </p>
                  </div>
                  <Badge className={conditionStyle[a.condition] ?? 'bg-slate-100 text-slate-600 ring-slate-500/20'}>{titleCase(a.condition)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  icon,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-slate-400">{icon}</span>
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}
