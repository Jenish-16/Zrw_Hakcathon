import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, Lock } from 'lucide-react';
import { AuthShell } from '../components/AuthShell';
import { Button, Field } from '../components/ui';
import { api, errorMessage } from '../lib/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email, newPassword });
      toast.success('Password updated. Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not reset password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Reset your password</h1>
      <p className="mt-1 text-[13px] text-ink-500">
        Enter your account email and a new password to regain access.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Email address">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="input pl-9" />
          </div>
        </Field>
        <Field label="New password" hint="At least 6 characters.">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="input pl-9" />
          </div>
        </Field>

        <Button type="submit" loading={loading} className="w-full">
          Update password
        </Button>
      </form>

      <p className="mt-5 text-center text-[13px] text-ink-500">
        Remembered it?{' '}
        <Link to="/login" className="font-medium text-accent-600 hover:text-accent-700">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
