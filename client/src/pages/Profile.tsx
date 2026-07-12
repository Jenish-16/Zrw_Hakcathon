import { useState } from 'react';
import toast from 'react-hot-toast';
import { Mail, Building2, Briefcase, Phone, Lock, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';
import { Badge, Button, Card, Field, Input, PageHeader } from '../components/ui';
import { roleLabel, roleStyle } from '../lib/status';
import { initials, avatarColor } from '../lib/format';

export default function Profile() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 6) return toast.error('New password must be at least 6 characters');
    if (next !== confirm) return toast.error('New password and confirmation do not match');
    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      toast.success('Password changed successfully');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="My Profile" subtitle="Your account details and security settings." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Profile card */}
        <Card className="p-6 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className={`flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-bold ${avatarColor(user.name)}`}>
              {initials(user.name)}
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">{user.name}</h2>
            <div className="mt-2"><Badge className={roleStyle[user.role]}>{roleLabel[user.role]}</Badge></div>
          </div>

          <dl className="mt-6 space-y-3 text-sm">
            <Row icon={<Mail className="h-4 w-4" />} label="Email" value={user.email} />
            <Row icon={<Building2 className="h-4 w-4" />} label="Department" value={user.department?.name ?? 'Unassigned'} />
            <Row icon={<Briefcase className="h-4 w-4" />} label="Job title" value={user.jobTitle ?? '—'} />
            <Row icon={<Phone className="h-4 w-4" />} label="Phone" value={user.phone ?? '—'} />
          </dl>
        </Card>

        {/* Change password */}
        <Card className="p-6 lg:col-span-2">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><KeyRound className="h-5 w-5" /></div>
            <div>
              <h3 className="font-semibold text-slate-900">Change password</h3>
              <p className="text-xs text-slate-400">Use a strong password you don't reuse elsewhere.</p>
            </div>
          </div>

          <form onSubmit={changePassword} className="max-w-md space-y-4">
            <Field label="Current password">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="input pl-9" placeholder="••••••••" />
              </div>
            </Field>
            <Field label="New password" hint="At least 6 characters.">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="password" required minLength={6} value={next} onChange={(e) => setNext(e.target.value)} className="input pl-9" placeholder="••••••••" />
              </div>
            </Field>
            <Field label="Confirm new password">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input pl-9" placeholder="••••••••" />
              </div>
            </Field>
            <Button type="submit" loading={loading}>Update password</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400">{icon}</span>
      <span className="w-24 flex-shrink-0 text-slate-400">{label}</span>
      <span className="truncate font-medium text-slate-700">{value}</span>
    </div>
  );
}
