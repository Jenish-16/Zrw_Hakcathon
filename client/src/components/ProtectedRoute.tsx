import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Role } from '../lib/types';
import { Layout } from './Layout';
import { Spinner } from './ui';

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-muted">
        <Spinner label="Loading AssetFlow..." />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(user.role)) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <h2 className="text-xl font-bold text-slate-800">Access restricted</h2>
          <p className="max-w-md text-sm text-slate-500">
            You don't have permission to view this page. Contact an administrator if you believe this is a mistake.
          </p>
        </div>
      </Layout>
    );
  }

  return <Layout>{children}</Layout>;
}
