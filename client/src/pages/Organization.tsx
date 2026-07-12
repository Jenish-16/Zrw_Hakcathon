import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Building2,
  Tags,
  Users as UsersIcon,
  Plus,
  Pencil,
  Trash2,
  X,
  ShieldAlert,
} from 'lucide-react';
import { useApi } from '../lib/useApi';
import { api, errorMessage } from '../lib/api';
import { Category, CustomField, Department, Role, User } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Spinner,
  Tabs,
} from '../components/ui';
import { roleLabel, roleStyle } from '../lib/status';
import { initials, avatarColor, titleCase } from '../lib/format';

const ROLES: Role[] = ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'];

const activeStatusStyle = 'bg-emerald-500/10 text-emerald-800 ring-emerald-600/20';
const inactiveStatusStyle = 'bg-ink-500/10 text-ink-500 ring-ink-400/25';

export default function Organization() {
  const [tab, setTab] = useState('departments');
  return (
    <div className="animate-fade-in">
      <PageHeader title="Organization Setup" subtitle="Maintain the master data everything else depends on." />
      <div className="mb-5">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'departments', label: 'Departments', icon: <Building2 className="h-4 w-4" /> },
            { key: 'categories', label: 'Categories', icon: <Tags className="h-4 w-4" /> },
            { key: 'directory', label: 'Employee Directory', icon: <UsersIcon className="h-4 w-4" /> },
          ]}
        />
      </div>
      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'directory' && <DirectoryTab />}
    </div>
  );
}

/* ========================================================================== */
/* Departments                                                                */
/* ========================================================================== */
function DepartmentsTab() {
  const { data: departments, loading, refetch } = useApi<Department[]>('/departments');
  const { data: users } = useApi<User[]>('/users?status=ACTIVE');
  const [modal, setModal] = useState<Department | null | 'new'>(null);

  const remove = async (d: Department) => {
    if (!confirm(`Delete or deactivate "${d.name}"?`)) return;
    try {
      const { data } = await api.delete(`/departments/${d.id}`);
      toast.success(data.deactivated ? 'Department deactivated (has linked records)' : 'Department deleted');
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setModal('new')}>
          <Plus className="h-4 w-4" /> Add Department
        </Button>
      </div>
      <Card className="overflow-hidden">
        {loading ? (
          <Spinner />
        ) : !departments || departments.length === 0 ? (
          <EmptyState icon={<Building2 className="h-6 w-6" />} title="No departments yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className="table-head">Department</th>
                  <th className="table-head">Head</th>
                  <th className="table-head">Parent</th>
                  <th className="table-head text-center">Members</th>
                  <th className="table-head text-center">Assets</th>
                  <th className="table-head">Status</th>
                  <th className="table-head" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {departments.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-muted">
                    <td className="table-cell">
                      <p className="font-medium text-ink-800">{d.name}</p>
                      <p className="font-mono text-xs text-ink-400">{d.code}</p>
                    </td>
                    <td className="table-cell text-ink-600">{d.head?.name ?? <span className="text-ink-300">—</span>}</td>
                    <td className="table-cell text-ink-600">{d.parent?.name ?? <span className="text-ink-300">—</span>}</td>
                    <td className="table-cell text-center font-mono text-[13px] tabular-nums text-ink-600">{d._count?.members ?? 0}</td>
                    <td className="table-cell text-center font-mono text-[13px] tabular-nums text-ink-600">{d._count?.assets ?? 0}</td>
                    <td className="table-cell">
                      <Badge className={d.status === 'ACTIVE' ? activeStatusStyle : inactiveStatusStyle}>
                        {titleCase(d.status)}
                      </Badge>
                    </td>
                    <td className="table-cell">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setModal(d)} className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-900/5 hover:text-ink-600">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => remove(d)} className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal && (
        <DepartmentModal
          department={modal === 'new' ? null : modal}
          users={users ?? []}
          departments={departments ?? []}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refetch(); }}
        />
      )}
    </div>
  );
}

