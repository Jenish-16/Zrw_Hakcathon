import { useState } from 'react';
import { Link, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { User, Mail, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from '../components/AuthShell';
import { Button, Field } from '../components/ui';
import { errorMessage } from '../lib/api';

export default function Signup() {
  const { signup, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Same post-auth destination handling as Login: honour ?redirect (internal
  // paths only), else the dashboard.
  const redirect = params.get('redirect');
  const dest = redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/dashboard';

  if (user) return <Navigate to={dest} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signup(name, email, password);
      toast.success('Account created. Welcome to AssetFlow.');
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Signup failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Create your account</h1>
      <p className="mt-1 text-[13px] text-ink-500">
        New accounts start as an <span className="font-medium text-ink-700">Employee</span>. An administrator can
        promote you to a manager role later.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Full name">
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className="input pl-9" />
          </div>
        </Field>
        <Field label="Email address">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="input pl-9" />
          </div>
        </Field>
        <Field label="Password" hint="At least 6 characters.">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input pl-9" />
          </div>
        </Field>

        <Button type="submit" loading={loading} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-5 text-center text-[13px] text-ink-500">
        Already have an account?{' '}
        <Link to={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="font-medium text-accent-600 hover:text-accent-700">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
