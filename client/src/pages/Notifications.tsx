import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Bell,
  ArrowLeftRight,
  Wrench,
  CalendarDays,
  ClipboardCheck,
  Boxes,
  Clock,
  User as UserIcon,
  CheckCheck,
} from 'lucide-react';
import { useApi } from '../lib/useApi';
import { api, errorMessage } from '../lib/api';
import { Notification } from '../lib/types';
import { Badge, Button, Card, EmptyState, PageHeader, Select, Spinner } from '../components/ui';
import { fmtDate, fromNow } from '../lib/format';

// Icon per notification type, chosen by prefix so new types in a family (e.g.
// any BOOKING_*) get a sensible icon automatically; unknown types fall back to
// the bell. Mirrors the ENTITY_ICON approach in Activity.tsx.
function typeIcon(type: string): JSX.Element {
  if (type.startsWith('TRANSFER')) return <ArrowLeftRight className="h-4 w-4" />;
  if (type.startsWith('MAINTENANCE')) return <Wrench className="h-4 w-4" />;
  if (type.startsWith('BOOKING')) return <CalendarDays className="h-4 w-4" />;
  if (type.startsWith('AUDIT')) return <ClipboardCheck className="h-4 w-4" />;
  if (type.startsWith('ASSET')) return <Boxes className="h-4 w-4" />;
  if (type === 'OVERDUE_RETURN') return <Clock className="h-4 w-4" />;
  if (type === 'ROLE_CHANGED') return <UserIcon className="h-4 w-4" />;
  return <Bell className="h-4 w-4" />;
}

/** Human label for the type filter dropdown, e.g. BOOKING_REMINDER -> "Booking reminder". */
function typeLabel(type: string): string {
  const s = type.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const READ_OPTIONS = [
  ['all', 'All'],
  ['unread', 'Unread'],
  ['read', 'Read'],
] as const;

export default function Notifications() {
  const navigate = useNavigate();
  const { data: notifications, loading, refetch } = useApi<Notification[]>('/notifications');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState('');

  // Distinct types actually present, for the (nice-to-have) type filter.
  const types = useMemo(
    () => [...new Set((notifications ?? []).map((n) => n.type))].sort(),
    [notifications]
  );

  const filtered = useMemo(() => {
    return (notifications ?? []).filter((n) => {
      if (readFilter === 'unread' && n.isRead) return false;
      if (readFilter === 'read' && !n.isRead) return false;
      if (typeFilter && n.type !== typeFilter) return false;
      return true;
    });
  }, [notifications, readFilter, typeFilter]);

  const unreadCount = (notifications ?? []).filter((n) => !n.isRead).length;

  // Group chronologically by day, same as the Activity Log page.
  const grouped = useMemo(() => {
    const map = new Map<string, Notification[]>();
    filtered.forEach((n) => {
      const key = fmtDate(n.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    });
    return [...map.entries()];
  }, [filtered]);

  const openItem = async (n: Notification) => {
    try {
      if (!n.isRead) {
        await api.post(`/notifications/${n.id}/read`);
        refetch();
      }
    } catch (err) {
      toast.error(errorMessage(err));
    }
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    try {
      await api.post('/notifications/read-all');
      toast.success('All notifications marked as read');
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Notifications"
        subtitle="Your full notification history across the platform."
        actions={
          unreadCount > 0 && (
            <Button variant="secondary" onClick={markAll}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          )
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select value={readFilter} onChange={(e) => setReadFilter(e.target.value as 'all' | 'unread' | 'read')}>
            {READ_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>{label}{v === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}</option>
            ))}
          </Select>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {types.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
          </Select>
        </div>
      </Card>

      {loading ? (
        <Spinner label="Loading notifications..." />
      ) : grouped.length === 0 ? (
        <Card>
          <EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications" subtitle="Notifications about your assets, bookings, and audits will appear here." />
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, entries]) => (
            <div key={day}>
              <h3 className="micro-label mb-2 px-1">{day}</h3>
              <Card className="divide-y divide-surface-border">
                {entries.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted"
                  >
                    <span className="mt-0.5 flex-shrink-0 text-ink-400">{typeIcon(n.type)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-ink-800">{n.title}</p>
                        {!n.isRead && <Badge dot={false} className="bg-accent-500/10 text-accent-700 ring-accent-600/20">New</Badge>}
                      </div>
                      <p className="mt-0.5 text-[13px] text-ink-500">{n.message}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-400">{fromNow(n.createdAt)}</p>
                    </div>
                  </button>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
