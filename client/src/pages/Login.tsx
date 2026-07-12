import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from '../components/AuthShell';
import { Button, Field } from '../components/ui';
import { errorMessage } from '../lib/api';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
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
      <h1 className="text-2xl font-bold text-slate-900">Sign in to your account</h1>
      <p className="mt-1.5 text-sm text-slate-500">Enter your credentials to access the platform.</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Email address">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Don't have an account?{' '}
        <Link to="/signup" className="font-semibold text-brand-600 hover:text-brand-700">
          Create one
        </Link>
      </p>

      <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Demo accounts — click to fill</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
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
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs transition hover:border-brand-300 hover:bg-brand-50"
            >
              <span className="block font-semibold text-slate-700">{label}</span>
              <span className="block truncate text-slate-400">{mail}</span>
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}
