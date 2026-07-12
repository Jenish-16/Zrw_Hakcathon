import { useMemo, useState } from 'react';
import { ScrollText, Boxes, User as UserIcon, Building2, Tag, CalendarDays, Wrench, ClipboardCheck, Activity as ActivityIcon } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { ActivityLog } from '../lib/types';
import { Card, EmptyState, PageHeader, SearchInput, Select, Spinner } from '../components/ui';
import { fmtDate, fromNow } from '../lib/format';

const ENTITY_OPTIONS = [
  ['', 'All activity'],
  ['Asset', 'Assets'],
  ['User', 'Employees'],
  ['Department', 'Departments'],
  ['AssetCategory', 'Categories'],
  ['Booking', 'Bookings'],
  ['MaintenanceRequest', 'Maintenance'],
  ['AuditCycle', 'Audits'],
] as const;

const ENTITY_ICON: Record<string, JSX.Element> = {
  Asset: <Boxes className="h-4 w-4" />,
  User: <UserIcon className="h-4 w-4" />,
  Department: <Building2 className="h-4 w-4" />,
  AssetCategory: <Tag className="h-4 w-4" />,
  Booking: <CalendarDays className="h-4 w-4" />,
  MaintenanceRequest: <Wrench className="h-4 w-4" />,
  AuditCycle: <ClipboardCheck className="h-4 w-4" />,
};

export default function Activity() {
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    if (entityType) q.set('entityType', entityType);
    return q.toString();
  }, [search, entityType]);

  const { data: logs, loading } = useApi<ActivityLog[]>(`/activity?${query}`, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, ActivityLog[]>();
    (logs ?? []).forEach((l) => {
      const key = fmtDate(l.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    });
    return [...map.entries()];
  }, [logs]);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Activity Log" subtitle="A full trail of who did what, and when." />

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search actions, details, people..." />
          </div>
          <Select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            {ENTITY_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </Select>
        </div>
      </Card>

      {loading ? (
        <Spinner label="Loading activity..." />
      ) : grouped.length === 0 ? (
        <Card>
          <EmptyState icon={<ScrollText className="h-6 w-6" />} title="No activity found" subtitle="Actions across the platform will appear here." />
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, entries]) => (
            <div key={day}>
              <h3 className="micro-label mb-2 px-1">{day}</h3>
              <Card className="divide-y divide-surface-border">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 flex-shrink-0 text-ink-400">
                      {ENTITY_ICON[e.entityType] ?? <ActivityIcon className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink-700">
                        <span className="font-medium text-ink-800">{e.actorName}</span> {e.action.toLowerCase()}
                        {e.details ? <span className="text-ink-500"> — {e.details}</span> : ''}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-400">{fromNow(e.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