function DepartmentModal({
  department,
  users,
  departments,
  onClose,
  onSaved,
}: {
  department: Department | null;
  users: User[];
  departments: Department[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: department?.name ?? '',
    code: department?.code ?? '',
    headId: department?.headId ?? '',
    parentId: department?.parentId ?? '',
    status: department?.status ?? 'ACTIVE',
  });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.code) return toast.error('Name and code are required');
    setLoading(true);
    try {
      const payload = { name: form.name, code: form.code, headId: form.headId || null, parentId: form.parentId || null, status: form.status };
      if (department) {
        await api.patch(`/departments/${department.id}`, payload);
        toast.success('Department updated');
      } else {
        await api.post('/departments', payload);
        toast.success('Department created');
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
      title={department ? 'Edit department' : 'Add department'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={loading}>Save</Button></>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" required><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Information Technology" /></Field>
        <Field label="Code" required><Input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="IT" /></Field>
        <Field label="Department Head"><Select value={form.headId} onChange={(e) => set('headId', e.target.value)}>
          <option value="">None</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select></Field>
        <Field label="Parent Department"><Select value={form.parentId} onChange={(e) => set('parentId', e.target.value)}>
          <option value="">None (top level)</option>
          {departments.filter((d) => d.id !== department?.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select></Field>
        <Field label="Status"><Select value={form.status} onChange={(e) => set('status', e.target.value)}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </Select></Field>
      </div>
    </Modal>
  );
}

/* ========================================================================== */
/* Categories                                                                 */
/* ========================================================================== */
function CategoriesTab() {
  const { data: categories, loading, refetch } = useApi<Category[]>('/categories');
  const [modal, setModal] = useState<Category | null | 'new'>(null);

  const remove = async (c: Category) => {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try {
      await api.delete(`/categories/${c.id}`);
      toast.success('Category deleted');
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setModal('new')}><Plus className="h-4 w-4" /> Add Category</Button>
      </div>
      {loading ? (
        <Spinner />
      ) : !categories || categories.length === 0 ? (
        <Card><EmptyState icon={<Tags className="h-6 w-6" />} title="No categories yet" /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Card key={c.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Tags className="h-4 w-4 text-ink-400" />
                  <h3 className="text-sm font-semibold tracking-tight text-ink-900">{c.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setModal(c)} className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-900/5 hover:text-ink-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(c)} className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="mt-2 flex-1 text-[13px] text-ink-500">{c.description || 'No description'}</p>
              {c.customFields && c.customFields.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.customFields.map((f) => (
                    <span key={f.key} className="rounded-md bg-ink-900/5 px-2 py-0.5 text-xs font-medium text-ink-600">{f.label}</span>
                  ))}
                </div>
              )}
              <p className="mt-3 border-t border-surface-border pt-2.5 font-mono text-xs tabular-nums text-ink-400">
                {c._count?.assets ?? 0} assets
              </p>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <CategoryModal
          category={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refetch(); }}
        />
      )}
    </div>
  );
}

