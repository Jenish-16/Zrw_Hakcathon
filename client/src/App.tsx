import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { Role } from './lib/types';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import AssetDetail from './pages/AssetDetail';
import Allocations from './pages/Allocations';
import Transfers from './pages/Transfers';
import Bookings from './pages/Bookings';
import Maintenance from './pages/Maintenance';
import Audits from './pages/Audits';
import AuditDetail from './pages/AuditDetail';
import Reports from './pages/Reports';
import Organization from './pages/Organization';
import Activity from './pages/Activity';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';

// Non-employee roles — everyone who gets the org-wide experience.
const STAFF_ROLES: Role[] = ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'];

// Employees have no dashboard; send them straight to their own assets.
function HomeRedirect() {
  const { hasRole } = useAuth();
  return <Navigate to={hasRole('EMPLOYEE') ? '/assets' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route path="/dashboard" element={<ProtectedRoute roles={STAFF_ROLES}><Dashboard /></ProtectedRoute>} />
      <Route path="/assets" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
      <Route path="/assets/:id" element={<ProtectedRoute><AssetDetail /></ProtectedRoute>} />
      <Route path="/allocations" element={<ProtectedRoute roles={STAFF_ROLES}><Allocations /></ProtectedRoute>} />
      <Route path="/transfers" element={<ProtectedRoute><Transfers /></ProtectedRoute>} />
      <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
      <Route path="/maintenance" element={<ProtectedRoute><Maintenance /></ProtectedRoute>} />
      <Route path="/audits" element={<ProtectedRoute roles={STAFF_ROLES}><Audits /></ProtectedRoute>} />
      <Route path="/audits/:id" element={<ProtectedRoute roles={STAFF_ROLES}><AuditDetail /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute roles={STAFF_ROLES}><Reports /></ProtectedRoute>} />
      <Route path="/organization" element={<ProtectedRoute roles={['ADMIN']}><Organization /></ProtectedRoute>} />
      <Route path="/activity" element={<ProtectedRoute roles={STAFF_ROLES}><Activity /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
