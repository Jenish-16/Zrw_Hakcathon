import { ReactNode } from 'react';
import { Boxes, ShieldCheck, CalendarClock, Wrench, ClipboardCheck } from 'lucide-react';

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-700 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 40%), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.12), transparent 45%)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">AssetFlow</p>
            <p className="text-xs text-white/70">Enterprise Asset & Resource ERP</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight">
            Track, allocate and maintain every asset — in one place.
          </h2>
          <p className="mt-4 text-white/80">
            A centralized platform to manage your organization's physical assets and shared resources with clean,
            role-based workflows.
          </p>
          <div className="mt-8 space-y-4">
            {[
              { icon: <ShieldCheck className="h-5 w-5" />, text: 'Role-based workflows & secure approvals' },
              { icon: <CalendarClock className="h-5 w-5" />, text: 'Conflict-free allocation & resource booking' },
              { icon: <Wrench className="h-5 w-5" />, text: 'Structured maintenance approval pipeline' },
              { icon: <ClipboardCheck className="h-5 w-5" />, text: 'Audit cycles with discrepancy reports' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">{f.icon}</div>
                <span className="text-sm text-white/90">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} AssetFlow. Built for the Odoo Hackathon.</p>
      </div>

      {/* Right form panel */}
      <div className="flex w-full items-center justify-center bg-surface-muted px-4 py-10 sm:px-8 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Boxes className="h-5 w-5" />
            </div>
            <p className="text-lg font-bold text-slate-900">AssetFlow</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
