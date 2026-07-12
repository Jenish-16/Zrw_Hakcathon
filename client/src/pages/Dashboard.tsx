import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
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
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../lib/useApi';
import { DashboardData } from '../lib/types';
import { Card, Spinner, PageHeader, Badge, EmptyState } from '../components/ui';
import { fromNow, fmtDate } from '../lib/format';
import { assetStatusStyle } from '../lib/status';
import { titleCase } from '../lib/format';

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: '#10b981',
  ALLOCATED: '#1f42f5',
  RESERVED: '#8b5cf6',
  UNDER_MAINTENANCE: '#f59e0b',
  LOST: '#f43f5e',
  RETIRED: '#94a3b8',
  DISPOSED: '#cbd5e1',
};

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  const { data, loading } = useApi<DashboardData>('/dashboard');
  const navigate = useNavigate();

  if (loading || !data) return <Spinner label="Loading dashboard..." />;

  const k = data.kpis;
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  const kpiCards = [
    { label: 'Assets Available', value: k.assetsAvailable, icon: <CheckCircle2 className="h-5 w-5" />, tone: 'text-emerald-600 bg-emerald-50', to: '/assets?status=AVAILABLE' },
    { label: 'Assets Allocated', value: k.assetsAllocated, icon: <Boxes className="h-5 w-5" />, tone: 'text-brand-600 bg-brand-50', to: '/assets?status=ALLOCATED' },
    { label: 'Maintenance Today', value: k.maintenanceToday, icon: <Wrench className="h-5 w-5" />, tone: 'text-amber-600 bg-amber-50', to: '/maintenance' },
    { label: 'Active Bookings', value: k.activeBookings, icon: <CalendarDays className="h-5 w-5" />, tone: 'text-violet-600 bg-violet-50', to: '/bookings' },
    { label: 'Pending Transfers', value: k.pendingTransfers, icon: <ArrowLeftRight className="h-5 w-5" />, tone: 'text-cyan-600 bg-cyan-50', to: '/transfers' },
    { label: 'Upcoming Returns', value: k.upcomingReturns, icon: <Clock className="h-5 w-5" />, tone: 'text-indigo-600 bg-indigo-50', to: '/allocations' },
  ];

  const chartData = data.statusBreakdown.map((s) => ({ name: titleCase(s.status), value: s.count, key: s.status }));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`${greeting}, ${user?.name.split(' ')[0]} 👋`}
        subtitle="Here's your real-time operational snapshot."
        actions={
          <>
            {hasRole('ADMIN', 'ASSET_MANAGER') && (
              <button onClick={() => navigate('/assets?action=new')} className="btn-primary btn-sm">
                <Plus className="h-4 w-4" /> Register Asset
              </button>
            )}
            <button onClick={() => navigate('/bookings?action=new')} className="btn-secondary btn-sm">
              <BookOpen className="h-4 w-4" /> Book Resource
            </button>
            <button onClick={() => navigate('/maintenance?action=new')} className="btn-secondary btn-sm">
              <Wrench className="h-4 w-4" /> Raise Request
            </button>
          </>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((c) => (
          <Link key={c.label} to={c.to}>
            <Card className="group h-full p-4 transition hover:shadow-cardhover">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${c.tone}`}>{c.icon}</div>
              <p className="mt-3 text-2xl font-bold text-slate-900">{c.value}</p>
              <p className="text-xs font-medium text-slate-500">{c.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* Overdue banner */}
      {k.overdueReturns > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-rose-500" />
          <p className="text-sm text-rose-700">
            <span className="font-semibold">{k.overdueReturns} overdue {k.overdueReturns === 1 ? 'return' : 'returns'}</span> —
            assets past their expected return date need attention.
          </p>
          <Link to="/allocations?overdue=true" className="ml-auto text-sm font-semibold text-rose-700 hover:underline">
            Review →
          </Link>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Status breakdown chart */}
        <Card className="p-5 lg:col-span-1">
          <h3 className="font-semibold text-slate-900">Asset Status Breakdown</h3>
          <p className="text-xs text-slate-400">{k.totalAssets} assets total</p>
          {chartData.length === 0 ? (
            <EmptyState icon={<Package className="h-6 w-6" />} title="No assets yet" />
          ) : (
            <div className="mt-2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={2}>
                    {chartData.map((entry) => (
                      <Cell key={entry.key} fill={STATUS_COLORS[entry.key] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Returns lists */}
        <Card className="p-5 lg:col-span-2">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                <h3 className="font-semibold text-slate-900">Overdue Returns</h3>
                <Badge className="bg-rose-50 text-rose-700 ring-rose-600/20">{data.overdue.length}</Badge>
              </div>
              <ReturnsList items={data.overdue} overdue />
            </div>
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-brand-500" />
                <h3 className="font-semibold text-slate-900">Upcoming Returns</h3>
                <Badge className="bg-brand-50 text-brand-700 ring-brand-600/20">{data.upcomingReturns.length}</Badge>
              </div>
              <ReturnsList items={data.upcomingReturns} />
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* My snapshot */}
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900">My Snapshot</h3>
          <div className="mt-4 space-y-3">
            <SnapshotRow icon={<Boxes className="h-4 w-4" />} label="Assets held by me" value={data.personal.myAssets} to="/allocations" />
            <SnapshotRow icon={<CalendarDays className="h-4 w-4" />} label="My active bookings" value={data.personal.myBookings} to="/bookings?mine=true" />
            <SnapshotRow icon={<Wrench className="h-4 w-4" />} label="My open maintenance" value={data.personal.myOpenMaintenance} to="/maintenance" />
          </div>
        </Card>

        {/* Recent activity */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            <h3 className="font-semibold text-slate-900">Recent Activity</h3>
          </div>
          {data.recentActivity.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ul className="space-y-1">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                  <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold">{a.actorName}</span> {a.action.toLowerCase()}
                      {a.details ? <span className="text-slate-500"> — {a.details}</span> : ''}
                    </p>
                    <p className="text-xs text-slate-400">{fromNow(a.createdAt)}</p>
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
    return <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">Nothing here.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.slice(0, 5).map((a) => (
        <li key={a.id} className="flex items-center justify-between rounded-xl border border-surface-border px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">
              {a.asset?.assetTag} · {a.asset?.name}
            </p>
            <p className="truncate text-xs text-slate-400">{a.holder?.name}</p>
          </div>
          <span className={`ml-2 flex-shrink-0 text-xs font-semibold ${overdue ? 'text-rose-600' : 'text-slate-500'}`}>
            {fmtDate(a.expectedReturnDate)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SnapshotRow({ icon, label, value, to }: { icon: ReactNode; label: string; value: number; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl border border-surface-border px-3 py-2.5 transition hover:bg-slate-50">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">{icon}</div>
      <span className="flex-1 text-sm text-slate-600">{label}</span>
      <span className="text-lg font-bold text-slate-900">{value}</span>
    </Link>
  );
}
