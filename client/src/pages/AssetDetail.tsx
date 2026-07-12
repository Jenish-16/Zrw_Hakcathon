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
  HandCoins,
  Undo2,
  BookmarkPlus,
  PackageCheck,
  Archive,
  Trash2,
  HelpCircle,
} from 'lucide-react';
import { AssetQr } from '../components/AssetQr';
import { useApi } from '../lib/useApi';
import { api, errorMessage } from '../lib/api';
import { Asset, AssetStatus, Allocation } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, EmptyState, Modal, Select, Spinner, Tabs, Field, Textarea } from '../components/ui';
import { assetStatusStyle, conditionStyle, maintenanceStatusStyle } from '../lib/status';
import { titleCase, fmtDate, fmtDateTime, fmtCurrency, initials, avatarColor } from '../lib/format';

const CONDITIONS: Asset['condition'][] = ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];

// --- Quick actions ---------------------------------------------------------
// Each contextual action the admin/manager can take from the identity card.
// 'allocate' + 'return' route to their dedicated flows; every other key is a
// manual status transition posted to /assets/:id/status.
type ActionKey = 'allocate' | 'return' | 'reserve' | 'available' | 'repair' | 'lost' | 'retire' | 'dispose';

type ActionMeta = {
  label: string;
  icon: JSX.Element;
  danger?: boolean;
  status?: AssetStatus; // set for status-transition actions
  confirmTitle?: string;
  confirmBody?: string;
  successMsg?: string;
};

const ACTION_META: Record<ActionKey, ActionMeta> = {
  allocate: { label: 'Allocate', icon: <HandCoins className="h-4 w-4" /> },
  return: { label: 'Return', icon: <Undo2 className="h-4 w-4" /> },
  reserve: {
    label: 'Reserve', icon: <BookmarkPlus className="h-4 w-4" />, status: 'RESERVED',
    confirmTitle: 'Reserve asset', confirmBody: 'Hold this asset as reserved so it is not allocated to anyone else.',
    successMsg: 'Asset reserved',
  },
  available: {
    label: 'Mark available', icon: <PackageCheck className="h-4 w-4" />, status: 'AVAILABLE',
    confirmTitle: 'Mark available', confirmBody: 'Return this asset to the available pool so it can be allocated again.',
    successMsg: 'Asset marked available',
  },
  repair: {
    label: 'Send for repair', icon: <Wrench className="h-4 w-4" />, status: 'UNDER_MAINTENANCE',
    confirmTitle: 'Send for repair', confirmBody: 'Mark this asset as under maintenance while it is being repaired.',
    successMsg: 'Asset sent for repair',
  },
  lost: {
    label: 'Mark lost', icon: <HelpCircle className="h-4 w-4" />, status: 'LOST', danger: true,
    confirmTitle: 'Mark asset as lost', confirmBody: 'Flag this asset as lost. You can mark it available again if it is found.',
    successMsg: 'Asset marked lost',
  },
  retire: {
    label: 'Retire', icon: <Archive className="h-4 w-4" />, status: 'RETIRED',
    confirmTitle: 'Retire asset', confirmBody: 'Take this asset out of active service. It can still be disposed later.',
    successMsg: 'Asset retired',
  },
  dispose: {
    label: 'Dispose', icon: <Trash2 className="h-4 w-4" />, status: 'DISPOSED', danger: true,
    confirmTitle: 'Dispose asset', confirmBody: 'Permanently retire this asset from the inventory. This is the end of its lifecycle.',
    successMsg: 'Asset disposed',
  },
};

