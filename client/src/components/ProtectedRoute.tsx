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

  // No permission for this page → quietly send them to their assets rather
  // than showing a dead-end "access restricted" panel. /assets is open to
  // every authenticated role (employees see their own; staff see all).
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/assets" replace />;
  }

  return <Layout>{children}</Layout>;
}
