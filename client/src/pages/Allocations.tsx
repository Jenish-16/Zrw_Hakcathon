import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, HandCoins, RotateCcw, AlertTriangle } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { api, errorMessage } from '../lib/api';
import { Allocation, Asset, User } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from '../components/ui';
import { titleCase, fmtDate, initials, avatarColor } from '../lib/format';

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

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === f.key ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-surface-border hover:bg-slate-50'
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
                  <tr key={a.id} className={`transition hover:bg-slate-50 ${a.isOverdue ? 'bg-rose-50/40' : ''}`}>
                    <td className="table-cell">
                      <p className="font-semibold text-slate-800">{a.asset?.name}</p>
                      <p className="font-mono text-xs text-slate-400">{a.asset?.assetTag}</p>
                    </td>
                    <td className="table-cell">
                      {a.holder ? (
                        <div className="flex items-center gap-2">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${avatarColor(a.holder.name)}`}>
                            {initials(a.holder.name)}
                          </div>
                          <span className="text-slate-600">{a.holder.name}</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="table-cell text-slate-600">{fmtDate(a.allocatedAt)}</td>
                    <td className="table-cell">
                      {a.expectedReturnDate ? (
                        <span className={`inline-flex items-center gap-1.5 ${a.isOverdue ? 'font-semibold text-rose-600' : 'text-slate-600'}`}>
                          {a.isOverdue && <AlertTriangle className="h-3.5 w-3.5" />}
                          {fmtDate(a.expectedReturnDate)}
                          {a.isOverdue && <Badge className="bg-rose-50 text-rose-700 ring-rose-600/20">Overdue</Badge>}
                        </span>
                      ) : (
                        <span className="text-slate-300">No date</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <Badge className={a.status === 'ACTIVE' ? 'bg-brand-50 text-brand-700 ring-brand-600/20' : 'bg-slate-100 text-slate-600 ring-slate-500/20'}>
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
  const { data: assets } = useApi<Asset[]>('/assets?status=AVAILABLE');
  const { data: users } = useApi<User[]>('/users?status=ACTIVE');
  const [assetId, setAssetId] = useState(presetAssetId);
  const [holderId, setHolderId] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!assetId || !holderId) {
      toast.error('Select both an asset and an employee');
      return;
    }
    setLoading(true);
    try {
      await api.post('/allocations', {
        assetId,
        holderId,
        expectedReturnDate: expectedReturnDate || null,
        note: note || undefined,
      });
      toast.success('Asset allocated');
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
      title="New allocation"
      subtitle="Assign an available asset to an employee."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={loading}>Allocate</Button></>}
    >
      <div className="space-y-4">
        <Field label="Asset" required hint="Only available assets can be allocated.">
          <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            <option value="">Select an available asset</option>
            {assets?.map((a) => <option key={a.id} value={a.id}>{a.assetTag} — {a.name}</option>)}
          </Select>
        </Field>
        <Field label="Allocate to" required>
          <Select value={holderId} onChange={(e) => setHolderId(e.target.value)}>
            <option value="">Select an employee</option>
            {users?.map((u) => <option key={u.id} value={u.id}>{u.name}{u.department ? ` · ${u.department.name}` : ''}</option>)}
          </Select>
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
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          The asset status will revert to <span className="font-semibold">Available</span> after return.
        </p>
      </div>
    </Modal>
  );
}
