import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Plus, CalendarDays, MapPin, Clock, X, Pencil } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { api, errorMessage } from '../lib/api';
import { Booking } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from '../components/ui';
import { bookingStatusStyle } from '../lib/status';
import { titleCase, fmtDate, fmtTime, initials, avatarColor } from '../lib/format';

interface Resource {
  id: string;
  assetTag: string;
  name: string;
  location?: string | null;
  category?: { name: string };
}

function toLocalInput(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export default function Bookings() {
  const { user, hasRole } = useAuth();
  const [params, setParams] = useSearchParams();
  const [resourceId, setResourceId] = useState('');
  const [mine, setMine] = useState(params.get('mine') === 'true');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);

  const { data: resources } = useApi<Resource[]>('/bookings/resources');

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (resourceId) q.set('resourceId', resourceId);
    if (mine) q.set('mine', 'true');
    return q.toString();
  }, [resourceId, mine]);

  const { data: bookings, loading, refetch } = useApi<Booking[]>(`/bookings?${query}`, [query]);

  useEffect(() => {
    if (params.get('action') === 'new') {
      setShowForm(true);
      params.delete('action');
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group bookings by calendar day.
  const grouped = useMemo(() => {
    const map = new Map<string, Booking[]>();
    (bookings ?? []).forEach((b) => {
      const key = b.startTime.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [bookings]);

  const cancel = async (b: Booking) => {
    try {
      await api.post(`/bookings/${b.id}/cancel`);
      toast.success('Booking cancelled');
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const canModify = (b: Booking) => b.bookedById === user?.id || hasRole('ADMIN', 'ASSET_MANAGER');

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Resource Booking"
        subtitle="Book shared rooms, vehicles and equipment by time slot — with automatic overlap checks."
        actions={<Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus className="h-4 w-4" /> New Booking</Button>}
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Select value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
              <option value="">All resources</option>
              {resources?.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.assetTag}</option>)}
            </Select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-4 w-4 rounded border-ink-300 text-accent-600 focus:ring-accent-500" />
            My bookings only
          </label>
        </div>
      </Card>

      {loading ? (
        <Spinner />
      ) : grouped.length === 0 ? (
        <Card><EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No bookings" subtitle="Book a shared resource to see it on the agenda." /></Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <div className="mb-2 flex items-baseline gap-2">
                <CalendarDays className="h-4 w-4 self-center text-ink-400" />
                <h3 className="font-mono text-[13px] font-medium tabular-nums text-ink-800">{fmtDate(day)}</h3>
                <span className="text-xs text-ink-400">{items.length} booking{items.length > 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {items.sort((a, b) => a.startTime.localeCompare(b.startTime)).map((b) => (
                  <Card key={b.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="flex w-40 flex-shrink-0 items-center gap-2">
                      <Clock className="h-4 w-4 text-ink-400" />
                      <span className="font-mono text-[13px] font-medium tabular-nums text-ink-800">
                        {fmtTime(b.startTime)} – {fmtTime(b.endTime)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-800">{b.resource?.name}</p>
                      <p className="flex items-center gap-1 text-xs text-ink-400">
                        <MapPin className="h-3 w-3" /> {b.resource?.location ?? b.resource?.assetTag}
                        {b.purpose ? ` · ${b.purpose}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${avatarColor(b.bookedBy?.name ?? '?')}`}>
                        {initials(b.bookedBy?.name ?? '?')}
                      </div>
                      <span className="hidden text-[13px] text-ink-500 sm:inline">{b.bookedBy?.name}</span>
                      <Badge className={bookingStatusStyle[b.status]}>{titleCase(b.status)}</Badge>
                      {(b.status === 'UPCOMING' || b.status === 'ONGOING') && canModify(b) && (
                        <>
                          <button onClick={() => { setEditing(b); setShowForm(true); }} title="Reschedule" className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-900/5 hover:text-ink-600"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => cancel(b)} title="Cancel" className="rounded-md p-1.5 text-danger-600 transition-colors hover:bg-danger-50"><X className="h-4 w-4" /></button>
                        </>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <BookingModal
          resources={resources ?? []}
          booking={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refetch(); }}
        />
      )}
    </div>
  );
}

function BookingModal({ resources, booking, onClose, onSaved }: { resources: Resource[]; booking: Booking | null; onClose: () => void; onSaved: () => void }) {
  const now = new Date();
  const [resourceId, setResourceId] = useState(booking?.resourceId ?? '');
  const [start, setStart] = useState(booking ? toLocalInput(new Date(booking.startTime)) : toLocalInput(new Date(now.getTime() + 60 * 60 * 1000)));
  const [end, setEnd] = useState(booking ? toLocalInput(new Date(booking.endTime)) : toLocalInput(new Date(now.getTime() + 2 * 60 * 60 * 1000)));
  const [purpose, setPurpose] = useState(booking?.purpose ?? '');
  const [loading, setLoading] = useState(false);
  const isEdit = !!booking;

  const submit = async () => {
    if (!isEdit && !resourceId) { toast.error('Select a resource'); return; }
    if (!start || !end) { toast.error('Choose a start and end time'); return; }
    setLoading(true);
    try {
      const payload = { startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString(), purpose: purpose || undefined };
      if (isEdit) {
        await api.patch(`/bookings/${booking!.id}`, payload);
        toast.success('Booking rescheduled');
      } else {
        await api.post('/bookings', { resourceId, ...payload });
        toast.success('Booking confirmed');
      }
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Reschedule booking' : 'New booking'}
      subtitle={isEdit ? booking?.resource?.name : 'Overlapping slots on the same resource are rejected automatically.'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={loading}>{isEdit ? 'Reschedule' : 'Confirm booking'}</Button></>}
    >
      <div className="space-y-4">
        {!isEdit && (
          <Field label="Resource" required>
            <Select value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
              <option value="">Select a bookable resource</option>
              {resources.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.assetTag}{r.location ? ` (${r.location})` : ''}</option>)}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Start" required>
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="End" required>
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="Purpose (optional)">
          <Textarea rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Sprint planning meeting" />
        </Field>
      </div>
    </Modal>
  );
}
