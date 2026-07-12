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
  X,
} from 'lucide-react';
import { AssetQr } from '../components/AssetQr';
import { useApi } from '../lib/useApi';
import { api, errorMessage } from '../lib/api';
import { Asset, AssetStatus, Allocation, User, Department } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, EmptyState, Select, Spinner, Tabs, Field, Input, Textarea } from '../components/ui';
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
  short: string; // compact label shown on the quick-action chip
  icon: JSX.Element;
  danger?: boolean;
  status?: AssetStatus; // set for status-transition actions
  confirmTitle?: string;
  confirmBody?: string;
  successMsg?: string;
};

const ACTION_META: Record<ActionKey, ActionMeta> = {
  allocate: { label: 'Allocate', short: 'Allocate', icon: <HandCoins className="h-4 w-4" /> },
  return: { label: 'Return', short: 'Return', icon: <Undo2 className="h-4 w-4" /> },
  reserve: {
    label: 'Reserve', short: 'Reserve', icon: <BookmarkPlus className="h-4 w-4" />, status: 'RESERVED',
    confirmTitle: 'Reserve asset', confirmBody: 'Hold this asset as reserved so it is not allocated to anyone else.',
    successMsg: 'Asset reserved',
  },
  available: {
    label: 'Mark available', short: 'Available', icon: <PackageCheck className="h-4 w-4" />, status: 'AVAILABLE',
    confirmTitle: 'Mark available', confirmBody: 'Return this asset to the available pool so it can be allocated again.',
    successMsg: 'Asset marked available',
  },
  repair: {
    label: 'Send for repair', short: 'Repair', icon: <Wrench className="h-4 w-4" />, status: 'UNDER_MAINTENANCE',
    confirmTitle: 'Send for repair', confirmBody: 'Mark this asset as under maintenance while it is being repaired.',
    successMsg: 'Asset sent for repair',
  },
  lost: {
    label: 'Mark lost', short: 'Lost', icon: <HelpCircle className="h-4 w-4" />, status: 'LOST', danger: true,
    confirmTitle: 'Mark asset as lost', confirmBody: 'Flag this asset as lost. You can mark it available again if it is found.',
    successMsg: 'Asset marked lost',
  },
  retire: {
    label: 'Retire', short: 'Retire', icon: <Archive className="h-4 w-4" />, status: 'RETIRED',
    confirmTitle: 'Retire asset', confirmBody: 'Take this asset out of active service. It can still be disposed later.',
    successMsg: 'Asset retired',
  },
  dispose: {
    label: 'Dispose', short: 'Dispose', icon: <Trash2 className="h-4 w-4" />, status: 'DISPOSED', danger: true,
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
  const [dialogAction, setDialogAction] = useState<ActionKey | null>(null);

  if (loading || !asset) return <Spinner label="Loading asset..." />;

  const canManage = hasRole('ADMIN', 'ASSET_MANAGER');
  const allocations = asset.allocations ?? [];
  const activeAllocation = allocations.find((a) => a.status === 'ACTIVE') ?? null;
  const quickActions = ACTIONS_BY_STATUS[asset.status] ?? [];
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
                <div className="flex flex-wrap gap-2">
                  {quickActions.map((key) => {
                    const meta = ACTION_META[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setDialogAction(key)}
                        title={meta.label}
                        aria-label={meta.label}
                        className={`flex w-[4.25rem] flex-col items-center gap-1.5 rounded-lg border px-1 py-2 transition-colors ${
                          meta.danger
                            ? 'border-red-600/20 text-red-600 hover:bg-red-500/10'
                            : 'border-surface-border text-ink-500 hover:bg-surface-muted hover:text-ink-800'
                        }`}
                      >
                        {meta.icon}
                        <span className="text-[11px] font-medium leading-none">{meta.short}</span>
                      </button>
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

      {dialogAction && (
        <ActionDialog
          asset={asset}
          action={dialogAction}
          activeAllocation={activeAllocation}
          onClose={() => setDialogAction(null)}
          onSaved={() => { setDialogAction(null); refetch(); }}
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

// --- Full-screen action dialog ---------------------------------------------
// Every quick action opens here: a top bar (title + Cancel), a body split into
// an asset-summary panel (left) and the action's fields (right), and a bottom
// bar with the submit button. The right-hand fields differ per action.
function ActionDialog({
  asset,
  action,
  activeAllocation,
  onClose,
  onSaved,
}: {
  asset: Asset;
  action: ActionKey;
  activeAllocation: Allocation | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const meta = ACTION_META[action];
  const [loading, setLoading] = useState(false);

  // Allocate-only data (skipped for every other action via the null URL).
  const { data: users } = useApi<User[]>(action === 'allocate' ? '/users?status=ACTIVE&unallocated=true' : null);
  const { data: departments } = useApi<Department[]>(action === 'allocate' ? '/departments' : null);

  // Field state — a superset; each action reads only what it needs.
  const [holderType, setHolderType] = useState<'employee' | 'department'>('employee');
  const [holderId, setHolderId] = useState('');
  const [holderDepartmentId, setHolderDepartmentId] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [returnCondition, setReturnCondition] = useState<Asset['condition']>('GOOD');
  const [note, setNote] = useState('');

  const title = `${meta.label} ${asset.name}`;

  const submit = async () => {
    setLoading(true);
    try {
      if (action === 'allocate') {
        if (holderType === 'employee' ? !holderId : !holderDepartmentId) {
          toast.error(holderType === 'employee' ? 'Select an employee' : 'Select a department');
          setLoading(false);
          return;
        }
        await api.post('/allocations', {
          assetId: asset.id,
          ...(holderType === 'employee' ? { holderId } : { holderDepartmentId }),
          expectedReturnDate: expectedReturnDate || null,
          note: note || undefined,
        });
        toast.success('Asset allocated');
      } else if (action === 'return') {
        if (!activeAllocation) {
          toast.error('No active allocation to return');
          setLoading(false);
          return;
        }
        await api.post(`/allocations/${activeAllocation.id}/return`, {
          returnCondition,
          checkInNotes: note || undefined,
        });
        toast.success('Asset returned');
      } else {
        await api.post(`/assets/${asset.id}/status`, { status: meta.status, note: note || undefined });
        toast.success(meta.successMsg ?? 'Asset updated');
      }
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Close on Escape for keyboard users.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={onKeyDown}
      className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-surface"
    >
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-surface-border px-5 py-3.5 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${meta.danger ? 'bg-red-500/10 text-red-600' : 'bg-accent-500/10 text-accent-700'}`}>
            {meta.icon}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight text-ink-900">{title}</h2>
            <p className="truncate font-mono text-xs text-ink-400">{asset.assetTag}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onClose}>
          <X className="h-4 w-4" /> Cancel
        </Button>
      </header>

      {/* Body: asset summary (left) + action fields (right) */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 px-5 py-6 sm:px-8 md:grid-cols-5">
          {/* Left — asset summary */}
          <aside className="md:col-span-2">
            <Card className="p-4">
              {asset.photoUrl && (
                <img src={asset.photoUrl} alt={asset.name} className="mb-3 h-32 w-full rounded-lg border border-surface-border object-cover" />
              )}
              <p className="micro-label mb-2">Asset</p>
              <p className="text-sm font-semibold text-ink-900">{asset.name}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge className={assetStatusStyle[asset.status]}>{titleCase(asset.status)}</Badge>
                <Badge className={conditionStyle[asset.condition]}>{titleCase(asset.condition)}</Badge>
              </div>
              <dl className="mt-4 space-y-2.5 border-t border-surface-border pt-3">
                <SummaryRow label="Category" value={asset.category?.name} />
                <SummaryRow label="Department" value={asset.department?.name ?? 'Unassigned'} />
                <SummaryRow label="Location" value={asset.location ?? '—'} />
                <SummaryRow label="Serial no." value={asset.serialNumber ?? '—'} />
                <SummaryRow label="Held by" value={asset.currentHolder?.name ?? 'Not allocated'} />
              </dl>
            </Card>
          </aside>

          {/* Right — action fields */}
          <section className="md:col-span-3">
            <div className="space-y-4">
              {action === 'allocate' && (
                <>
                  <Field label="Allocate to" required>
                    <div className="mb-2 flex gap-1.5">
                      {(['employee', 'department'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setHolderType(t)}
                          className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                            holderType === t ? 'bg-ink-900 text-white' : 'bg-surface text-ink-600 ring-1 ring-surface-border hover:bg-surface-muted'
                          }`}
                        >
                          {t === 'employee' ? 'Employee' : 'Department'}
                        </button>
                      ))}
                    </div>
                    {holderType === 'employee' ? (
                      <Select value={holderId} onChange={(e) => setHolderId(e.target.value)}>
                        <option value="">Select an employee</option>
                        {users?.map((u) => <option key={u.id} value={u.id}>{u.name}{u.department ? ` · ${u.department.name}` : ''}</option>)}
                      </Select>
                    ) : (
                      <Select value={holderDepartmentId} onChange={(e) => setHolderDepartmentId(e.target.value)}>
                        <option value="">Select a department</option>
                        {departments?.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                      </Select>
                    )}
                  </Field>
                  <Field label="Expected return date (optional)">
                    <Input type="date" value={expectedReturnDate} onChange={(e) => setExpectedReturnDate(e.target.value)} />
                  </Field>
                  <Field label="Note (optional)">
                    <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any handover notes..." />
                  </Field>
                </>
              )}

              {action === 'return' && (
                <>
                  <Field label="Condition on return">
                    <Select value={returnCondition} onChange={(e) => setReturnCondition(e.target.value as Asset['condition'])}>
                      {CONDITIONS.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
                    </Select>
                  </Field>
                  <Field label="Check-in notes (optional)">
                    <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Condition details, accessories returned..." />
                  </Field>
                  <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-ink-500">
                    The asset status will revert to <span className="font-medium text-ink-700">Available</span> after return.
                  </p>
                </>
              )}

              {action !== 'allocate' && action !== 'return' && (
                <>
                  {meta.confirmBody && <p className="text-sm text-ink-600">{meta.confirmBody}</p>}
                  <Field label="Note (optional)">
                    <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / details" />
                  </Field>
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Bottom bar */}
      <footer className="flex items-center justify-end gap-2 border-t border-surface-border px-5 py-3.5 sm:px-8">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={meta.danger ? 'danger' : 'primary'} onClick={submit} loading={loading}>{meta.label}</Button>
      </footer>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="truncate text-[13px] font-medium text-ink-700">{value}</dd>
    </div>
  );
}
