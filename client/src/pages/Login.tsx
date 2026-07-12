import { useState } from 'react';
import { Link, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from '../components/AuthShell';
import { Button, Field } from '../components/ui';
import { errorMessage } from '../lib/api';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  // Where to go after auth: the ?redirect target (e.g. a scanned asset link),
  // guarded to internal paths only, otherwise the dashboard.
  const redirect = params.get('redirect');
  const dest = redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/dashboard';

  if (user) return <Navigate to={dest} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back');
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (e: string) => {
    setEmail(e);
    setPassword(e.includes('admin') ? 'Admin@123' : 'Password@123');
  };

  return (
    <AuthShell>
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Sign in</h1>
      <p className="mt-1 text-[13px] text-ink-500">Enter your credentials to access the platform.</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Email address">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="input pl-9"
              autoComplete="email"
            />
          </div>
        </Field>

        <Field label="Password">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type={show ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input px-9"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 transition-colors hover:text-ink-600"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-[13px] font-medium text-accent-600 hover:text-accent-700">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-5 text-center text-[13px] text-ink-500">
        Don't have an account?{' '}
        <Link to={`/signup${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="font-medium text-accent-600 hover:text-accent-700">
          Create one
        </Link>
      </p>

      <div className="mt-6 border-t border-surface-border pt-5">
        <p className="micro-label">Demo access — click to fill</p>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          {[
            ['Admin', 'admin@assetflow.com'],
            ['Asset Manager', 'manager@assetflow.com'],
            ['Dept Head', 'ithead@assetflow.com'],
            ['Employee', 'vikram@assetflow.com'],
          ].map(([label, mail]) => (
            <button
              key={mail}
              type="button"
              onClick={() => quickFill(mail)}
              className="rounded-md border border-surface-border bg-surface px-2.5 py-2 text-left transition-colors hover:border-ink-300 hover:bg-surface-muted"
            >
              <span className="block font-mono text-[11px] font-medium uppercase tracking-wide text-ink-700">
                {label}
              </span>
              <span className="block truncate text-[11px] text-ink-400">{mail}</span>
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}
