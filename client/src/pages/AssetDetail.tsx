import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  QrCode,
  MapPin,
  Building2,
  Calendar,
  Wrench,
  History,
  CalendarDays,
  Info,
  ChevronRight,
} from 'lucide-react';
import { useApi } from '../lib/useApi';
import { api, errorMessage } from '../lib/api';
import { Asset } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, EmptyState, Modal, Select, Spinner, Tabs, Field } from '../components/ui';
import { assetStatusStyle, conditionStyle, maintenanceStatusStyle } from '../lib/status';
import { titleCase, fmtDate, fmtDateTime, fmtCurrency, initials, avatarColor } from '../lib/format';

const MANUAL_STATUSES = ['AVAILABLE', 'RESERVED', 'LOST', 'RETIRED', 'DISPOSED', 'UNDER_MAINTENANCE'];

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { data: asset, loading, refetch } = useApi<Asset>(`/assets/${id}`, [id]);
  const [tab, setTab] = useState('overview');
  const [statusModal, setStatusModal] = useState(false);

  if (loading || !asset) return <Spinner label="Loading asset..." />;

  const canManage = hasRole('ADMIN', 'ASSET_MANAGER');
  const allocations = asset.allocations ?? [];
  const maintenance = asset.maintenanceRequests ?? [];
  const bookings = asset.bookings ?? [];
  const custom = (asset.customData as Record<string, unknown>) ?? {};

  return (
    <div className="animate-fade-in">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: identity card */}
        <Card className="p-6 lg:col-span-1">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <QrCode className="h-8 w-8" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-slate-900">{asset.name}</h1>
              <p className="font-mono text-sm text-slate-400">{asset.assetTag}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge className={assetStatusStyle[asset.status]}>{titleCase(asset.status)}</Badge>
            <Badge className={conditionStyle[asset.condition]}>{titleCase(asset.condition)}</Badge>
            {asset.isBookable && <Badge className="bg-violet-50 text-violet-700 ring-violet-600/20">Bookable</Badge>}
          </div>

          {asset.currentHolder && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-brand-50/60 p-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${avatarColor(asset.currentHolder.name)}`}>
                {initials(asset.currentHolder.name)}
              </div>
              <div>
                <p className="text-xs text-slate-500">Currently held by</p>
                <p className="text-sm font-semibold text-slate-800">{asset.currentHolder.name}</p>
              </div>
            </div>
          )}

          <dl className="mt-5 space-y-3 text-sm">
            <Detail icon={<Info className="h-4 w-4" />} label="Category" value={asset.category?.name} />
            <Detail icon={<Building2 className="h-4 w-4" />} label="Department" value={asset.department?.name ?? 'Unassigned'} />
            <Detail icon={<MapPin className="h-4 w-4" />} label="Location" value={asset.location ?? '—'} />
            <Detail icon={<QrCode className="h-4 w-4" />} label="Serial No." value={asset.serialNumber ?? '—'} />
            <Detail icon={<Calendar className="h-4 w-4" />} label="Acquired" value={fmtDate(asset.acquisitionDate)} />
            <Detail icon={<Info className="h-4 w-4" />} label="Cost" value={fmtCurrency(asset.acquisitionCost)} />
            {Object.entries(custom).map(([k, v]) => (
              <Detail key={k} icon={<Info className="h-4 w-4" />} label={titleCase(k)} value={String(v)} />
            ))}
          </dl>

          {canManage && (
            <div className="mt-6 flex flex-col gap-2">
              <Button variant="secondary" onClick={() => navigate(`/allocations?asset=${asset.id}`)}>Manage allocation</Button>
              <Button variant="secondary" onClick={() => setStatusModal(true)}>Change status</Button>
            </div>
          )}
        </Card>

        {/* Right: history tabs */}
        <div className="lg:col-span-2">
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'overview', label: 'Overview', icon: <Info className="h-4 w-4" /> },
              { key: 'allocations', label: `Allocations (${allocations.length})`, icon: <History className="h-4 w-4" /> },
              { key: 'maintenance', label: `Maintenance (${maintenance.length})`, icon: <Wrench className="h-4 w-4" /> },
              ...(asset.isBookable ? [{ key: 'bookings', label: `Bookings (${bookings.length})`, icon: <CalendarDays className="h-4 w-4" /> }] : []),
            ]}
          />

          <Card className="mt-4 p-5">
            {tab === 'overview' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">Lifecycle timeline</h3>
                {allocations.length === 0 && maintenance.length === 0 ? (
                  <EmptyState title="No history yet" subtitle="Allocation and maintenance events will appear here." />
                ) : (
                  <ol className="relative space-y-4 border-l border-slate-200 pl-5">
                    {[...allocations.map((a) => ({ t: a.allocatedAt, text: `Allocated to ${a.holder?.name}`, kind: 'alloc' as const })),
                      ...maintenance.map((m) => ({ t: m.createdAt, text: `Maintenance: ${titleCase(m.status)}`, kind: 'maint' as const }))]
                      .sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime())
                      .slice(0, 12)
                      .map((e, i) => (
                        <li key={i}>
                          <span className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full ${e.kind === 'alloc' ? 'bg-brand-500' : 'bg-amber-500'}`} />
                          <p className="text-sm text-slate-700">{e.text}</p>
                          <p className="text-xs text-slate-400">{fmtDateTime(e.t)}</p>
                        </li>
                      ))}
                  </ol>
                )}
              </div>
            )}

            {tab === 'allocations' && (
              allocations.length === 0 ? <EmptyState icon={<History className="h-6 w-6" />} title="No allocation history" /> : (
                <ul className="divide-y divide-surface-border">
                  {allocations.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{a.holder?.name}</p>
                        <p className="text-xs text-slate-400">
                          {fmtDate(a.allocatedAt)} → {a.returnedAt ? fmtDate(a.returnedAt) : 'Present'}
                          {a.checkInNotes ? ` · ${a.checkInNotes}` : ''}
                        </p>
                      </div>
                      <Badge className={a.status === 'ACTIVE' ? 'bg-brand-50 text-brand-700 ring-brand-600/20' : 'bg-slate-100 text-slate-600 ring-slate-500/20'}>
                        {titleCase(a.status)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )
            )}

            {tab === 'maintenance' && (
              maintenance.length === 0 ? <EmptyState icon={<Wrench className="h-6 w-6" />} title="No maintenance history" /> : (
                <ul className="divide-y divide-surface-border">
                  {maintenance.map((m) => (
                    <li key={m.id} className="py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-800">{m.description}</p>
                        <Badge className={maintenanceStatusStyle[m.status]}>{titleCase(m.status)}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        Raised by {m.raisedBy?.name} · {fmtDate(m.createdAt)}
                        {m.technicianName ? ` · Technician: ${m.technicianName}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )
            )}

            {tab === 'bookings' && (
              bookings.length === 0 ? <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No bookings" /> : (
                <ul className="divide-y divide-surface-border">
                  {bookings.map((b) => (
                    <li key={b.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{b.bookedBy?.name}</p>
                        <p className="text-xs text-slate-400">{fmtDateTime(b.startTime)} – {fmtDateTime(b.endTime)}</p>
                      </div>
                      <Link to="/bookings" className="text-slate-300 hover:text-slate-500"><ChevronRight className="h-4 w-4" /></Link>
                    </li>
                  ))}
                </ul>
              )
            )}
          </Card>
        </div>
      </div>

      {statusModal && <StatusModal asset={asset} onClose={() => setStatusModal(false)} onSaved={() => { setStatusModal(false); refetch(); }} />}
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400">{icon}</span>
      <span className="w-24 flex-shrink-0 text-slate-400">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}

function StatusModal({ asset, onClose, onSaved }: { asset: Asset; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(asset.status);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      await api.post(`/assets/${asset.id}/status`, { status, note });
      toast.success('Status updated');
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
      title="Change asset status"
      subtitle={`${asset.assetTag} — ${asset.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={loading}>Update</Button></>}
    >
      <div className="space-y-4">
        <Field label="New status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as Asset['status'])}>
            {MANUAL_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </Select>
        </Field>
        <Field label="Note (optional)">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for change" />
        </Field>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Allocated assets must be returned before their status can be changed.
        </p>
      </div>
    </Modal>
  );
}
