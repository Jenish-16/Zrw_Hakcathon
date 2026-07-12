import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Wrench,
  History,
  CalendarDays,
  Info,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { AssetQr } from '../components/AssetQr';
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
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1.5 text-[13px] font-medium text-ink-500 transition-colors hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: identity card */}
        <Card className="p-5 lg:col-span-1">
          {asset.photoUrl && (
            <img
              src={asset.photoUrl}
              alt={asset.name}
              className="mb-4 h-44 w-full rounded-lg border border-surface-border object-cover"
            />
          )}
          <p className="font-mono text-xs uppercase tracking-wide text-ink-400">{asset.assetTag}</p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight text-ink-900">{asset.name}</h1>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge className={assetStatusStyle[asset.status]}>{titleCase(asset.status)}</Badge>
            <Badge className={conditionStyle[asset.condition]}>{titleCase(asset.condition)}</Badge>
            {asset.isBookable && <Badge className="bg-violet-500/10 text-violet-800 ring-violet-600/20">Bookable</Badge>}
          </div>

          {asset.currentHolder && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-surface-border bg-surface-muted p-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${avatarColor(asset.currentHolder.name)}`}>
                {initials(asset.currentHolder.name)}
              </div>
              <div>
                <p className="micro-label">Held by</p>
                <p className="text-sm font-medium text-ink-800">{asset.currentHolder.name}</p>
              </div>
            </div>
          )}

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-surface-border pt-4">
            <Detail label="Category" value={asset.category?.name} />
            <Detail label="Department" value={asset.department?.name ?? 'Unassigned'} />
            <Detail label="Location" value={asset.location ?? '—'} />
            <Detail label="Serial No." value={asset.serialNumber ?? '—'} mono />
            <Detail label="Acquired" value={fmtDate(asset.acquisitionDate)} mono />
            <Detail label="Cost" value={fmtCurrency(asset.acquisitionCost)} mono />
            {Object.entries(custom).map(([k, v]) => (
              <Detail key={k} label={titleCase(k)} value={String(v)} />
            ))}
          </dl>

          {asset.documentUrl && (
            <a
              href={asset.documentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex items-center gap-2 rounded-lg border border-surface-border px-3 py-2.5 text-[13px] font-medium text-ink-700 transition-colors hover:bg-surface-muted"
            >
              <FileText className="h-4 w-4 text-ink-400" />
              <span className="min-w-0 truncate">View attached document</span>
            </a>
          )}

          <div className="mt-5 border-t border-surface-border pt-4">
            <p className="micro-label mb-3 text-center">QR label</p>
            <AssetQr asset={asset} size={112} />
          </div>

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
                <p className="micro-label">Lifecycle timeline</p>
                {allocations.length === 0 && maintenance.length === 0 ? (
                  <EmptyState title="No history yet" subtitle="Allocation and maintenance events will appear here." />
                ) : (
                  <ol className="relative space-y-4 border-l border-surface-border pl-5">
                    {[...allocations.map((a) => ({ t: a.allocatedAt, text: `Allocated to ${a.holder?.name}`, kind: 'alloc' as const })),
                      ...maintenance.map((m) => ({ t: m.createdAt, text: `Maintenance: ${titleCase(m.status)}`, kind: 'maint' as const }))]
                      .sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime())
                      .slice(0, 12)
                      .map((e, i) => (
                        <li key={i}>
                          <span className={`absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full ${e.kind === 'alloc' ? 'bg-accent-500' : 'bg-amber-500'}`} />
                          <p className="text-sm text-ink-700">{e.text}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-ink-400">{fmtDateTime(e.t)}</p>
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
                        <p className="text-sm font-medium text-ink-800">{a.holder?.name}</p>
                        <p className="mt-0.5 text-xs text-ink-400">
                          <span className="font-mono">{fmtDate(a.allocatedAt)} → {a.returnedAt ? fmtDate(a.returnedAt) : 'Present'}</span>
                          {a.checkInNotes ? ` · ${a.checkInNotes}` : ''}
                        </p>
                      </div>
                      <Badge className={a.status === 'ACTIVE' ? 'bg-accent-500/10 text-accent-800 ring-accent-600/20' : 'bg-ink-500/10 text-ink-600 ring-ink-400/25'}>
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
                        <p className="text-sm font-medium text-ink-800">{m.description}</p>
                        <Badge className={maintenanceStatusStyle[m.status]}>{titleCase(m.status)}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-ink-400">
                        Raised by {m.raisedBy?.name} · <span className="font-mono">{fmtDate(m.createdAt)}</span>
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
                        <p className="text-sm font-medium text-ink-800">{b.bookedBy?.name}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-ink-400">{fmtDateTime(b.startTime)} – {fmtDateTime(b.endTime)}</p>
                      </div>
                      <Link to="/bookings" className="text-ink-300 transition-colors hover:text-ink-500"><ChevronRight className="h-4 w-4" /></Link>
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

function Detail({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <dt className="micro-label">{label}</dt>
      <dd className={`mt-1 text-sm text-ink-800 ${mono ? 'font-mono text-[13px] tabular-nums' : ''}`}>{value}</dd>
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
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
          Allocated assets must be returned before their status can be changed.
        </p>
      </div>
    </Modal>
  );
}