function CategoryModal({ category, onClose, onSaved }: { category: Category | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [fields, setFields] = useState<CustomField[]>(category?.customFields ?? []);
  const [loading, setLoading] = useState(false);

  const addField = () => setFields((f) => [...f, { key: '', label: '', type: 'text' }]);
  const updateField = (i: number, patch: Partial<CustomField>) =>
    setFields((f) => f.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeField = (i: number) => setFields((f) => f.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!name) return toast.error('Category name is required');
    const cleaned = fields
      .filter((f) => f.label.trim())
      .map((f) => ({ ...f, key: (f.key || f.label).trim().replace(/\s+/g, '_').toLowerCase() }));
    setLoading(true);
    try {
      const payload = { name, description: description || null, customFields: cleaned.length ? cleaned : null };
      if (category) {
        await api.patch(`/categories/${category.id}`, payload);
        toast.success('Category updated');
      } else {
        await api.post('/categories', payload);
        toast.success('Category created');
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
      title={category ? 'Edit category' : 'Add category'}
      subtitle="Add optional category-specific fields (e.g. warranty period for Electronics)."
      size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={loading}>Save</Button></>}
    >
      <div className="space-y-4">
        <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Electronics" /></Field>
        <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Laptops, monitors, phones..." /></Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label mb-0">Custom fields</label>
            <button onClick={addField} className="text-sm font-medium text-accent-600 hover:text-accent-700">+ Add field</button>
          </div>
          {fields.length === 0 ? (
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-ink-400">No custom fields. Assets in this category use the standard fields only.</p>
          ) : (
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input className="flex-1" value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="Field label (e.g. Warranty months)" />
                  <Select className="w-32" value={f.type} onChange={(e) => updateField(i, { type: e.target.value as CustomField['type'] })}>
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="boolean">Boolean</option>
                  </Select>
                  <button onClick={() => removeField(i)} className="rounded-md p-2 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ========================================================================== */
/* Employee Directory                                                         */
/* ========================================================================== */
function DirectoryTab() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const { data: departments } = useApi<Department[]>('/departments');
  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    if (roleFilter) q.set('role', roleFilter);
    return q.toString();
  }, [search, roleFilter]);
  const { data: users, loading, refetch } = useApi<User[]>(`/users?${query}`, [query]);
  const [addOpen, setAddOpen] = useState(false);

  const changeRole = async (u: User, role: Role) => {
    try {
      await api.patch(`/users/${u.id}/role`, { role });
      toast.success(`${u.name} is now ${roleLabel[role]}`);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const toggleStatus = async (u: User) => {
    const status = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.patch(`/users/${u.id}/status`, { status });
      toast.success(`${u.name} ${status === 'ACTIVE' ? 'activated' : 'deactivated'}`);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-surface-border bg-surface px-4 py-3 text-[13px] text-ink-600">
        <ShieldAlert className="h-4 w-4 flex-shrink-0 text-ink-400" />
        <span>
          New signups always start as <span className="font-semibold text-ink-800">Employees</span>. This directory is the only place roles are assigned — promote members to Department Head or Asset Manager here.
        </span>
      </div>

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2"><SearchInput value={search} onChange={setSearch} placeholder="Search name, email, job title..." /></div>
          <div className="flex gap-2">
            <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
            </Select>
            <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add</Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <Spinner />
        ) : !users || users.length === 0 ? (
          <EmptyState icon={<UsersIcon className="h-6 w-6" />} title="No employees found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr>
                  <th className="table-head">Employee</th>
                  <th className="table-head">Department</th>
                  <th className="table-head">Job Title</th>
                  <th className="table-head">Role</th>
                  <th className="table-head">Status</th>
                  <th className="table-head" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {users.map((u) => {
                  const isSelf = u.id === user?.id;
                  return (
                    <tr key={u.id} className="hover:bg-surface-muted">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold ${avatarColor(u.name)}`}>{initials(u.name)}</div>
                          <div>
                            <p className="font-medium text-ink-800">{u.name}{isSelf && <span className="ml-1 text-xs text-ink-400">(you)</span>}</p>
                            <p className="font-mono text-xs text-ink-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell text-ink-600">{u.department?.name ?? <span className="text-ink-300">—</span>}</td>
                      <td className="table-cell text-ink-600">{u.jobTitle ?? <span className="text-ink-300">—</span>}</td>
                      <td className="table-cell">
                        {isSelf ? (
                          <Badge className={roleStyle[u.role]}>{roleLabel[u.role]}</Badge>
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => changeRole(u, e.target.value as Role)}
                            className="rounded-md border border-ink-200 bg-white px-2 py-1 text-xs font-medium text-ink-700 outline-none transition-colors focus:border-accent-500"
                          >
                            {ROLES.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="table-cell">
                        <Badge className={u.status === 'ACTIVE' ? activeStatusStyle : inactiveStatusStyle}>{titleCase(u.status)}</Badge>
                      </td>
                      <td className="table-cell text-right">
                        {!isSelf && (
                          <button
                            onClick={() => toggleStatus(u)}
                            className={`text-xs font-semibold ${u.status === 'ACTIVE' ? 'text-danger-600 hover:text-danger-700' : 'text-emerald-700 hover:text-emerald-800'}`}
                          >
                            {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {addOpen && <AddEmployeeModal departments={departments ?? []} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); refetch(); }} />}
    </div>
  );
}

function AddEmployeeModal({ departments, onClose, onSaved }: { departments: Department[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'EMPLOYEE' as Role, departmentId: '', jobTitle: '', password: '' });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.email) return toast.error('Name and email are required');
    setLoading(true);
    try {
      await api.post('/users', {
        name: form.name,
        email: form.email,
        role: form.role,
        departmentId: form.departmentId || null,
        jobTitle: form.jobTitle || null,
        password: form.password || undefined,
      });
      toast.success('Employee added');
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
      title="Add employee"
      subtitle="Default password is Welcome@123 if left blank."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={loading}>Add employee</Button></>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" required><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Email" required><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Role"><Select value={form.role} onChange={(e) => set('role', e.target.value)}>
          {ROLES.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
        </Select></Field>
        <Field label="Department"><Select value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
          <option value="">Unassigned</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select></Field>
        <Field label="Job title"><Input value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} /></Field>
        <Field label="Password"><Input type="text" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Welcome@123" /></Field>
      </div>
    </Modal>
  );
}
