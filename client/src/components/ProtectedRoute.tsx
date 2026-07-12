import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Role } from '../lib/types';
import { Layout } from './Layout';
import { Spinner } from './ui';

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-paper">
        <Spinner label="Loading AssetFlow…" />
      </div>
    );
  }
  if (!user) {
    // Remember where the user was headed (e.g. an asset deep link from a scanned
    // QR) so we can return them there after they log in / sign up.
    const target = location.pathname + location.search + location.hash;
    const to = target && target !== '/dashboard' ? `/login?redirect=${encodeURIComponent(target)}` : '/login';
    return <Navigate to={to} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <h2 className="text-xl font-semibold tracking-tight text-ink-900">Access restricted</h2>
          <p className="max-w-md text-[13px] text-ink-500">
            You don't have permission to view this page. Contact an administrator if you believe this is a mistake.
          </p>
        </div>
      </Layout>
    );
  }

  return <Layout>{children}</Layout>;
}
