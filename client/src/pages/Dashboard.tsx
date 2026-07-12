import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  CheckCircle2,
  Boxes,
  Wrench,
  CalendarDays,
  ArrowLeftRight,
  Clock,
  AlertTriangle,
  Plus,
  BookOpen,
  Package,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../lib/useApi';
import { DashboardData } from '../lib/types';
import { Card, Spinner, PageHeader, Badge, EmptyState } from '../components/ui';
import { fromNow, fmtDate } from '../lib/format';
import { titleCase } from '../lib/format';

// Status palette — fixed status job colors (validated set)
const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: '#0ca30c',
  ALLOCATED: '#2a78d6',
  RESERVED: '#4a3aa7',
  UNDER_MAINTENANCE: '#fab219',
  LOST: '#d03b3b',
  RETIRED: '#898781',
  DISPOSED: '#c3c2b7',
};

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

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  const { data, loading } = useApi<DashboardData>('/dashboard');
  const navigate = useNavigate();

  if (loading || !data) return <Spinner label="Loading dashboard…" />;

  const k = data.kpis;
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  const kpiCards = [
    { label: 'Available', value: k.assetsAvailable, icon: <CheckCircle2 className="h-4 w-4" />, to: '/assets?status=AVAILABLE' },
    { label: 'Allocated', value: k.assetsAllocated, icon: <Boxes className="h-4 w-4" />, to: '/assets?status=ALLOCATED' },
    { label: 'Maintenance today', value: k.maintenanceToday, icon: <Wrench className="h-4 w-4" />, to: '/maintenance' },
    { label: 'Active bookings', value: k.activeBookings, icon: <CalendarDays className="h-4 w-4" />, to: '/bookings' },
    { label: 'Pending transfers', value: k.pendingTransfers, icon: <ArrowLeftRight className="h-4 w-4" />, to: '/transfers' },
    { label: 'Upcoming returns', value: k.upcomingReturns, icon: <Clock className="h-4 w-4" />, to: '/allocations' },
  ];

  const chartData = data.statusBreakdown.map((s) => ({ name: titleCase(s.status), value: s.count, key: s.status }));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`${greeting}, ${user?.name.split(' ')[0]}`}
        subtitle="Today's position across assets, bookings and maintenance."
        actions={
          <>
            {hasRole('ADMIN', 'ASSET_MANAGER') && (
              <button onClick={() => navigate('/assets?action=new')} className="btn-primary btn-sm">
                <Plus className="h-4 w-4" /> Register asset
              </button>
            )}
            <button onClick={() => navigate('/bookings?action=new')} className="btn-secondary btn-sm">
              <BookOpen className="h-4 w-4" /> Book resource
            </button>
            <button onClick={() => navigate('/maintenance?action=new')} className="btn-secondary btn-sm">
              <Wrench className="h-4 w-4" /> Raise request
            </button>
          </>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((c) => (
          <Link key={c.label} to={c.to}>
            <Card className="h-full p-4 transition-colors hover:border-ink-300">
              <div className="flex items-center justify-between">
                <p className="micro-label">{c.label}</p>
                <span className="text-ink-300">{c.icon}</span>
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-ink-900">{c.value}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* Overdue notice */}
      {k.overdueReturns > 0 && (
        <div className="card mt-4 flex items-center gap-3 border-l-2 border-l-danger-600 px-4 py-3">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-danger-600" />
          <p className="text-[13px] text-ink-700">
            <span className="font-semibold">{k.overdueReturns} overdue {k.overdueReturns === 1 ? 'return' : 'returns'}</span> — assets
            past their expected return date need attention.
          </p>
          <Link to="/allocations?overdue=true" className="ml-auto text-[13px] font-medium text-danger-600 hover:text-danger-700">
            Review →
          </Link>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Status breakdown donut */}
        <Card className="p-5 lg:col-span-1">
          <p className="micro-label">Asset status</p>
          {chartData.length === 0 ? (
            <div className="mt-3">
              <EmptyState icon={<Package className="h-6 w-6" />} title="No assets yet" />
            </div>
          ) : (
            <>
              <div className="relative mx-auto mt-2 h-48 w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="62%"
                      outerRadius="80%"
                      paddingAngle={2}
                      stroke="#fcfcfb"
                      strokeWidth={2}
                    >
                      {chartData.map((entry) => (
                        <Cell key={entry.key} fill={STATUS_COLORS[entry.key] ?? '#898781'} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Hero total in the ring */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-semibold tabular-nums text-ink-900">{k.totalAssets}</p>
                  <p className="micro-label">Assets</p>
                </div>
              </div>
              {/* Custom legend: dot + label + mono count */}
              <ul className="mt-4 space-y-1.5">
                {chartData.map((entry) => (
                  <li key={entry.key} className="flex items-center gap-2 text-[13px]">
                    <span
                      aria-hidden
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[entry.key] ?? '#898781' }}
                    />
                    <span className="flex-1 text-ink-600">{entry.name}</span>
                    <span className="font-mono tabular-nums text-ink-800">{entry.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        {/* Returns lists */}
        <Card className="p-5 lg:col-span-2">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <p className="micro-label">Overdue returns</p>
                <Badge dot={false} className="bg-danger-600/10 text-danger-700 ring-danger-600/20">{data.overdue.length}</Badge>
              </div>
              <ReturnsList items={data.overdue} overdue />
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <p className="micro-label">Upcoming returns</p>
                <Badge dot={false} className="bg-accent-500/10 text-accent-800 ring-accent-600/20">{data.upcomingReturns.length}</Badge>
              </div>
              <ReturnsList items={data.upcomingReturns} />
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* My snapshot */}
        <Card className="p-5">
          <p className="micro-label">My snapshot</p>
          <div className="mt-3 divide-y divide-surface-border">
            <SnapshotRow icon={<Boxes className="h-4 w-4" />} label="Assets held by me" value={data.personal.myAssets} to="/allocations" />
            <SnapshotRow icon={<CalendarDays className="h-4 w-4" />} label="My active bookings" value={data.personal.myBookings} to="/bookings?mine=true" />
            <SnapshotRow icon={<Wrench className="h-4 w-4" />} label="My open maintenance" value={data.personal.myOpenMaintenance} to="/maintenance" />
          </div>
        </Card>

        {/* Recent activity */}
        <Card className="p-5 lg:col-span-2">
          <p className="micro-label">Recent activity</p>
          {data.recentActivity.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No activity yet" />
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-surface-border">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 py-2.5">
                  <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ink-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-ink-700">
                      <span className="font-medium text-ink-800">{a.actorName}</span> {a.action.toLowerCase()}
                      {a.details ? <span className="text-ink-500"> — {a.details}</span> : ''}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-400">{fromNow(a.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function ReturnsList({ items, overdue }: { items: DashboardData['overdue']; overdue?: boolean }) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-[13px] text-ink-400">
        None.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-surface-border">
      {items.slice(0, 5).map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-2 py-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-ink-800">
              <span className="font-mono text-xs text-ink-500">{a.asset?.assetTag}</span> · {a.asset?.name}
            </p>
            <p className="truncate text-xs text-ink-500">{a.holder?.name}</p>
          </div>
          <span className={`flex-shrink-0 font-mono text-xs ${overdue ? 'font-medium text-danger-600' : 'text-ink-500'}`}>
            {fmtDate(a.expectedReturnDate)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SnapshotRow({ icon, label, value, to }: { icon: ReactNode; label: string; value: number; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 py-2.5 transition-colors hover:bg-surface-muted">
      <span className="text-ink-400">{icon}</span>
      <span className="flex-1 text-[13px] text-ink-600">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums text-ink-900">{value}</span>
    </Link>
  );
}
