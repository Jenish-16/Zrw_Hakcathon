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
  CalendarClock,
  ShieldAlert,
  ArrowUpDown,
  X,
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
  maintenanceByAsset: { id: string; assetTag: string; name: string; category: string; count: number }[];
  nearingRetirement: { id: string; assetTag: string; name: string; condition: string; acquisitionDate: string | null; category: string }[];
  dueForMaintenance: { id: string; assetTag: string; name: string; category: string; status: string; nextMaintenanceDueDate: string; daysUntilDue: number }[];
  assetsAtRisk: { id: string; assetTag: string; name: string; category: string; condition: string; status: string; timesMaintained: number; ageYears: number; riskScore: number }[];
  departmentAllocation: { department: string; count: number }[];
  heatmap: { day: number; hour: number; count: number }[];
  categoryDistribution: { category: string; count: number }[];
  totals: { totalAssets: number; totalValue: number; totalMaintenance: number; totalBookings: number };
}

// Fixed categorical order (validated palette) — extras fold into "Other" gray.
const CATEGORICAL = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834'];
const OTHER = '#c3c2b7';
const MEASURE_BLUE = '#2a78d6'; // single-measure bars use one hue
// Sequential blue ramp for the heatmap (light → dark)
const HEAT_RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#0d366b'];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 – 20:00

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#191713',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    color: '#f6f5f1',
    boxShadow: '0 8px 24px -8px rgba(19,18,17,.35)',
  },
  labelStyle: { color: '#b5b2a9', fontWeight: 600 },
  itemStyle: { color: '#f6f5f1' },
} as const;

const AXIS_TICK = { fontSize: 11, fill: '#8a8880' } as const;
const BAR_CURSOR = { fill: 'rgba(25,23,19,0.04)' } as const;

