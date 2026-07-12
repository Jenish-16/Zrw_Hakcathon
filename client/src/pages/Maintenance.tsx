import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Wrench, Check, X, UserCog, Play, CheckCircle2, ImagePlus, Loader2, ScanLine } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { api, errorMessage } from '../lib/api';
import { QrScanner } from '../components/QrScanner';
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
  const [showScanner, setShowScanner] = useState(false);
  const [prefill, setPrefill] = useState<string | undefined>(undefined);
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
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowScanner(true)}><ScanLine className="h-4 w-4" /> Scan</Button>
            <Button onClick={() => { setPrefill(undefined); setShowForm(true); }}><Plus className="h-4 w-4" /> Raise Request</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatus(s)}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              status === s ? 'bg-ink-900 text-white' : 'bg-surface text-ink-600 ring-1 ring-inset ring-surface-border hover:bg-surface-muted'
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
                  <p className="text-sm font-semibold tracking-tight text-ink-900">{r.asset?.name}</p>
                  <p className="font-mono text-xs tabular-nums text-ink-400">{r.asset?.assetTag}</p>
                </div>
                <div className="flex flex-shrink-0 gap-1.5">
                  <Badge className={priorityStyle[r.priority]}>{titleCase(r.priority)}</Badge>
                  <Badge className={maintenanceStatusStyle[r.status]}>{titleCase(r.status)}</Badge>
                </div>
              </div>

              <p className="mt-3 text-[13px] text-ink-600">{r.description}</p>

              {r.status !== 'REJECTED' && <Stepper status={r.status} />}

              <div className="mt-3 space-y-1 text-xs text-ink-400">
                <p>Raised by <span className="font-medium text-ink-600">{r.raisedBy?.name}</span> · <span className="font-mono">{fromNow(r.createdAt)}</span></p>
                {r.technicianName && <p>Technician: <span className="font-medium text-ink-600">{r.technicianName}</span></p>}
                {r.resolutionNotes && <p>Resolution: <span className="italic">{r.resolutionNotes}</span> {r.resolvedAt ? <span className="font-mono tabular-nums">({fmtDate(r.resolvedAt)})</span> : ''}</p>}
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

      {showScanner && (
        <QrScanner
          onClose={() => setShowScanner(false)}
          onDetect={(value) => { setShowScanner(false); setPrefill(value); setShowForm(true); }}
        />
      )}
      {showForm && (
        <RaiseModal
          prefill={prefill}
          onClose={() => { setShowForm(false); setPrefill(undefined); }}
          onSaved={() => { setShowForm(false); setPrefill(undefined); refetch(); }}
        />
      )}
      {modal?.type === 'reject' && <RejectModal req={modal.req} onClose={() => setModal(null)} onDone={() => { setModal(null); refetch(); }} />}
      {modal?.type === 'assign' && <AssignModal req={modal.req} onClose={() => setModal(null)} onDone={() => { setModal(null); refetch(); }} />}
      {modal?.type === 'resolve' && <ResolveModal req={modal.req} onClose={() => setModal(null)} onDone={() => { setModal(null); refetch(); }} />}
    </div>
  );
}

function Stepper({ status }: { status: MaintenanceStatus }) {
  const currentIndex = STEPS.indexOf(status);
  return (
    <div className="mt-4">
      <div className="flex items-center">
        {STEPS.map((step, i) => (
          <div key={step} className="flex flex-1 items-center last:flex-none">
            <span
              title={titleCase(step)}
              className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${i <= currentIndex ? 'bg-accent-500' : 'bg-ink-200'}`}
            />
            {i < STEPS.length - 1 && <span className={`h-px flex-1 ${i < currentIndex ? 'bg-accent-500' : 'bg-ink-100'}`} />}
          </div>
        ))}
      </div>
      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-400">
        Step {currentIndex + 1} of {STEPS.length} · {titleCase(status)}
      </p>
    </div>
  );
}

/** Resolve a scanned QR value to an asset: our labels encode a detail-page URL
 * (…/assets/<id>); we also accept a raw asset tag or stored QR token. */
function resolveScannedAsset(scanned: string, assets: Asset[]): Asset | undefined {
  const urlMatch = scanned.match(/\/assets\/([^/?#]+)/);
  if (urlMatch) {
    const byId = assets.find((a) => a.id === urlMatch[1]);
    if (byId) return byId;
  }
  const v = scanned.trim().toLowerCase();
  return assets.find((a) => a.assetTag.toLowerCase() === v || (a.qrCode ?? '').toLowerCase() === v);
}

function RaiseModal({ prefill, onClose, onSaved }: { prefill?: string; onClose: () => void; onSaved: () => void }) {
  const { data: assets } = useApi<Asset[]>('/assets');
  const [assetId, setAssetId] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  // When opened from a scan, preselect the matching asset once the list loads.
  useEffect(() => {
    if (!prefill || !assets || assetId) return;
    const match = resolveScannedAsset(prefill, assets);
    if (match) setAssetId(match.id);
    else toast.error('Scanned asset was not found in the list');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill, assets]);

  /** Upload the picked image; the server stores it and returns a public URL. */
  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post<{ url: string }>('/maintenance/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPhotoUrl(data.url);
      toast.success('Photo uploaded');
    } catch (err) {
      toast.error(errorMessage(err, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!assetId || description.trim().length < 5) { toast.error('Select an asset and describe the issue'); return; }
    if (uploading) { toast.error('Please wait for the photo to finish uploading'); return; }
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
        <Field label="Photo (optional)">
          {photoUrl ? (
            <div className="flex items-center gap-3">
              <img src={photoUrl} alt="Attached" className="h-16 w-16 flex-shrink-0 rounded-lg border border-surface-border object-cover" />
              <label className={`btn-secondary btn-sm cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                Replace
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ''; }} />
              </label>
              <button type="button" onClick={() => setPhotoUrl('')} className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600" title="Remove photo">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-surface-border px-3 py-4 text-[13px] text-ink-500 transition-colors hover:bg-surface-muted ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {uploading ? 'Uploading…' : 'Upload a photo of the issue'}
              <input type="file" accept="image/*" className="hidden" disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ''; }} />
            </label>
          )}
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
