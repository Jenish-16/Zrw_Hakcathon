import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Package, Pencil, SlidersHorizontal, QrCode, FileText, ImagePlus, Loader2, X, Upload } from 'lucide-react';
import { AssetQr } from '../components/AssetQr';
import { useApi } from '../lib/useApi';
import { api, errorMessage } from '../lib/api';
import { Asset, AssetCondition, Category, Department } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, SearchInput, Select, Spinner } from '../components/ui';
import { assetStatusStyle, conditionStyle } from '../lib/status';
import { titleCase, fmtCurrency, initials, avatarColor } from '../lib/format';

const STATUSES = ['AVAILABLE', 'ALLOCATED', 'RESERVED', 'UNDER_MAINTENANCE', 'LOST', 'RETIRED', 'DISPOSED'];
const CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];

export default function Assets() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [department, setDepartment] = useState('');
  const [bookable, setBookable] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [qrAsset, setQrAsset] = useState<Asset | null>(null);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    if (category) q.set('category', category);
    if (status) q.set('status', status);
    if (department) q.set('department', department);
    if (bookable) q.set('bookable', 'true');
    return q.toString();
  }, [search, category, status, department, bookable]);

  const { data: assets, loading, refetch } = useApi<Asset[]>(`/assets?${query}`, [query]);
  const { data: categories } = useApi<Category[]>('/categories');
  const { data: departments } = useApi<Department[]>('/departments');

  const canManage = hasRole('ADMIN', 'ASSET_MANAGER');
  const isEmployee = hasRole('EMPLOYEE');

  useEffect(() => {
    if (params.get('action') === 'new' && canManage) {
      setEditing(null);
      setShowForm(true);
      params.delete('action');
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={isEmployee ? 'My Assets' : 'Assets'}
        subtitle={
          isEmployee
            ? 'The assets currently allocated to you.'
            : 'Register, search and track every asset through its lifecycle.'
        }
        actions={
          canManage && (
            <>
              <Button variant="secondary" onClick={() => setShowImport(true)}>
                <Upload className="h-4 w-4" /> Import CSV
              </Button>
              <Button onClick={() => { setEditing(null); setShowForm(true); }}>
                <Plus className="h-4 w-4" /> Register Asset
              </Button>
            </>
          )
        }
      />

      {!isEmployee && (
      <Card className="mb-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search tag, QR code, name, serial, location..." />
          </div>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </Select>
          <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All departments</option>
            {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-600">
            <input type="checkbox" checked={bookable} onChange={(e) => setBookable(e.target.checked)} className="h-4 w-4 rounded border-ink-300 text-accent-600 focus:ring-accent-500" />
            <SlidersHorizontal className="h-4 w-4 text-ink-400" /> Bookable resources only
          </label>
          <span className="font-mono text-xs tabular-nums text-ink-400">{assets?.length ?? 0} results</span>
        </div>
      </Card>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <Spinner />
        ) : !assets || assets.length === 0 ? (
          <EmptyState icon={<Package className="h-6 w-6" />} title="No assets found" subtitle={isEmployee ? 'You have no assets allocated to you yet.' : 'Try adjusting your filters or register a new asset.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr>
                  <th className="table-head">Asset</th>
                  <th className="table-head">Category</th>
                  <th className="table-head">Status</th>
                  <th className="table-head">Condition</th>
                  <th className="table-head">Location</th>
                  <th className="table-head">Holder</th>
                  <th className="table-head text-right">Cost</th>
                  <th className="table-head" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {assets.map((a) => (
                  <tr key={a.id} className="cursor-pointer transition-colors hover:bg-surface-muted" onClick={() => navigate(`/assets/${a.id}`)}>
                    <td className="table-cell">
                      <p className="text-[13px] font-medium text-ink-800">{a.name}</p>
                      <p className="font-mono text-xs text-ink-400">{a.assetTag}{a.isBookable ? ' · Bookable' : ''}</p>
                    </td>
                    <td className="table-cell text-ink-600">{a.category?.name}</td>
                    <td className="table-cell"><Badge className={assetStatusStyle[a.status]}>{titleCase(a.status)}</Badge></td>
                    <td className="table-cell"><Badge className={conditionStyle[a.condition]}>{titleCase(a.condition)}</Badge></td>
                    <td className="table-cell text-ink-600">{a.location ?? '—'}</td>
                    <td className="table-cell">
                      {a.currentHolder ? (
                        <div className="flex items-center gap-2">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${avatarColor(a.currentHolder.name)}`}>
                            {initials(a.currentHolder.name)}
                          </div>
                          <span className="text-ink-600">{a.currentHolder.name}</span>
                        </div>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    <td className="table-cell text-right font-mono text-[13px] tabular-nums text-ink-600">{fmtCurrency(a.acquisitionCost)}</td>
                    <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button title="Show QR code" onClick={() => setQrAsset(a)} className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-900/5 hover:text-ink-600">
                          <QrCode className="h-4 w-4" />
                        </button>
                        {canManage && (
                          <button title="Edit asset" onClick={() => { setEditing(a); setShowForm(true); }} className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-900/5 hover:text-ink-600">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && (
        <AssetFormModal
          asset={editing}
          categories={categories ?? []}
          departments={departments ?? []}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refetch(); }}
          onCreatedAnother={() => refetch()}
        />
      )}

      {qrAsset && <QrModal asset={qrAsset} onClose={() => setQrAsset(null)} />}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); refetch(); }}
        />
      )}
    </div>
  );
}

interface ImportResult {
  created: number;
  failed: number;
  total: number;
  results: { line: number; name: string; assetTag?: string; ok: boolean; error?: string }[];
}

/** Bulk CSV import — additive to the Assets page; validates each row on the
 *  server against the single-asset creation schema and reports per-row results. */
function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const run = async () => {
    if (!file) { toast.error('Choose a CSV file first'); return; }
    setLoading(true);
    try {
      const csv = await file.text();
      const { data } = await api.post<ImportResult>('/assets/import', { csv });
      setResult(data);
      if (data.created > 0) toast.success(`${data.created} asset(s) imported`);
      if (data.failed > 0) toast.error(`${data.failed} row(s) failed — see details`);
    } catch (err) {
      toast.error(errorMessage(err, 'Import failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      onClose={result ? onDone : onClose}
      title="Import assets from CSV"
      subtitle="Bulk-create assets. Each row is validated exactly like the single-asset form."
      size="lg"
      footer={
        result ? (
          <Button onClick={onDone}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={run} loading={loading} disabled={!file}>Import</Button>
          </>
        )
      }
    >
      {!result ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-surface-muted p-3 text-xs text-ink-500">
            <p className="font-medium text-ink-700">Expected columns</p>
            <p className="mt-1">
              <span className="font-mono">Name</span> and <span className="font-mono">Category</span> are required. Optional:{' '}
              <span className="font-mono">Department, Condition, Location, SerialNumber, AcquisitionCost, AcquisitionDate, isBookable</span>.
              Category/Department accept a name or an ID. Asset tags are generated automatically — export the Assets CSV first to see the format.
            </p>
          </div>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-surface-border px-3 py-8 text-sm text-ink-500 transition-colors hover:bg-surface-muted">
            <Upload className="h-5 w-5" />
            {file ? <span className="font-medium text-ink-700">{file.name}</span> : 'Choose a .csv file'}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge dot={false} className="bg-emerald-500/10 text-emerald-800 ring-emerald-600/20">{result.created} created</Badge>
            {result.failed > 0 && <Badge dot={false} className="bg-danger-500/10 text-danger-700 ring-danger-600/25">{result.failed} failed</Badge>}
            <Badge dot={false} className="bg-ink-500/10 text-ink-600 ring-ink-400/25">{result.total} rows</Badge>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-surface-border">
            <table className="w-full text-[13px]">
              <thead>
                <tr>
                  <th className="table-head">Line</th>
                  <th className="table-head">Name</th>
                  <th className="table-head">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {result.results.map((r) => (
                  <tr key={r.line}>
                    <td className="table-cell font-mono text-ink-400">{r.line}</td>
                    <td className="table-cell text-ink-700">{r.name || '—'}</td>
                    <td className="table-cell">
                      {r.ok ? (
                        <span className="font-mono text-emerald-700">✓ {r.assetTag}</span>
                      ) : (
                        <span className="text-danger-600">{r.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

function QrModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Asset QR code"
      subtitle={`${asset.assetTag} — ${asset.name}`}
      size="sm"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <AssetQr asset={asset} size={160} />
      <p className="mt-4 text-center text-xs text-ink-400">
        Print this label and stick it on the physical item. Scanning it (or typing the value into search) finds this asset.
      </p>
    </Modal>
  );
}

function AssetFormModal({
  asset,
  categories,
  departments,
  onClose,
  onSaved,
  onCreatedAnother,
}: {
  asset: Asset | null;
  categories: Category[];
  departments: Department[];
  onClose: () => void;
  onSaved: () => void;
  onCreatedAnother: () => void;
}) {
  const navigate = useNavigate();
  const emptyForm = {
    name: '',
    categoryId: '',
    serialNumber: '',
    acquisitionDate: '',
    acquisitionCost: '',
    condition: 'GOOD' as AssetCondition,
    location: '',
    departmentId: '',
    isBookable: false,
    photoUrl: '',
    documentUrl: '',
  };
  const [form, setForm] = useState({
    name: asset?.name ?? '',
    categoryId: asset?.categoryId ?? '',
    serialNumber: asset?.serialNumber ?? '',
    acquisitionDate: asset?.acquisitionDate ? asset.acquisitionDate.slice(0, 10) : '',
    acquisitionCost: asset?.acquisitionCost?.toString() ?? '',
    condition: asset?.condition ?? 'GOOD',
    location: asset?.location ?? '',
    departmentId: asset?.departmentId ?? '',
    isBookable: asset?.isBookable ?? false,
    photoUrl: asset?.photoUrl ?? '',
    documentUrl: asset?.documentUrl ?? '',
  });
  const [customData, setCustomData] = useState<Record<string, unknown>>((asset?.customData as Record<string, unknown>) ?? {});
  // Which save action is in flight, so the right button shows the spinner.
  const [pending, setPending] = useState<null | 'edit' | 'another' | 'redirect'>(null);
  const [uploading, setUploading] = useState<'photo' | 'doc' | null>(null);
  const busy = pending !== null;

  const selectedCategory = categories.find((c) => c.id === form.categoryId);
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  // Close on Escape, unless a save is in flight.
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [busy, onClose]);

  /** Upload a picked file to the server, which stores it in Supabase Storage. */
  const uploadFile = async (file: File, kind: 'photo' | 'doc') => {
    setUploading(kind);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post<{ url: string }>('/assets/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      set(kind === 'photo' ? 'photoUrl' : 'documentUrl', data.url);
      toast.success(kind === 'photo' ? 'Photo uploaded' : 'Document uploaded');
    } catch (err) {
      toast.error(errorMessage(err, 'Upload failed'));
    } finally {
      setUploading(null);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setCustomData({});
    document.getElementById('asset-form-body')?.scrollTo({ top: 0 });
  };

  // 'edit' saves changes to an existing asset; 'another' creates then clears the
  // form to register the next one; 'redirect' creates then opens the new asset.
  const save = async (mode: 'edit' | 'another' | 'redirect') => {
    if (!form.name.trim() || !form.categoryId) {
      toast.error('Name and category are required');
      return;
    }
    if (uploading) {
      toast.error('Please wait for the upload to finish');
      return;
    }
    setPending(mode);
    try {
      const payload = {
        name: form.name,
        categoryId: form.categoryId,
        serialNumber: form.serialNumber || null,
        acquisitionDate: form.acquisitionDate || null,
        acquisitionCost: form.acquisitionCost ? Number(form.acquisitionCost) : null,
        condition: form.condition,
        location: form.location || null,
        departmentId: form.departmentId || null,
        isBookable: form.isBookable,
        photoUrl: form.photoUrl || null,
        documentUrl: form.documentUrl || null,
        customData: Object.keys(customData).length ? customData : null,
      };
      if (mode === 'edit' && asset) {
        await api.patch(`/assets/${asset.id}`, payload);
        toast.success('Asset updated');
        onSaved();
        return;
      }
      const { data } = await api.post<Asset>('/assets', payload);
      toast.success('Asset registered');
      if (mode === 'redirect') {
        navigate(`/assets/${data.id}`);
      } else {
        onCreatedAnother();
        resetForm();
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper">
      {/* Top navbar: title on the left, actions on the right */}
      <header className="flex h-14 flex-shrink-0 items-center justify-between gap-3 border-b border-surface-border bg-surface px-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight text-ink-900">{asset ? 'Edit asset' : 'Register new asset'}</h2>
          <p className="truncate text-xs text-ink-400">{asset ? asset.assetTag : 'A unique Asset Tag (AF-XXXX) is generated automatically.'}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          {asset ? (
            <Button onClick={() => save('edit')} loading={pending === 'edit'}>Save changes</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => save('another')} loading={pending === 'another'} disabled={busy && pending !== 'another'}>
                Create &amp; add another
              </Button>
              <Button onClick={() => save('redirect')} loading={pending === 'redirect'} disabled={busy && pending !== 'redirect'}>
                Create
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Scrollable body */}
      <div id="asset-form-body" className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Asset name" required>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. MacBook Pro 16&quot;" />
          </Field>
        </div>
        <Field label="Category" required>
          <Select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">Select category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Department">
          <Select value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
            <option value="">Unassigned</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Serial number">
          <Input value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} placeholder="SN-XXXXXX" />
        </Field>
        <Field label="Location">
          <Input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="HQ - Floor 2" />
        </Field>
        <Field label="Acquisition date">
          <Input type="date" value={form.acquisitionDate} onChange={(e) => set('acquisitionDate', e.target.value)} />
        </Field>
        <Field label="Acquisition cost (₹)" hint="Used for ranking/reports only.">
          <Input type="number" min="0" value={form.acquisitionCost} onChange={(e) => set('acquisitionCost', e.target.value)} placeholder="0" />
        </Field>
        <Field label="Condition">
          <Select value={form.condition} onChange={(e) => set('condition', e.target.value)}>
            {CONDITIONS.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
          </Select>
        </Field>
        <Field label="Photo (optional)" hint="JPEG, PNG, WebP or GIF, up to 10 MB.">
          <div className="flex items-center gap-3">
            {form.photoUrl ? (
              <div className="relative">
                <img src={form.photoUrl} alt="Asset" className="h-14 w-14 rounded-lg border border-surface-border object-cover" />
                <button
                  type="button"
                  title="Remove photo"
                  onClick={() => set('photoUrl', '')}
                  className="absolute -right-2 -top-2 rounded-full border border-surface-border bg-white p-0.5 text-ink-400 hover:text-danger-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-ink-200 text-ink-300">
                <ImagePlus className="h-5 w-5" />
              </div>
            )}
            <label className={`btn-secondary btn-sm cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
              {uploading === 'photo' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              {form.photoUrl ? 'Replace photo' : 'Upload photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading !== null}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f, 'photo');
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </Field>
        <Field label="Document (optional)" hint="PDF, DOC or DOCX — invoice, warranty, manual…">
          <div className="flex items-center gap-3">
            {form.documentUrl ? (
              <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-600">
                <FileText className="h-4 w-4 flex-shrink-0 text-ink-400" />
                <span className="truncate font-mono text-xs">{decodeURIComponent(form.documentUrl.split('/').pop() ?? 'document')}</span>
                <button type="button" title="Remove document" onClick={() => set('documentUrl', '')} className="text-ink-400 hover:text-danger-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : (
              <span className="text-[13px] text-ink-300">No document attached</span>
            )}
            <label className={`btn-secondary btn-sm ml-auto flex-shrink-0 cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
              {uploading === 'doc' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              {form.documentUrl ? 'Replace' : 'Upload document'}
              <input
                type="file"
                accept="application/pdf,.doc,.docx"
                className="hidden"
                disabled={uploading !== null}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f, 'doc');
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </Field>

        {selectedCategory?.customFields?.map((cf) => (
          <Field key={cf.key} label={cf.label}>
            <Input
              type={cf.type === 'number' ? 'number' : cf.type === 'date' ? 'date' : 'text'}
              value={(customData[cf.key] as string) ?? ''}
              onChange={(e) => setCustomData((d) => ({ ...d, [cf.key]: cf.type === 'number' ? Number(e.target.value) : e.target.value }))}
            />
          </Field>
        ))}

        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-surface-border p-3">
            <input type="checkbox" checked={form.isBookable} onChange={(e) => set('isBookable', e.target.checked)} className="h-4 w-4 rounded border-ink-300 text-accent-600 focus:ring-accent-500" />
            <div>
              <p className="text-sm font-medium text-ink-700">Shared / bookable resource</p>
              <p className="text-xs text-ink-400">Allow this asset to be booked by time slot (rooms, vehicles, equipment).</p>
            </div>
          </label>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Full-screen "Register asset" dialog that fetches its own category/department
 * options, so it can be opened from anywhere (e.g. the Dashboard) without
 * navigating to the Assets page first. "Create" still routes to the new asset.
 */
export function RegisterAssetDialog({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const { data: categories } = useApi<Category[]>('/categories');
  const { data: departments } = useApi<Department[]>('/departments');
  return (
    <AssetFormModal
      asset={null}
      categories={categories ?? []}
      departments={departments ?? []}
      onClose={onClose}
      onSaved={onClose}
      onCreatedAnother={() => onCreated?.()}
    />
  );
}

/**
 * Full-screen "Edit asset" dialog that fetches its own category/department
 * options, so it can be opened from anywhere (e.g. the asset detail page)
 * without navigating back to the Assets list first.
 */
export function EditAssetDialog({ asset, onClose, onSaved }: { asset: Asset; onClose: () => void; onSaved: () => void }) {
  const { data: categories } = useApi<Category[]>('/categories');
  const { data: departments } = useApi<Department[]>('/departments');
  return (
    <AssetFormModal
      asset={asset}
      categories={categories ?? []}
      departments={departments ?? []}
      onClose={onClose}
      onSaved={onSaved}
      onCreatedAnother={() => {}}
    />
  );
}