// Which actions are offered for each status. The server enforces the same
// rules (e.g. an ALLOCATED asset must be returned before most transitions),
// so this only controls what the UI surfaces.
const ACTIONS_BY_STATUS: Record<AssetStatus, ActionKey[]> = {
  AVAILABLE: ['allocate', 'reserve', 'repair', 'lost', 'retire', 'dispose'],
  RESERVED: ['allocate', 'available', 'repair', 'lost', 'retire', 'dispose'],
  ALLOCATED: ['return', 'lost'],
  UNDER_MAINTENANCE: ['available', 'lost', 'retire', 'dispose'],
  LOST: ['available', 'retire', 'dispose'],
  RETIRED: ['available', 'dispose'],
  DISPOSED: [],
};

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { data: asset, loading, refetch } = useApi<Asset>(`/assets/${id}`, [id]);
  const [tab, setTab] = useState('overview');
  const [returnModal, setReturnModal] = useState(false);
  const [confirmKey, setConfirmKey] = useState<ActionKey | null>(null);

  if (loading || !asset) return <Spinner label="Loading asset..." />;

  const canManage = hasRole('ADMIN', 'ASSET_MANAGER');
  const allocations = asset.allocations ?? [];
  const activeAllocation = allocations.find((a) => a.status === 'ACTIVE') ?? null;
  const quickActions = ACTIONS_BY_STATUS[asset.status] ?? [];

  const runAction = (key: ActionKey) => {
    if (key === 'allocate') return navigate(`/allocations?asset=${asset.id}`);
    if (key === 'return') return setReturnModal(true);
    setConfirmKey(key); // status transition — confirm first
  };
  const maintenance = asset.maintenanceRequests ?? [];
  const bookings = asset.bookings ?? [];
  const transfers = asset.transferRequests ?? [];
  const custom = (asset.customData as Record<string, unknown>) ?? {};

  // Full lifecycle: registration + allocations + returns + maintenance + transfers,
  // newest first. Each kind gets its own colour so the event types are distinct.
  const DOT: Record<string, string> = {
    register: 'bg-emerald-500',
    alloc: 'bg-accent-500',
    return: 'bg-sky-500',
    maint: 'bg-amber-500',
    transfer: 'bg-violet-500',
  };
  const timeline = [
    ...(asset.createdAt ? [{ t: asset.createdAt, text: 'Registered', kind: 'register' as const }] : []),
    ...allocations.map((a) => ({
      t: a.allocatedAt,
      text: a.holder ? `Allocated to ${a.holder.name}` : a.holderDepartment ? `Allocated to ${a.holderDepartment.name} (department)` : 'Allocated',
      kind: 'alloc' as const,
    })),
    ...allocations
      .filter((a) => a.returnedAt)
      .map((a) => ({ t: a.returnedAt as string, text: `Returned${a.returnCondition ? ` — ${titleCase(a.returnCondition)}` : ''}`, kind: 'return' as const })),
    ...maintenance.map((m) => ({ t: m.createdAt, text: `Maintenance: ${titleCase(m.status)}`, kind: 'maint' as const })),
    ...transfers.map((tr) => ({
      t: tr.createdAt,
      text: `Transfer ${titleCase(tr.status)}${tr.toUser ? ` to ${tr.toUser.name}` : ''}`,
      kind: 'transfer' as const,
    })),
  ]
    .filter((e) => e.t)
    .sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime());

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

          <div className="mt-4 flex items-center gap-3 rounded-lg border border-surface-border bg-surface-muted p-3">
            {asset.currentHolder ? (
              <>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${avatarColor(asset.currentHolder.name)}`}>
                  {initials(asset.currentHolder.name)}
                </div>
                <div>
                  <p className="micro-label">Held by</p>
                  <p className="text-sm font-medium text-ink-800">{asset.currentHolder.name}</p>
                </div>
              </>
            ) : (
              <div>
                <p className="micro-label">Held by</p>
                <p className="text-sm text-ink-500">Not currently allocated</p>
              </div>
            )}
          </div>

          {/* Quick actions — contextual to the current status, sitting right
              under "Held by". Employees don't see these. */}
          {canManage && (
            <div className="mt-4">
              <p className="micro-label mb-2">Quick actions</p>
              {quickActions.length === 0 ? (
                <p className="text-xs text-ink-400">No further actions — this asset has been disposed.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map((key) => {
                    const meta = ACTION_META[key];
                    return (
                      <Button
                        key={key}
                        variant={meta.danger ? 'danger' : 'secondary'}
                        size="sm"
                        className="justify-center"
                        onClick={() => runAction(key)}
                      >
                        {meta.icon} {meta.label}
                      </Button>
                    );
                  })}
                </div>
              )}
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
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                  <p className="micro-label">Lifecycle timeline</p>
                  {timeline.length === 0 ? (
                    <EmptyState title="No history yet" subtitle="Registration, allocation, return, maintenance and transfer events will appear here." />
                  ) : (
                    <ol className="relative space-y-4 border-l border-surface-border pl-5">
                      {timeline.slice(0, 20).map((e, i) => (
                        <li key={i}>
                          <span className={`absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full ${DOT[e.kind] ?? 'bg-ink-400'}`} />
                          <p className="text-sm text-ink-700">{e.text}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-ink-400">{fmtDateTime(e.t)}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div className="lg:col-span-1">
                  <p className="micro-label mb-3">QR label</p>
                  <div className="rounded-lg border border-surface-border bg-surface-muted p-4">
                    <AssetQr asset={asset} size={128} />
                  </div>
                </div>
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

      {returnModal && activeAllocation && (
        <ReturnModal
          allocation={activeAllocation}
          onClose={() => setReturnModal(false)}
          onSaved={() => { setReturnModal(false); refetch(); }}
        />
      )}
      {confirmKey && (
        <ActionModal
          asset={asset}
          action={confirmKey}
          onClose={() => setConfirmKey(null)}
          onSaved={() => { setConfirmKey(null); refetch(); }}
        />
      )}
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

// Confirm + run a status-transition quick action (reserve, repair, retire, ...).
function ActionModal({ asset, action, onClose, onSaved }: { asset: Asset; action: ActionKey; onClose: () => void; onSaved: () => void }) {
  const meta = ACTION_META[action];
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      await api.post(`/assets/${asset.id}/status`, { status: meta.status, note: note || undefined });
      toast.success(meta.successMsg ?? 'Asset updated');
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
      title={meta.confirmTitle ?? meta.label}
      subtitle={`${asset.assetTag} — ${asset.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={meta.danger ? 'danger' : 'primary'} onClick={save} loading={loading}>{meta.label}</Button></>}
    >
      <div className="space-y-4">
        {meta.confirmBody && <p className="text-sm text-ink-600">{meta.confirmBody}</p>}
        <Field label="Note (optional)">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / details" />
        </Field>
      </div>
    </Modal>
  );
}

