import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Wrench, Check, X, UserCog, Play, CheckCircle2 } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { api, errorMessage } from '../lib/api';
import { Asset, MaintenanceRequest, MaintenanceStatus } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from '../components/ui';
import { maintenanceStatusStyle, priorityStyle } from '../lib/status';
import { titleCase, fmtDate, fromNow, initials, avatarColor } from '../lib/format';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];
const STATUS_FILTERS = ['', 'PENDING', 'APPROVED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];
const STEPS: MaintenanceStatus[] = ['PENDING', 'APPROVED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS', 'RESOLVED'];

export default function Maintenance() {
  const { hasRole } = useAuth();
  const canManage = hasRole('ADMIN', 'ASSET_MANAGER');
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [modal, setModal] = useState<{ type: 'reject' | 'assign' | 'resolve'; req: MaintenanceRequest } | null>(null);

  const query = useMemo(() => (status ? `?status=${status}` : ''), [status]);
  const { data: requests, loading, refetch } = useApi<MaintenanceRequest[]>(`/maintenance${query}`, [query]);

  useEffect(() => {
    if (params.get('action') === 'new') {
      setShowForm(true);
      params.delete('action');
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (req: MaintenanceRequest, path: string, body?: object, msg?: string) => {
    try {
      await api.post(`/maintenance/${req.id}/${path}`, body ?? {});
      toast.success(msg ?? 'Updated');
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Maintenance"
        subtitle="Route repairs through an approval workflow before work begins."
        actions={<Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Raise Request</Button>}
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
      ) : !requests || requests.length === 0 ? (
        <Card><EmptyState icon={<Wrench className="h-6 w-6" />} title="No maintenance requests" subtitle="Raise a request to report an asset that needs repair." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {requests.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">{r.asset?.name}</p>
                  <p className="font-mono text-xs text-slate-400">{r.asset?.assetTag}</p>
                </div>
                <div className="flex flex-shrink-0 gap-1.5">
                  <Badge className={priorityStyle[r.priority]}>{titleCase(r.priority)}</Badge>
                  <Badge className={maintenanceStatusStyle[r.status]}>{titleCase(r.status)}</Badge>
                </div>
              </div>

              <p className="mt-3 text-sm text-slate-600">{r.description}</p>

              {r.status !== 'REJECTED' && <Stepper status={r.status} />}

              <div className="mt-3 space-y-1 text-xs text-slate-400">
                <p>Raised by <span className="font-medium text-slate-500">{r.raisedBy?.name}</span> · {fromNow(r.createdAt)}</p>
                {r.technicianName && <p>Technician: <span className="font-medium text-slate-500">{r.technicianName}</span></p>}
                {r.resolutionNotes && <p>Resolution: <span className="italic">{r.resolutionNotes}</span> {r.resolvedAt ? `(${fmtDate(r.resolvedAt)})` : ''}</p>}
                {r.decisionNote && <p>Note: <span className="italic">{r.decisionNote}</span></p>}
              </div>

              {canManage && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {r.status === 'PENDING' && (
                    <>
                      <Button size="sm" onClick={() => act(r, 'approve', {}, 'Approved — asset under maintenance')}><Check className="h-3.5 w-3.5" /> Approve</Button>
                      <Button size="sm" variant="danger" onClick={() => setModal({ type: 'reject', req: r })}><X className="h-3.5 w-3.5" /> Reject</Button>
                    </>
                  )}
                  {r.status === 'APPROVED' && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'assign', req: r })}><UserCog className="h-3.5 w-3.5" /> Assign Technician</Button>
                      <Button size="sm" onClick={() => act(r, 'start', {}, 'Work started')}><Play className="h-3.5 w-3.5" /> Start Work</Button>
                    </>
                  )}
                  {r.status === 'TECHNICIAN_ASSIGNED' && (
                    <Button size="sm" onClick={() => act(r, 'start', {}, 'Work started')}><Play className="h-3.5 w-3.5" /> Start Work</Button>
                  )}
                  {r.status === 'IN_PROGRESS' && (
                    <Button size="sm" onClick={() => setModal({ type: 'resolve', req: r })}><CheckCircle2 className="h-3.5 w-3.5" /> Resolve</Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {showForm && <RaiseModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refetch(); }} />}
      {modal?.type === 'reject' && <RejectModal req={modal.req} onClose={() => setModal(null)} onDone={() => { setModal(null); refetch(); }} />}
      {modal?.type === 'assign' && <AssignModal req={modal.req} onClose={() => setModal(null)} onDone={() => { setModal(null); refetch(); }} />}
      {modal?.type === 'resolve' && <ResolveModal req={modal.req} onClose={() => setModal(null)} onDone={() => { setModal(null); refetch(); }} />}
    </div>
  );
}

function Stepper({ status }: { status: MaintenanceStatus }) {
  const currentIndex = STEPS.indexOf(status);
  return (
    <div className="mt-4 flex items-center">
      {STEPS.map((step, i) => (
        <div key={step} className="flex flex-1 items-center last:flex-none">
          <div
            className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              i <= currentIndex ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'
            }`}
            title={titleCase(step)}
          >
            {i + 1}
          </div>
          {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 ${i < currentIndex ? 'bg-brand-500' : 'bg-slate-100'}`} />}
        </div>
      ))}
    </div>
  );
}

function RaiseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: assets } = useApi<Asset[]>('/assets');
  const [assetId, setAssetId] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!assetId || description.trim().length < 5) { toast.error('Select an asset and describe the issue'); return; }
    setLoading(true);
    try {
      await api.post('/maintenance', { assetId, priority, description, photoUrl: photoUrl || undefined });
      toast.success('Maintenance request raised');
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
      title="Raise maintenance request"
      subtitle="Describe the issue — a manager approves it before repair work starts."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={loading}>Submit request</Button></>}
    >
      <div className="space-y-4">
        <Field label="Asset" required>
          <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            <option value="">Select an asset</option>
            {assets?.map((a) => <option key={a.id} value={a.id}>{a.assetTag} — {a.name}</option>)}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
          </Select>
        </Field>
        <Field label="Issue description" required>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the problem in detail..." />
        </Field>
        <Field label="Photo URL (optional)">
          <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..." />
        </Field>
      </div>
    </Modal>
  );
}

function RejectModal({ req, onClose, onDone }: { req: MaintenanceRequest; onClose: () => void; onDone: () => void }) {
  const [decisionNote, setDecisionNote] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      await api.post(`/maintenance/${req.id}/reject`, { decisionNote: decisionNote || undefined });
      toast.success('Request rejected');
      onDone();
    } catch (err) { toast.error(errorMessage(err)); } finally { setLoading(false); }
  };
  return (
    <Modal open onClose={onClose} title="Reject request" subtitle={`${req.asset?.assetTag} — ${req.asset?.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" onClick={submit} loading={loading}>Reject</Button></>}>
      <Field label="Reason (optional)"><Textarea rows={3} value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} placeholder="Why is this being rejected?" /></Field>
    </Modal>
  );
}

function AssignModal({ req, onClose, onDone }: { req: MaintenanceRequest; onClose: () => void; onDone: () => void }) {
  const [technicianName, setTechnicianName] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (technicianName.trim().length < 2) { toast.error('Enter a technician name'); return; }
    setLoading(true);
    try {
      await api.post(`/maintenance/${req.id}/assign`, { technicianName });
      toast.success('Technician assigned');
      onDone();
    } catch (err) { toast.error(errorMessage(err)); } finally { setLoading(false); }
  };
  return (
    <Modal open onClose={onClose} title="Assign technician" subtitle={`${req.asset?.assetTag} — ${req.asset?.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={loading}>Assign</Button></>}>
      <Field label="Technician name / vendor" required><Input value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} placeholder="e.g. TechCare Solutions" /></Field>
    </Modal>
  );
}

function ResolveModal({ req, onClose, onDone }: { req: MaintenanceRequest; onClose: () => void; onDone: () => void }) {
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [condition, setCondition] = useState('GOOD');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (resolutionNotes.trim().length < 3) { toast.error('Add resolution notes'); return; }
    setLoading(true);
    try {
      await api.post(`/maintenance/${req.id}/resolve`, { resolutionNotes, condition });
      toast.success('Maintenance resolved — asset available');
      onDone();
    } catch (err) { toast.error(errorMessage(err)); } finally { setLoading(false); }
  };
  return (
    <Modal open onClose={onClose} title="Resolve maintenance" subtitle={`${req.asset?.assetTag} — ${req.asset?.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={loading}>Mark resolved</Button></>}>
      <div className="space-y-4">
        <Field label="Resolution notes" required><Textarea rows={3} value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} placeholder="What was done to fix it?" /></Field>
        <Field label="Condition after repair"><Select value={condition} onChange={(e) => setCondition(e.target.value)}>{CONDITIONS.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select></Field>
      </div>
    </Modal>
  );
}