export default function Reports() {
  const { data, loading, refetch } = useApi<ReportData>('/reports/overview');
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

  if (loading || !data) return <Spinner label="Loading reports…" />;

  const maxHeat = Math.max(1, ...data.heatmap.map((h) => h.count));
  const heatLookup = new Map(data.heatmap.map((h) => [`${h.day}-${h.hour}`, h.count]));
  const heatColor = (count: number) => {
    if (count === 0) return '#f6f5f1';
    const idx = Math.min(HEAT_RAMP.length - 1, Math.ceil((count / maxHeat) * HEAT_RAMP.length) - 1);
    return HEAT_RAMP[idx];
  };
  const heatInk = (count: number) => {
    if (count === 0) return '#8a8880';
    const idx = Math.min(HEAT_RAMP.length - 1, Math.ceil((count / maxHeat) * HEAT_RAMP.length) - 1);
    return idx >= 3 ? '#ffffff' : '#191713';
  };

  const categoryTotal = data.categoryDistribution.reduce((s, c) => s + c.count, 0);

  const kpis = [
    { label: 'Total assets', value: String(data.totals.totalAssets), icon: <Boxes className="h-4 w-4" /> },
    { label: 'Total value', value: fmtCurrency(data.totals.totalValue), icon: <IndianRupee className="h-4 w-4" /> },
    { label: 'Maintenance requests', value: String(data.totals.totalMaintenance), icon: <Wrench className="h-4 w-4" /> },
    { label: 'Bookings', value: String(data.totals.totalBookings), icon: <CalendarDays className="h-4 w-4" /> },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Operational insight across the asset portfolio."
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((c) => (
          <Card key={c.label} className="p-4">
            <div className="flex items-center justify-between">
              <p className="micro-label">{c.label}</p>
              <span className="text-ink-300">{c.icon}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-ink-900">{c.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Most used assets */}
        <ChartCard icon={<TrendingUp className="h-4 w-4" />} title="Most used assets" subtitle="By number of allocations">
          {data.mostUsed.length === 0 ? (
            <EmptyState title="No allocation data" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.mostUsed} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="0" horizontal={false} stroke="#e1e0d9" />
                  <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={130} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} cursor={BAR_CURSOR} />
                  <Bar dataKey="timesAllocated" name="Allocations" fill={MEASURE_BLUE} radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Category distribution */}
        <ChartCard icon={<PieIcon className="h-4 w-4" />} title="Category distribution" subtitle="Assets per category">
          {data.categoryDistribution.length === 0 ? (
            <EmptyState title="No categories" />
          ) : (
            <div className="flex h-72 flex-col items-center gap-4 sm:flex-row">
              <div className="relative h-48 w-48 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.categoryDistribution}
                      dataKey="count"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius="62%"
                      outerRadius="80%"
                      paddingAngle={2}
                      stroke="#fcfcfb"
                      strokeWidth={2}
                    >
                      {data.categoryDistribution.map((_, i) => (
                        <Cell key={i} fill={i < CATEGORICAL.length ? CATEGORICAL[i] : OTHER} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-semibold tabular-nums text-ink-900">{categoryTotal}</p>
                  <p className="micro-label">Assets</p>
                </div>
              </div>
              <ul className="w-full min-w-0 flex-1 space-y-1.5 overflow-y-auto">
                {data.categoryDistribution.map((c, i) => (
                  <li key={c.category} className="flex items-center gap-2 text-[13px]">
                    <span
                      aria-hidden
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: i < CATEGORICAL.length ? CATEGORICAL[i] : OTHER }}
                    />
                    <span className="min-w-0 flex-1 truncate text-ink-600">{c.category}</span>
                    <span className="font-mono tabular-nums text-ink-800">{c.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>

        {/* Maintenance by category */}
        <ChartCard icon={<Layers className="h-4 w-4" />} title="Maintenance frequency" subtitle="Requests by asset category">
          {data.maintenanceByCategory.length === 0 ? (
            <EmptyState title="No maintenance data" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.maintenanceByCategory} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="#e1e0d9" />
                  <XAxis dataKey="category" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} cursor={BAR_CURSOR} />
                  <Bar dataKey="count" name="Requests" fill={MEASURE_BLUE} radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Maintenance by asset */}
        <ChartCard icon={<Wrench className="h-4 w-4" />} title="Maintenance frequency by asset" subtitle="Top assets by number of requests">
          {data.maintenanceByAsset.length === 0 ? (
            <EmptyState title="No maintenance data" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.maintenanceByAsset} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="0" horizontal={false} stroke="#e1e0d9" />
                  <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={130} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} cursor={BAR_CURSOR} />
                  <Bar dataKey="count" name="Requests" fill={MEASURE_BLUE} radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Department allocation */}
        <ChartCard icon={<Building2 className="h-4 w-4" />} title="Department-wise allocation" subtitle="Active allocations by department">
          {data.departmentAllocation.length === 0 ? (
            <EmptyState title="No allocations" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.departmentAllocation} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="#e1e0d9" />
                  <XAxis dataKey="department" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} cursor={BAR_CURSOR} />
                  <Bar dataKey="count" name="Assets" fill={MEASURE_BLUE} radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Booking heatmap */}
      <ChartCard className="mt-4" icon={<Flame className="h-4 w-4" />} title="Resource booking heatmap" subtitle="Peak usage windows by weekday and hour">
        {data.heatmap.length === 0 ? (
          <EmptyState title="No bookings yet" />
        ) : (
          <div className="overflow-x-auto pt-2">
            <div className="min-w-[720px]">
              <div className="flex">
                <div className="w-12" />
                {HOURS.map((h) => (
                  <div key={h} className="flex-1 text-center font-mono text-[10px] uppercase text-ink-400">{h}:00</div>
                ))}
              </div>
              {DAYS.map((day, di) => (
                <div key={day} className="flex items-center">
                  <div className="w-12 py-1 font-mono text-[10px] uppercase text-ink-400">{day}</div>
                  {HOURS.map((h) => {
                    const count = heatLookup.get(`${di}-${h}`) ?? 0;
                    return (
                      <div key={h} className="flex-1 p-[1px]">
                        <div
                          title={`${day} ${h}:00 — ${count} booking${count === 1 ? '' : 's'}`}
                          className="flex h-7 items-center justify-center rounded-[3px] font-mono text-[10px]"
                          style={{ backgroundColor: heatColor(count), color: heatInk(count) }}
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
          <div className="mb-2 flex items-center gap-2">
            <Moon className="h-4 w-4 text-ink-300" />
            <p className="micro-label">Idle assets</p>
            <Badge dot={false} className="bg-ink-500/10 text-ink-600 ring-ink-400/25">{data.idle.length}</Badge>
          </div>
          {data.idle.length === 0 ? (
            <EmptyState title="Every asset has seen use" />
          ) : (
            <ul className="divide-y divide-surface-border">
              {data.idle.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-[13px] font-medium text-ink-800">{a.name}</p>
                    <p className="font-mono text-xs text-ink-400">{a.assetTag} · {a.category}</p>
                  </div>
                  <Badge className={assetStatusStyle[a.status] ?? 'bg-ink-500/10 text-ink-600 ring-ink-400/25'}>{titleCase(a.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Nearing retirement */}
        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-ink-300" />
            <p className="micro-label">Nearing retirement</p>
            <Badge dot={false} className="bg-amber-500/10 text-amber-800 ring-amber-600/25">{data.nearingRetirement.length}</Badge>
          </div>
          <p className="mb-2 text-xs text-ink-400">Over 4 years old or in poor/damaged condition.</p>
          {data.nearingRetirement.length === 0 ? (
            <EmptyState title="Nothing needs attention" />
          ) : (
            <ul className="divide-y divide-surface-border">
              {data.nearingRetirement.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-[13px] font-medium text-ink-800">{a.name}</p>
                    <p className="font-mono text-xs text-ink-400">
                      {a.assetTag} · {a.category} · acquired {fmtDate(a.acquisitionDate)}
                    </p>
                  </div>
                  <Badge className={conditionStyle[a.condition] ?? 'bg-ink-500/10 text-ink-600 ring-ink-400/25'}>{titleCase(a.condition)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Due for maintenance (real scheduled date) */}
      <DueForMaintenance items={data.dueForMaintenance} onChange={refetch} />

      {/* Predictive maintenance risk */}
      <AssetsAtRisk items={data.assetsAtRisk} onChange={refetch} />
    </div>
  );
}

/** Inline editor for an asset's next-maintenance date (managers). */
function MaintenanceDateInput({ assetId, value, onSaved }: { assetId: string; value: string | null; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const save = async (v: string | null) => {
    setSaving(true);
    try {
      await api.patch(`/reports/assets/${assetId}/maintenance-due`, { nextMaintenanceDueDate: v });
      toast.success(v ? 'Maintenance scheduled' : 'Schedule cleared');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        value={value ? value.slice(0, 10) : ''}
        disabled={saving}
        onChange={(e) => save(e.target.value || null)}
        className="rounded-md border border-ink-200 bg-white px-2 py-1 font-mono text-xs text-ink-700 outline-none transition-colors focus:border-accent-500"
      />
      {value && (
        <button onClick={() => save(null)} disabled={saving} title="Clear schedule" className="rounded p-1 text-ink-400 transition-colors hover:text-danger-600">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function DueForMaintenance({ items, onChange }: { items: ReportData['dueForMaintenance']; onChange: () => void }) {
  return (
    <Card className="mt-4 p-5">
      <div className="mb-2 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-ink-300" />
        <p className="micro-label">Due for maintenance</p>
        <Badge dot={false} className="bg-amber-500/10 text-amber-800 ring-amber-600/25">{items.length}</Badge>
      </div>
      <p className="mb-3 text-xs text-ink-400">Driven by each asset's scheduled next-maintenance date — overdue or due within 60 days. Reschedule inline.</p>
      {items.length === 0 ? (
        <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="Nothing scheduled soon" subtitle="Resolving a maintenance request sets the next due date automatically." />
      ) : (
        <ul className="divide-y divide-surface-border">
          {items.map((a) => {
            const overdue = a.daysUntilDue < 0;
            return (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink-800">{a.name}</p>
                  <p className="font-mono text-xs text-ink-400">{a.assetTag} · {a.category} · due {fmtDate(a.nextMaintenanceDueDate)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge dot={false} className={overdue ? 'bg-danger-500/10 text-danger-700 ring-danger-600/25' : 'bg-amber-500/10 text-amber-800 ring-amber-600/25'}>
                    {overdue ? `${Math.abs(a.daysUntilDue)}d overdue` : a.daysUntilDue === 0 ? 'Due today' : `in ${a.daysUntilDue}d`}
                  </Badge>
                  <MaintenanceDateInput assetId={a.id} value={a.nextMaintenanceDueDate} onSaved={onChange} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

type RiskSortKey = 'riskScore' | 'timesMaintained' | 'ageYears' | 'name';

function AssetsAtRisk({ items, onChange }: { items: ReportData['assetsAtRisk']; onChange: () => void }) {
  const [sort, setSort] = useState<{ key: RiskSortKey; dir: 'asc' | 'desc' }>({ key: 'riskScore', dir: 'desc' });
  const sorted = [...items].sort((a, b) => {
    const mult = sort.dir === 'asc' ? 1 : -1;
    if (sort.key === 'name') return mult * a.name.localeCompare(b.name);
    return mult * (a[sort.key] - b[sort.key]);
  });
  const toggle = (key: RiskSortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));

  const riskStyle = (score: number) =>
    score >= 66 ? 'bg-danger-500/10 text-danger-700 ring-danger-600/25' : score >= 40 ? 'bg-amber-500/10 text-amber-800 ring-amber-600/25' : 'bg-emerald-500/10 text-emerald-800 ring-emerald-600/20';

  const SortHead = ({ label, k, right }: { label: string; k: RiskSortKey; right?: boolean }) => (
    <th className={`table-head ${right ? 'text-right' : ''}`}>
      <button onClick={() => toggle(k)} className={`inline-flex items-center gap-1 transition-colors hover:text-ink-700 ${sort.key === k ? 'text-ink-700' : ''}`}>
        {label} <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );

  return (
    <Card className="mt-4 overflow-hidden p-0">
      <div className="flex items-center gap-2 p-5 pb-3">
        <ShieldAlert className="h-4 w-4 text-ink-300" />
        <p className="micro-label">Assets at risk</p>
        <span className="text-xs text-ink-400">Predictive score: maintenance frequency (40%) + age (30%) + condition (30%)</span>
      </div>
      {items.length === 0 ? (
        <div className="p-5 pt-0"><EmptyState icon={<ShieldAlert className="h-6 w-6" />} title="No assets to score" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                <SortHead label="Asset" k="name" />
                <th className="table-head">Category</th>
                <SortHead label="Maint." k="timesMaintained" right />
                <SortHead label="Age (yrs)" k="ageYears" right />
                <th className="table-head">Condition</th>
                <SortHead label="Risk" k="riskScore" right />
                <th className="table-head text-right">Schedule maintenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {sorted.map((a) => (
                <tr key={a.id} className="hover:bg-surface-muted">
                  <td className="table-cell">
                    <p className="text-[13px] font-medium text-ink-800">{a.name}</p>
                    <p className="font-mono text-xs text-ink-400">{a.assetTag}</p>
                  </td>
                  <td className="table-cell text-ink-600">{a.category}</td>
                  <td className="table-cell text-right font-mono tabular-nums text-ink-600">{a.timesMaintained}</td>
                  <td className="table-cell text-right font-mono tabular-nums text-ink-600">{a.ageYears}</td>
                  <td className="table-cell"><Badge className={conditionStyle[a.condition] ?? 'bg-ink-500/10 text-ink-600 ring-ink-400/25'}>{titleCase(a.condition)}</Badge></td>
                  <td className="table-cell text-right">
                    <Badge dot={false} className={riskStyle(a.riskScore)}>{a.riskScore}</Badge>
                  </td>
                  <td className="table-cell">
                    <div className="flex justify-end">
                      <MaintenanceDateInput assetId={a.id} value={null} onSaved={onChange} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
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
      <div className="mb-3 flex items-start gap-2">
        <span className="mt-0.5 text-ink-300">{icon}</span>
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink-900">{title}</h3>
          {subtitle && <p className="text-xs text-ink-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}
