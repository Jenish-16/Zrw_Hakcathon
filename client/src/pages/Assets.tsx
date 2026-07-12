import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Package, QrCode, Pencil, SlidersHorizontal } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { api, errorMessage } from '../lib/api';
import { Asset, Category, Department } from '../lib/types';
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
        title="Assets"
        subtitle="Register, search and track every asset through its lifecycle."
        actions={
          canManage && (
            <Button onClick={() => { setEditing(null); setShowForm(true); }}>
              <Plus className="h-4 w-4" /> Register Asset
            </Button>
          )
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search tag, name, serial, location..." />
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
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={bookable} onChange={(e) => setBookable(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            <SlidersHorizontal className="h-4 w-4" /> Bookable resources only
          </label>
          <span className="text-sm text-slate-400">{assets?.length ?? 0} results</span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <Spinner />
        ) : !assets || assets.length === 0 ? (
          <EmptyState icon={<Package className="h-6 w-6" />} title="No assets found" subtitle="Try adjusting your filters or register a new asset." />
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
                  {canManage && <th className="table-head" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {assets.map((a) => (
                  <tr key={a.id} className="cursor-pointer transition hover:bg-slate-50" onClick={() => navigate(`/assets/${a.id}`)}>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                          <QrCode className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{a.name}</p>
                          <p className="font-mono text-xs text-slate-400">{a.assetTag}{a.isBookable ? ' · Bookable' : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-slate-600">{a.category?.name}</td>
                    <td className="table-cell"><Badge className={assetStatusStyle[a.status]}>{titleCase(a.status)}</Badge></td>
                    <td className="table-cell"><Badge className={conditionStyle[a.condition]}>{titleCase(a.condition)}</Badge></td>
                    <td className="table-cell text-slate-600">{a.location ?? '—'}</td>
                    <td className="table-cell">
                      {a.currentHolder ? (
                        <div className="flex items-center gap-2">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${avatarColor(a.currentHolder.name)}`}>
                            {initials(a.currentHolder.name)}
                          </div>
                          <span className="text-slate-600">{a.currentHolder.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="table-cell text-right text-slate-600">{fmtCurrency(a.acquisitionCost)}</td>
                    {canManage && (
                      <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => { setEditing(a); setShowForm(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    )}
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
        />
      )}
    </div>
  );
}

function AssetFormModal({
  asset,
  categories,
  departments,
  onClose,
  onSaved,
}: {
  asset: Asset | null;
  categories: Category[];
  departments: Department[];
  onClose: () => void;
  onSaved: () => void;
}) {
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
  });
  const [customData, setCustomData] = useState<Record<string, unknown>>((asset?.customData as Record<string, unknown>) ?? {});
  const [loading, setLoading] = useState(false);

  const selectedCategory = categories.find((c) => c.id === form.categoryId);
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.categoryId) {
      toast.error('Name and category are required');
      return;
    }
    setLoading(true);
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
        customData: Object.keys(customData).length ? customData : null,
      };
      if (asset) {
        await api.patch(`/assets/${asset.id}`, payload);
        toast.success('Asset updated');
      } else {
        await api.post('/assets', payload);
        toast.success('Asset registered');
      }
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
      title={asset ? 'Edit asset' : 'Register new asset'}
      subtitle={asset ? asset.assetTag : 'A unique Asset Tag (AF-XXXX) is generated automatically.'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={loading}>{asset ? 'Save changes' : 'Register asset'}</Button>
        </>
      }
    >
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
        <Field label="Photo URL (optional)">
          <Input value={form.photoUrl} onChange={(e) => set('photoUrl', e.target.value)} placeholder="https://..." />
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
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-surface-border p-3">
            <input type="checkbox" checked={form.isBookable} onChange={(e) => set('isBookable', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            <div>
              <p className="text-sm font-medium text-slate-700">Shared / bookable resource</p>
              <p className="text-xs text-slate-400">Allow this asset to be booked by time slot (rooms, vehicles, equipment).</p>
            </div>
          </label>
        </div>
      </div>
    </Modal>
  );
}
