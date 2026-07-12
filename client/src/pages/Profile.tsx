import { useState } from 'react';
import toast from 'react-hot-toast';
import { Mail, Building2, Briefcase, Phone, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';
import { Badge, Button, Card, Field, PageHeader } from '../components/ui';
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
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold ${avatarColor(user.name)}`}>
              {initials(user.name)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold tracking-tight text-ink-900">{user.name}</h2>
              <div className="mt-1.5"><Badge className={roleStyle[user.role]}>{roleLabel[user.role]}</Badge></div>
            </div>
          </div>

          <dl className="mt-6 space-y-4 border-t border-surface-border pt-5">
            <Row icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={user.email} mono />
            <Row icon={<Building2 className="h-3.5 w-3.5" />} label="Department" value={user.department?.name ?? 'Unassigned'} />
            <Row icon={<Briefcase className="h-3.5 w-3.5" />} label="Job title" value={user.jobTitle ?? '—'} />
            <Row icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={user.phone ?? '—'} mono />
          </dl>
        </Card>

        {/* Change password */}
        <Card className="p-6 lg:col-span-2">
          <div className="mb-5">
            <p className="micro-label">Security</p>
            <h3 className="mt-1 text-sm font-semibold tracking-tight text-ink-900">Change password</h3>
            <p className="mt-0.5 text-xs text-ink-500">Use a strong password you don't reuse elsewhere.</p>
          </div>

          <form onSubmit={changePassword} className="max-w-md space-y-4">
            <Field label="Current password">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="input pl-9" placeholder="••••••••" />
              </div>
            </Field>
            <Field label="New password" hint="At least 6 characters.">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input type="password" required minLength={6} value={next} onChange={(e) => setNext(e.target.value)} className="input pl-9" placeholder="••••••••" />
              </div>
            </Field>
            <Field label="Confirm new password">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
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

function Row({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="micro-label flex items-center gap-1.5">
        <span className="text-ink-300">{icon}</span>
        {label}
      </dt>
      <dd className={`mt-1 truncate ${mono ? 'font-mono text-[13px]' : 'text-sm font-medium'} text-ink-800`}>{value}</dd>
    </div>
  );
}
