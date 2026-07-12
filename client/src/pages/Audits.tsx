import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, ClipboardCheck, MapPin, Building2, CalendarRange } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { api, errorMessage } from '../lib/api';
import { AuditCycle, Department, User } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner } from '../components/ui';
import { fmtDate, initials, avatarColor } from '../lib/format';

export default function Audits() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const { data: cycles, loading, refetch } = useApi<AuditCycle[]>('/audits');
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Asset Audits"
        subtitle="Run structured verification cycles and auto-generate discrepancy reports."
        actions={
          hasRole('ADMIN') && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" /> New Audit Cycle
            </Button>
          )
        }
      />

      {loading ? (
        <Spinner label="Loading audit cycles..." />
      ) : !cycles || cycles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardCheck className="h-6 w-6" />}
            title="No audit cycles yet"
            subtitle={hasRole('ADMIN') ? 'Create your first audit cycle to get started.' : 'Audit cycles you are assigned to will appear here.'}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cycles.map((c) => (
            <AuditCard key={c.id} cycle={c} onClick={() => navigate(`/audits/${c.id}`)} />
          ))}
        </div>
      )}

      {showForm && <CreateCycleModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refetch(); }} />}
    </div>
  );
}

function AuditCard({ cycle, onClick }: { cycle: AuditCycle; onClick: () => void }) {
  const counts = cycle.counts ?? { PENDING: 0, VERIFIED: 0, MISSING: 0, DAMAGED: 0 };
  const total = cycle._count?.items ?? counts.PENDING + counts.VERIFIED + counts.MISSING + counts.DAMAGED;
  const done = total - counts.PENDING;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const auditors = cycle.assignments ?? [];

  return (
    <Card className="cursor-pointer p-5 transition hover:shadow-cardhover" onClick={onClick}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900">{cycle.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
            {cycle.scopeType === 'DEPARTMENT' ? <Building2 className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
            {cycle.scopeType === 'DEPARTMENT' ? 'Department scope' : cycle.scopeValue}
          </p>
        </div>
        <Badge className={cycle.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-slate-100 text-slate-600 ring-slate-500/20'}>
          {cycle.status}
        </Badge>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <CalendarRange className="h-3.5 w-3.5" /> {fmtDate(cycle.startDate)} – {fmtDate(cycle.endDate)}
      </p>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600">Verification progress</span>
          <span className="text-slate-400">{done}/{total}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-medium">
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700">{counts.VERIFIED} verified</span>
          <span className="rounded-md bg-rose-50 px-2 py-0.5 text-rose-700">{counts.MISSING} missing</span>
          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-700">{counts.DAMAGED} damaged</span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">{counts.PENDING} pending</span>
        </div>
      </div>

      {auditors.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <div className="flex -space-x-2">
            {auditors.slice(0, 4).map((a) => (
              <div key={a.id} title={a.auditor.name} className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-white ${avatarColor(a.auditor.name)}`}>
                {initials(a.auditor.name)}
              </div>
            ))}
          </div>
          <span className="text-xs text-slate-400">{auditors.length} auditor{auditors.length > 1 ? 's' : ''}</span>
        </div>
      )}
    </Card>
  );
}

function CreateCycleModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: departments } = useApi<Department[]>('/departments');
  const { data: users } = useApi<User[]>('/users?status=ACTIVE');
  const [name, setName] = useState('');
  const [scopeType, setScopeType] = useState<'DEPARTMENT' | 'LOCATION'>('DEPARTMENT');
  const [scopeValue, setScopeValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [auditorIds, setAuditorIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleAuditor = (id: string) =>
    setAuditorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async () => {
    if (!name || !scopeValue || !startDate || !endDate) {
      toast.error('Fill in all fields');
      return;
    }
    if (auditorIds.length === 0) {
      toast.error('Assign at least one auditor');
      return;
    }
    setLoading(true);
    try {
      await api.post('/audits', {
        name,
        scopeType,
        scopeValue,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        auditorIds,
      });
      toast.success('Audit cycle created');
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
      title="New audit cycle"
      subtitle="Auto-populates items for every asset in the selected scope."
      size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={loading}>Create cycle</Button></>}
    >
      <div className="space-y-4">
        <Field label="Cycle name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 IT Department Audit" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Scope type" required>
            <Select value={scopeType} onChange={(e) => { setScopeType(e.target.value as 'DEPARTMENT' | 'LOCATION'); setScopeValue(''); }}>
              <option value="DEPARTMENT">Department</option>
              <option value="LOCATION">Location</option>
            </Select>
          </Field>
          <Field label={scopeType === 'DEPARTMENT' ? 'Department' : 'Location'} required>
            {scopeType === 'DEPARTMENT' ? (
              <Select value={scopeValue} onChange={(e) => setScopeValue(e.target.value)}>
                <option value="">Select department</option>
                {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            ) : (
              <Input value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} placeholder="e.g. Floor 2" />
            )}
          </Field>
          <Field label="Start date" required>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="End date" required>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>

        <Field label={`Auditors (${auditorIds.length} selected)`} required>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-surface-border p-2">
            {users?.map((u) => (
              <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                <input type="checkbox" checked={auditorIds.includes(u.id)} onChange={() => toggleAuditor(u.id)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold ${avatarColor(u.name)}`}>{initials(u.name)}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">{u.name}</p>
                  <p className="truncate text-xs text-slate-400">{u.email}</p>
                </div>
              </label>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
