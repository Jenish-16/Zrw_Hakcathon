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
import { api, getToken } from '../lib/api';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles?: Role[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> }],
  },
  {
    label: 'Operations',
    items: [
      { to: '/assets', label: 'Assets', icon: <Boxes className="h-4 w-4" /> },
      { to: '/allocations', label: 'Allocations', icon: <HandCoins className="h-4 w-4" /> },
      { to: '/transfers', label: 'Transfers', icon: <ArrowLeftRight className="h-4 w-4" /> },
      { to: '/bookings', label: 'Bookings', icon: <CalendarDays className="h-4 w-4" /> },
      { to: '/maintenance', label: 'Maintenance', icon: <Wrench className="h-4 w-4" /> },
      { to: '/audits', label: 'Audits', icon: <ClipboardCheck className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Insight',
    items: [
      { to: '/reports', label: 'Reports', icon: <BarChart3 className="h-4 w-4" />, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'] },
      { to: '/activity', label: 'Activity Log', icon: <ScrollText className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Admin',
    items: [{ to: '/organization', label: 'Organization', icon: <Building2 className="h-4 w-4" />, roles: ['ADMIN'] }],
  },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((n) => !n.roles || (user && n.roles.includes(user.role))),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {/* Sidebar — ink panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-ink-900 transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-400/90">
            <Boxes className="h-4 w-4 text-white" />
          </div>
          <p className="text-[15px] font-semibold tracking-tight text-white">
            AssetFlow
          </p>
          <button className="ml-auto p-1 text-ink-400 lg:hidden" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-4 border-t border-white/10" />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {visibleGroups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-1.5 px-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-2.5 rounded-md px-2 py-[7px] text-[13px] font-medium transition-colors ${
                        isActive
                          ? 'bg-white/[0.07] text-white'
                          : 'text-ink-300 hover:bg-white/[0.04] hover:text-ink-100'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute -left-3 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent-400" />
                        )}
                        <span className={isActive ? 'text-accent-300' : 'text-ink-400 group-hover:text-ink-300'}>
                          {item.icon}
                        </span>
                        {item.label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-ink-100">
              {initials(user?.name ?? 'A')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink-100">{user?.name}</p>
              <p className="truncate text-[11px] text-ink-500">{roleLabel[user?.role ?? 'EMPLOYEE']}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-white/[0.06] hover:text-ink-200"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-ink-950/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

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
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-surface-border bg-paper/90 px-4 backdrop-blur sm:px-6">
      <button className="text-ink-500 lg:hidden" onClick={onMenu}>
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex-1" />

      <NotificationBell />

      <div className="h-5 w-px bg-surface-border" />

      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-ink-900/5"
        >
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${avatarColor(user?.name ?? 'A')}`}>
            {initials(user?.name ?? 'A')}
          </div>
          <span className="hidden text-[13px] font-medium text-ink-700 sm:block">{user?.name}</span>
          <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
        </button>
        {menuOpen && (
          <div className="animate-scale-in absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-surface-border bg-surface shadow-overlay">
            <div className="border-b border-surface-border px-3.5 py-2.5">
              <p className="truncate text-[13px] font-medium text-ink-800">{user?.name}</p>
              <p className="truncate font-mono text-[11px] text-ink-400">{user?.email}</p>
            </div>
            <div className="p-1">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/profile');
                }}
                className="block w-full rounded-md px-2.5 py-2 text-left text-[13px] text-ink-600 transition-colors hover:bg-ink-900/5"
              >
                My profile
              </button>
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-danger-600 transition-colors hover:bg-danger-50"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
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
    // Polling is kept as a resilient fallback — it covers SSE reconnect gaps
    // and platforms that cut long-lived connections (e.g. serverless).
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  // Real-time push via Server-Sent Events. EventSource can't set headers, so
  // the JWT rides as a query param (verified server-side). On any pushed
  // notification we refresh the list + unread count; EventSource auto-reconnects
  // on error, and the poll above covers any window where the stream is down.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const es = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
    es.addEventListener('notification', () => load());
    return () => es.close();
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
        className="relative rounded-md p-2 text-ink-500 transition-colors hover:bg-ink-900/5 hover:text-ink-700"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 font-mono text-[9px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="animate-scale-in absolute right-0 mt-2 w-80 overflow-hidden rounded-lg border border-surface-border bg-surface shadow-overlay sm:w-96">
          <div className="flex items-center justify-between border-b border-surface-border px-3.5 py-2.5">
            <p className="micro-label">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="flex items-center gap-1 text-xs font-medium text-accent-600 hover:text-accent-700">
                <Check className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-ink-400">You're all caught up.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className="flex w-full items-start gap-2.5 border-b border-surface-border px-3.5 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-muted"
                >
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${!n.isRead ? 'bg-accent-500' : 'bg-ink-200'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink-800">{n.title}</span>
                    <span className="block text-xs leading-relaxed text-ink-500">{n.message}</span>
                    <span className="mt-1 block font-mono text-[10px] uppercase tracking-wide text-ink-400">
                      {fromNow(n.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