// Return an allocated asset from the identity card, mirroring the flow on the
// Allocations page (condition + check-in notes).
function ReturnModal({ allocation, onClose, onSaved }: { allocation: Allocation; onClose: () => void; onSaved: () => void }) {
  const [returnCondition, setReturnCondition] = useState<Asset['condition']>('GOOD');
  const [checkInNotes, setCheckInNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await api.post(`/allocations/${allocation.id}/return`, { returnCondition, checkInNotes: checkInNotes || undefined });
      toast.success('Asset returned');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const holderName = allocation.holder?.name ?? allocation.holderDepartment?.name ?? 'current holder';

  return (
    <Modal
      open
      onClose={onClose}
      title="Return asset"
      subtitle={`Returning from ${holderName}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={loading}>Confirm return</Button></>}
    >
      <div className="space-y-4">
        <Field label="Condition on return">
          <Select value={returnCondition} onChange={(e) => setReturnCondition(e.target.value as Asset['condition'])}>
            {CONDITIONS.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
          </Select>
        </Field>
        <Field label="Check-in notes (optional)">
          <Textarea rows={3} value={checkInNotes} onChange={(e) => setCheckInNotes(e.target.value)} placeholder="Condition details, accessories returned..." />
        </Field>
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-ink-500">
          The asset status will revert to <span className="font-medium text-ink-700">Available</span> after return.
        </p>
      </div>
    </Modal>
  );
}
