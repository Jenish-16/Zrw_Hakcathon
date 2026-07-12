import { ReactNode, useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  ArrowLeftRight,
  CalendarDays,
  Wrench,
  ClipboardCheck,
  BarChart3,
  Building2,
  ScrollText,
  Bell,
  LogOut,
  ChevronDown,
  Menu,
  X,
  HandCoins,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Role, Notification } from '../lib/types';
import { roleLabel } from '../lib/status';
import { initials, avatarColor, fromNow } from '../lib/format';
import { api } from '../lib/api';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { to: '/assets', label: 'Assets', icon: <Boxes className="h-5 w-5" /> },
  { to: '/allocations', label: 'Allocations', icon: <HandCoins className="h-5 w-5" /> },
  { to: '/transfers', label: 'Transfers', icon: <ArrowLeftRight className="h-5 w-5" /> },
  { to: '/bookings', label: 'Bookings', icon: <CalendarDays className="h-5 w-5" /> },
  { to: '/maintenance', label: 'Maintenance', icon: <Wrench className="h-5 w-5" /> },
  { to: '/audits', label: 'Audits', icon: <ClipboardCheck className="h-5 w-5" /> },
  { to: '/reports', label: 'Reports', icon: <BarChart3 className="h-5 w-5" />, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'] },
  { to: '/organization', label: 'Organization', icon: <Building2 className="h-5 w-5" />, roles: ['ADMIN'] },
  { to: '/activity', label: 'Activity Log', icon: <ScrollText className="h-5 w-5" /> },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, hasRole } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const visibleNav = NAV.filter((n) => !n.roles || (user && n.roles.includes(user.role)));

  return (
    <div className="flex h-screen overflow-hidden bg-surface-muted">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-surface-border bg-white transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-surface-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[15px] font-bold leading-none tracking-tight text-slate-900">AssetFlow</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-400">Asset & Resource ERP</p>
          </div>
          <button className="ml-auto text-slate-400 lg:hidden" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-surface-border p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${avatarColor(user?.name ?? 'A')}`}>
              {initials(user?.name ?? 'A')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{user?.name}</p>
              <p className="truncate text-xs text-slate-400">{roleLabel[user?.role ?? 'EMPLOYEE']}</p>
            </div>
          </div>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} onLogout={logout} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Topbar({ onMenu, onLogout }: { onMenu: () => void; onLogout: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-surface-border bg-white/80 px-4 backdrop-blur sm:px-6">
      <button className="text-slate-500 lg:hidden" onClick={onMenu}>
        <Menu className="h-6 w-6" />
      </button>
      <div className="flex-1" />

      <NotificationBell />

      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-slate-100"
        >
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${avatarColor(user?.name ?? 'A')}`}>
            {initials(user?.name ?? 'A')}
          </div>
          <span className="hidden text-sm font-semibold text-slate-700 sm:block">{user?.name}</span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
        {menuOpen && (
          <div className="animate-scale-in absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-surface-border bg-white shadow-pop">
            <div className="border-b border-surface-border px-4 py-3">
              <p className="truncate text-sm font-semibold text-slate-800">{user?.name}</p>
              <p className="truncate text-xs text-slate-400">{user?.email}</p>
            </div>
            <button
              onClick={() => {
                setMenuOpen(false);
                navigate('/profile');
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50"
            >
              My Profile
            </button>
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-rose-600 transition hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const [list, count] = await Promise.all([
        api.get<Notification[]>('/notifications'),
        api.get<{ count: number }>('/notifications/unread-count'),
      ]);
      setItems(list.data);
      setUnread(count.data.count);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markAll = async () => {
    await api.post('/notifications/read-all');
    load();
  };

  const openItem = async (n: Notification) => {
    if (!n.isRead) await api.post(`/notifications/${n.id}/read`);
    setOpen(false);
    load();
    if (n.link) navigate(n.link);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-xl p-2 text-slate-500 transition hover:bg-slate-100"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="animate-scale-in absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-surface-border bg-white shadow-pop sm:w-96">
          <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                <Check className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">You're all caught up 🎉</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`flex w-full flex-col items-start gap-0.5 border-b border-surface-border px-4 py-3 text-left transition hover:bg-slate-50 ${
                    !n.isRead ? 'bg-brand-50/40' : ''
                  }`}
                >
                  <div className="flex w-full items-center gap-2">
                    {!n.isRead && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" />}
                    <span className="text-sm font-semibold text-slate-800">{n.title}</span>
                  </div>
                  <span className="text-xs text-slate-500">{n.message}</span>
                  <span className="mt-0.5 text-[11px] text-slate-400">{fromNow(n.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
