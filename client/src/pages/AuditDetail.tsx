import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  MapPin,
  CalendarRange,
} from 'lucide-react';
import { useApi } from '../lib/useApi';
import { api, errorMessage } from '../lib/api';
import { AuditCycle, AuditItem, AuditItemStatus } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, EmptyState, Modal, Spinner } from '../components/ui';
import { auditItemStyle } from '../lib/status';
import { fmtDate, fmtDateTime, initials, avatarColor } from '../lib/format';

export default function AuditDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const { data: cycle, loading, refetch } = useApi<AuditCycle>(`/audits/${id}`, [id]);
  const [closing, setClosing] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [notesModal, setNotesModal] = useState<{ item: AuditItem; status: AuditItemStatus } | null>(null);

  if (loading || !cycle) return <Spinner label="Loading audit cycle..." />;

  const counts = cycle.counts ?? { PENDING: 0, VERIFIED: 0, MISSING: 0, DAMAGED: 0 };
  const items = cycle.items ?? [];
  const total = items.length;
  const isAuditor = (cycle.assignments ?? []).some((a) => a.auditor.id === user?.id);
  const canAudit = cycle.status === 'OPEN' && (isAuditor || hasRole('ADMIN'));
  const discrepancies = items.filter((i) => i.status === 'MISSING' || i.status === 'DAMAGED');

  const mark = async (item: AuditItem, status: AuditItemStatus, notes?: string) => {
    try {
      await api.patch(`/audits/${cycle.id}/items/${item.id}`, { status, notes: notes ?? null });
      toast.success(`Marked ${item.asset?.assetTag} as ${status.toLowerCase()}`);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const closeCycle = async () => {
    setClosing(true);
    try {
      const { data } = await api.post(`/audits/${cycle.id}/close`);
      toast.success(`Cycle closed · ${data.lost} lost, ${data.damaged} damaged`);
      setShowClose(false);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setClosing(false);
    }
  };

  const tiles = [
    { label: 'Total', value: total, dot: 'bg-ink-400' },
    { label: 'Verified', value: counts.VERIFIED, dot: 'bg-emerald-600' },
    { label: 'Missing', value: counts.MISSING, dot: 'bg-danger-600' },
    { label: 'Damaged', value: counts.DAMAGED, dot: 'bg-amber-500' },
    { label: 'Pending', value: counts.PENDING, dot: 'bg-ink-300' },
  ];

  return (
    <div className="animate-fade-in">
      <button onClick={() => navigate('/audits')} className="mb-4 flex items-center gap-1.5 text-[13px] font-medium text-ink-500 transition-colors hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> Back to audits
      </button>

      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-ink-900">{cycle.name}</h1>
              <Badge className={cycle.status === 'OPEN' ? 'bg-emerald-500/10 text-emerald-800 ring-emerald-600/20' : 'bg-ink-500/10 text-ink-600 ring-ink-400/25'}>
                {cycle.status}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-[13px] text-ink-500">
              <span className="flex items-center gap-1.5">
                {cycle.scopeType === 'DEPARTMENT' ? <Building2 className="h-4 w-4 text-ink-400" /> : <MapPin className="h-4 w-4 text-ink-400" />}
                {cycle.scopeType === 'DEPARTMENT' ? 'Department scope' : cycle.scopeValue}
              </span>
              <span className="flex items-center gap-1.5"><CalendarRange className="h-4 w-4 text-ink-400" /> <span className="font-mono tabular-nums">{fmtDate(cycle.startDate)} – {fmtDate(cycle.endDate)}</span></span>
              {cycle.createdBy && <span>Created by {cycle.createdBy.name}</span>}
            </div>
          </div>
          {hasRole('ADMIN') && cycle.status === 'OPEN' && (
            <Button variant="danger" onClick={() => setShowClose(true)}>
              <Lock className="h-4 w-4" /> Close Audit Cycle
            </Button>
          )}
        </div>

        {(cycle.assignments ?? []).length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-ink-400">Auditors:</span>
            <div className="flex -space-x-2">
              {cycle.assignments!.map((a) => (
                <div key={a.id} title={a.auditor.name} className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-surface ${avatarColor(a.auditor.name)}`}>
                  {initials(a.auditor.name)}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {cycle.status === 'CLOSED' && (
        <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-surface-border bg-surface-muted px-4 py-3 text-[13px] text-ink-600">
          <Lock className="h-4 w-4 text-ink-400" />
          This cycle is closed and locked. Verification is read-only.{cycle.closedAt ? ` Closed ${fmtDate(cycle.closedAt)}.` : ''}
        </div>
      )}

      {/* Summary tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
              <p className="micro-label">{t.label}</p>
            </div>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink-900">{t.value}</p>
          </Card>
        ))}
      </div>

      {/* Items */}
      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-surface-border px-5 py-3">
          <h3 className="micro-label">Assets in scope</h3>
        </div>
        {items.length === 0 ? (
          <EmptyState title="No assets in this cycle" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className="table-head">Asset</th>
                  <th className="table-head">Location</th>
                  <th className="table-head">Result</th>
                  <th className="table-head">Audited by</th>
                  {canAudit && <th className="table-head text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-surface-muted">
                    <td className="table-cell">
                      <p className="text-sm font-medium text-ink-800">{item.asset?.name}</p>
                      <p className="font-mono text-xs tabular-nums text-ink-400">{item.asset?.assetTag}</p>
                      {item.notes && <p className="mt-0.5 text-xs italic text-ink-400">“{item.notes}”</p>}
                    </td>
                    <td className="table-cell text-ink-600">{item.asset?.location ?? '—'}</td>
                    <td className="table-cell"><Badge className={auditItemStyle[item.status]}>{item.status}</Badge></td>
                    <td className="table-cell text-ink-500">
                      {item.auditedBy ? `${item.auditedBy.name}` : '—'}
                      {item.auditedAt && <span className="block font-mono text-xs tabular-nums text-ink-400">{fmtDateTime(item.auditedAt)}</span>}
                    </td>
                    {canAudit && (
                      <td className="table-cell">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => mark(item, 'VERIFIED')} title="Verified" className="rounded-md p-1.5 text-emerald-700 transition-colors hover:bg-emerald-500/10">
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => setNotesModal({ item, status: 'DAMAGED' })} title="Damaged" className="rounded-md p-1.5 text-amber-700 transition-colors hover:bg-amber-500/10">
                            <AlertTriangle className="h-4 w-4" />
                          </button>
                          <button onClick={() => setNotesModal({ item, status: 'MISSING' })} title="Missing" className="rounded-md p-1.5 text-danger-600 transition-colors hover:bg-danger-50">
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Discrepancy report */}
      <Card className="mt-4 p-5">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-danger-600" />
          <h3 className="micro-label">Discrepancy Report</h3>
          <Badge dot={false} className="bg-danger-600/10 font-mono tabular-nums text-danger-700 ring-danger-600/20">{discrepancies.length}</Badge>
        </div>
        {discrepancies.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-[13px] text-ink-500">No discrepancies flagged.</p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {discrepancies.map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-800"><span className="font-mono text-[13px] tabular-nums">{d.asset?.assetTag}</span> · {d.asset?.name}</p>
                  <p className="text-xs text-ink-400">
                    {d.asset?.location ?? '—'}{d.auditedBy ? ` · flagged by ${d.auditedBy.name}` : ''}
                  </p>
                  {d.notes && <p className="mt-0.5 text-xs italic text-ink-500">“{d.notes}”</p>}
                </div>
                <Badge className={auditItemStyle[d.status]}>{d.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {showClose && (
        <Modal
          open
          onClose={() => setShowClose(false)}
          title="Close audit cycle?"
          subtitle="This locks the cycle and updates affected asset statuses."
          footer={<><Button variant="secondary" onClick={() => setShowClose(false)}>Cancel</Button><Button variant="danger" onClick={closeCycle} loading={closing}>Close cycle</Button></>}
        >
          <p className="text-[13px] text-ink-600">
            Confirmed-missing assets will be marked <span className="font-semibold text-danger-600">Lost</span> and damaged assets will
            have their condition set to <span className="font-semibold text-amber-700">Damaged</span>. This cannot be undone.
          </p>
          <div className="mt-3 rounded-lg bg-surface-muted p-3 font-mono text-[13px] tabular-nums text-ink-600">
            {counts.MISSING} missing · {counts.DAMAGED} damaged · {counts.PENDING} still pending verification
          </div>
        </Modal>
      )}

      {notesModal && (
        <NotesModal
          status={notesModal.status}
          assetName={`${notesModal.item.asset?.assetTag} · ${notesModal.item.asset?.name}`}
          onClose={() => setNotesModal(null)}
          onConfirm={(notes) => { mark(notesModal.item, notesModal.status, notes); setNotesModal(null); }}
        />
      )}
    </div>
  );
}

function NotesModal({ status, assetName, onClose, onConfirm }: { status: AuditItemStatus; assetName: string; onClose: () => void; onConfirm: (notes: string) => void }) {
  const [notes, setNotes] = useState('');
  return (
    <Modal
      open
      onClose={onClose}
      title={`Mark as ${status.toLowerCase()}`}
      subtitle={assetName}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={status === 'MISSING' ? 'danger' : 'primary'} onClick={() => onConfirm(notes)}>Confirm</Button></>}
    >
      <label className="label">Notes (optional)</label>
      <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Describe the discrepancy..." />
    </Modal>
  );
}
