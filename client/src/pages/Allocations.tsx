import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, HandCoins, RotateCcw, AlertTriangle, Building2, ArrowLeftRight } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { api, errorMessage } from '../lib/api';
import { Allocation, Asset, Department, User } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from '../components/ui';
import { titleCase, fmtDate, initials, avatarColor } from '../lib/format';
import { RequestModal } from './Transfers';

const CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];
type FilterKey = 'all' | 'active' | 'overdue' | 'returned';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'returned', label: 'Returned' },
];

export default function Allocations() {
  const { hasRole } = useAuth();
  const canManage = hasRole('ADMIN', 'ASSET_MANAGER');
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<FilterKey>(params.get('overdue') === 'true' ? 'overdue' : 'all');
  const [showForm, setShowForm] = useState(false);
  const [presetAsset, setPresetAsset] = useState<string>('');
  const [returning, setReturning] = useState<Allocation | null>(null);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (filter === 'active') q.set('status', 'ACTIVE');
    else if (filter === 'returned') q.set('status', 'RETURNED');
    else if (filter === 'overdue') q.set('overdue', 'true');
    return q.toString();
  }, [filter]);

  const { data: allocations, loading, refetch } = useApi<Allocation[]>(`/allocations?${query}`, [query]);

  useEffect(() => {
    const asset = params.get('asset');
    if (asset && canManage) {
      setPresetAsset(asset);
      setShowForm(true);
      params.delete('asset');
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Asset Allocation"
        subtitle="Manage who holds what, with conflict handling and return tracking."
        actions={
          canManage && (
            <Button onClick={() => { setPresetAsset(''); setShowForm(true); }}>
              <Plus className="h-4 w-4" /> New Allocation
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              filter === f.key ? 'bg-ink-900 text-white' : 'bg-surface text-ink-600 ring-1 ring-surface-border hover:bg-surface-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <Spinner />
        ) : !allocations || allocations.length === 0 ? (
          <EmptyState icon={<HandCoins className="h-6 w-6" />} title="No allocations found" subtitle="Allocations will appear here once assets are assigned." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr>
                  <th className="table-head">Asset</th>
                  <th className="table-head">Holder</th>
                  <th className="table-head">Allocated</th>
                  <th className="table-head">Expected return</th>
                  <th className="table-head">Status</th>
                  <th className="table-head" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {allocations.map((a) => (
                  <tr key={a.id} className={`transition-colors hover:bg-surface-muted ${a.isOverdue ? 'bg-danger-50/50' : ''}`}>
                    <td className="table-cell">
                      <p className="text-[13px] font-medium text-ink-800">{a.asset?.name}</p>
                      <p className="font-mono text-xs text-ink-400">{a.asset?.assetTag}</p>
                    </td>
                    <td className="table-cell">
                      {a.holder ? (
                        <div className="flex items-center gap-2">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${avatarColor(a.holder.name)}`}>
                            {initials(a.holder.name)}
                          </div>
                          <span className="text-ink-600">{a.holder.name}</span>
                        </div>
                      ) : a.holderDepartment ? (
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-100 text-ink-500">
                            <Building2 className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-ink-600">{a.holderDepartment.name}</span>
                          <span className="text-xs text-ink-400">· Department</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="table-cell font-mono text-[13px] tabular-nums text-ink-600">{fmtDate(a.allocatedAt)}</td>
                    <td className="table-cell">
                      {a.expectedReturnDate ? (
                        <span className={`inline-flex items-center gap-1.5 ${a.isOverdue ? 'font-medium text-danger-600' : 'text-ink-600'}`}>
                          {a.isOverdue && <AlertTriangle className="h-3.5 w-3.5" />}
                          <span className="font-mono text-[13px] tabular-nums">{fmtDate(a.expectedReturnDate)}</span>
                          {a.isOverdue && <Badge className="bg-danger-600/10 text-danger-700 ring-danger-600/20">Overdue</Badge>}
                        </span>
                      ) : (
                        <span className="text-ink-300">No date</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <Badge className={a.status === 'ACTIVE' ? 'bg-accent-500/10 text-accent-800 ring-accent-600/20' : 'bg-ink-500/10 text-ink-600 ring-ink-400/25'}>
                        {titleCase(a.status)}
                      </Badge>
                    </td>
                    <td className="table-cell text-right">
                      {a.status === 'ACTIVE' && (
                        <Button variant="secondary" size="sm" onClick={() => setReturning(a)}>
                          <RotateCcw className="h-3.5 w-3.5" /> Return
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && (
        <AllocateModal
          presetAssetId={presetAsset}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refetch(); }}
        />
      )}
      {returning && (
        <ReturnModal
          allocation={returning}
          onClose={() => setReturning(null)}
          onSaved={() => { setReturning(null); refetch(); }}
        />
      )}
    </div>
  );
}

function AllocateModal({ presetAssetId, onClose, onSaved }: { presetAssetId: string; onClose: () => void; onSaved: () => void }) {
  const { data: assets } = useApi<Asset[]>('/assets');
  // Only assets that are free to allocate: no active holder and not in a
  // non-allocatable state (maintenance/lost/retired/disposed). Mirrors the
  // server-side rule in POST /allocations.
  const allocatableAssets = (assets ?? []).filter(
    (a) => !a.currentHolder && !['UNDER_MAINTENANCE', 'LOST', 'RETIRED', 'DISPOSED'].includes(a.status),
  );
  // Only employees who currently hold nothing are eligible to receive an allocation.
  const { data: users } = useApi<User[]>('/users?status=ACTIVE&unallocated=true');
  const { data: departments } = useApi<Department[]>('/departments');
  const [assetId, setAssetId] = useState(presetAssetId);
  const [holderType, setHolderType] = useState<'employee' | 'department'>('employee');
  const [holderId, setHolderId] = useState('');
  const [holderDepartmentId, setHolderDepartmentId] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  // Set when the backend blocks a double-allocation (HTTP 409): holds the
  // server's "currently held by X" message so we can offer a transfer instead.
  const [conflictMsg, setConflictMsg] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);

  const submit = async () => {
    if (!assetId || (holderType === 'employee' ? !holderId : !holderDepartmentId)) {
      toast.error(holderType === 'employee' ? 'Select both an asset and an employee' : 'Select both an asset and a department');
      return;
    }
    setConflictMsg('');
    setLoading(true);
    try {
      await api.post('/allocations', {
        assetId,
        ...(holderType === 'employee' ? { holderId } : { holderDepartmentId }),
        expectedReturnDate: expectedReturnDate || null,
        note: note || undefined,
      });
      toast.success('Asset allocated');
      onSaved();
    } catch (err) {
      // 409 = already held by someone — show the block + a transfer path
      // instead of a plain error toast (spec's Priya/Raj scenario).
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) setConflictMsg(errorMessage(err));
      else toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Hand off to the existing transfer-request flow with the asset pre-selected.
  if (showTransfer) {
    return <RequestModal presetAssetId={assetId} onClose={onClose} onSaved={onClose} />;
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New allocation"
      subtitle="Assign an asset to an employee or a whole department."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={loading}>Allocate</Button></>}
    >
      <div className="space-y-4">
        {conflictMsg && (
          <div className="rounded-lg border border-l-2 border-surface-border border-l-danger-600 bg-surface p-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger-600" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-ink-700">{conflictMsg}</p>
                <Button size="sm" variant="secondary" className="mt-2.5" onClick={() => setShowTransfer(true)}>
                  <ArrowLeftRight className="h-3.5 w-3.5" /> Request Transfer
                </Button>
              </div>
            </div>
          </div>
        )}

        <Field label="Asset" required hint="Only assets that are free to allocate are listed. Held assets must be reassigned via a transfer request.">
          <Select value={assetId} onChange={(e) => { setAssetId(e.target.value); setConflictMsg(''); }}>
            <option value="">Select an asset</option>
            {allocatableAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.assetTag} — {a.name}
                {a.status !== 'AVAILABLE' ? ` (${titleCase(a.status)})` : ''}
              </option>
            ))}
          </Select>
        </Field>

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
      </div>
    </Modal>
  );
}

function ReturnModal({ allocation, onClose, onSaved }: { allocation: Allocation; onClose: () => void; onSaved: () => void }) {
  const [returnCondition, setReturnCondition] = useState('GOOD');
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

  return (
    <Modal
      open
      onClose={onClose}
      title="Return asset"
      subtitle={`${allocation.asset?.assetTag} — ${allocation.asset?.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={loading}>Confirm return</Button></>}
    >
      <div className="space-y-4">
        <Field label="Condition on return">
          <Select value={returnCondition} onChange={(e) => setReturnCondition(e.target.value)}>
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
