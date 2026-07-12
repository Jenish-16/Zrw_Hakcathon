import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, ArrowLeftRight, ArrowRight, Check, X, CircleUser } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { api, errorMessage } from '../lib/api';
import { Asset, TransferRequest, User } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Select, Spinner, Textarea } from '../components/ui';
import { titleCase, fromNow, initials, avatarColor } from '../lib/format';
import { transferStatusStyle } from '../lib/status';

const STATUS_FILTERS = ['', 'REQUESTED', 'COMPLETED', 'REJECTED'];

export default function Transfers() {
  const { hasRole } = useAuth();
  const canDecide = hasRole('ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD');
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [rejecting, setRejecting] = useState<TransferRequest | null>(null);

  const query = useMemo(() => (status ? `?status=${status}` : ''), [status]);
  const { data: transfers, loading, refetch } = useApi<TransferRequest[]>(`/transfers${query}`, [query]);

  const approve = async (t: TransferRequest) => {
    try {
      await api.post(`/transfers/${t.id}/approve`, {});
      toast.success('Transfer approved and asset re-allocated');
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Transfers"
        subtitle="Reassign assets through a request → approval workflow."
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> Request Transfer
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatus(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              status === s ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-surface-border hover:bg-slate-50'
            }`}
          >
            {s ? titleCase(s) : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : !transfers || transfers.length === 0 ? (
        <Card><EmptyState icon={<ArrowLeftRight className="h-6 w-6" />} title="No transfer requests" subtitle="Requests to move assets between people will show up here." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {transfers.map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">{t.asset?.name}</p>
                  <p className="font-mono text-xs text-slate-400">{t.asset?.assetTag}</p>
                </div>
                <Badge className={transferStatusStyle[t.status]}>{titleCase(t.status)}</Badge>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                <Party name={t.fromUser?.name ?? 'Unassigned'} />
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <Party name={t.toUser?.name ?? '—'} />
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Requested by <span className="font-medium text-slate-500">{t.requestedBy?.name}</span> · {fromNow(t.createdAt)}
              </p>
              {t.note && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">“{t.note}”</p>}
              {t.decisionNote && (
                <p className="mt-2 text-xs text-slate-500">
                  Decision note: <span className="italic">{t.decisionNote}</span>
                  {t.approvedBy ? ` — ${t.approvedBy.name}` : ''}
                </p>
              )}

              {t.status === 'REQUESTED' && canDecide && (
                <div className="mt-4 flex gap-2">
                  <Button size="sm" onClick={() => approve(t)}><Check className="h-3.5 w-3.5" /> Approve</Button>
                  <Button size="sm" variant="danger" onClick={() => setRejecting(t)}><X className="h-3.5 w-3.5" /> Reject</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {showForm && <RequestModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refetch(); }} />}
      {rejecting && <RejectModal transfer={rejecting} onClose={() => setRejecting(null)} onSaved={() => { setRejecting(null); refetch(); }} />}
    </div>
  );
}

function Party({ name }: { name: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {name === 'Unassigned' || name === '—' ? (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400"><CircleUser className="h-4 w-4" /></div>
      ) : (
        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold ${avatarColor(name)}`}>{initials(name)}</div>
      )}
      <span className="truncate text-sm font-medium text-slate-700">{name}</span>
    </div>
  );
}

function RequestModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: assets } = useApi<Asset[]>('/assets');
  const { data: users } = useApi<User[]>('/users?status=ACTIVE');
  const [assetId, setAssetId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!assetId || !toUserId) {
      toast.error('Select an asset and a recipient');
      return;
    }
    setLoading(true);
    try {
      await api.post('/transfers', { assetId, toUserId, note: note || undefined });
      toast.success('Transfer request submitted');
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
      title="Request transfer"
      subtitle="Ask to reassign an asset to another employee."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={loading}>Submit request</Button></>}
    >
      <div className="space-y-4">
        <Field label="Asset" required>
          <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            <option value="">Select an asset</option>
            {assets?.map((a) => <option key={a.id} value={a.id}>{a.assetTag} — {a.name}</option>)}
          </Select>
        </Field>
        <Field label="Transfer to" required>
          <Select value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
            <option value="">Select an employee</option>
            {users?.map((u) => <option key={u.id} value={u.id}>{u.name}{u.department ? ` · ${u.department.name}` : ''}</option>)}
          </Select>
        </Field>
        <Field label="Reason / note (optional)">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why is this transfer needed?" />
        </Field>
      </div>
    </Modal>
  );
}

function RejectModal({ transfer, onClose, onSaved }: { transfer: TransferRequest; onClose: () => void; onSaved: () => void }) {
  const [decisionNote, setDecisionNote] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await api.post(`/transfers/${transfer.id}/reject`, { decisionNote: decisionNote || undefined });
      toast.success('Transfer rejected');
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
      title="Reject transfer"
      subtitle={`${transfer.asset?.assetTag} — ${transfer.asset?.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" onClick={submit} loading={loading}>Reject</Button></>}
    >
      <Field label="Reason (optional)">
        <Textarea rows={3} value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} placeholder="Explain why this request is being rejected..." />
      </Field>
    </Modal>
  );
}
