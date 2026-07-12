import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { User, Mail, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from '../components/AuthShell';
import { Button, Field } from '../components/ui';
import { errorMessage } from '../lib/api';

export default function Signup() {
  const { signup, user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signup(name, email, password);
      toast.success('Account created! Welcome to AssetFlow.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(errorMessage(err, 'Signup failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
      <p className="mt-1.5 text-sm text-slate-500">
        New accounts start as an <span className="font-medium text-slate-600">Employee</span>. An administrator can
        promote you to a manager role later.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Full name">
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className="input pl-9" />
          </div>
        </Field>
        <Field label="Email address">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="input pl-9" />
          </div>
        </Field>
        <Field label="Password" hint="At least 6 characters.">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input pl-9" />
          </div>
        </Field>

        <Button type="submit" loading={loading} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
