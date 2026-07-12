import { ReactNode } from 'react';
import { Boxes, ShieldCheck, CalendarClock, Wrench, ClipboardCheck } from 'lucide-react';

const FEATURES = [
  { icon: <ShieldCheck className="h-4 w-4" />, text: 'Role-based workflows and approvals' },
  { icon: <CalendarClock className="h-4 w-4" />, text: 'Conflict-free allocation and booking' },
  { icon: <Wrench className="h-4 w-4" />, text: 'Structured maintenance pipeline' },
  { icon: <ClipboardCheck className="h-4 w-4" />, text: 'Audit cycles with discrepancy reports' },
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left brand panel — ink */}
      <div className="hidden w-1/2 flex-col justify-between bg-ink-900 p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-400/90">
            <Boxes className="h-4 w-4 text-white" />
          </div>
          <p className="text-[15px] font-semibold tracking-tight text-white">AssetFlow</p>
        </div>

        <div className="max-w-md">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
            Asset &amp; resource management
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Every asset, allocation and audit — accounted for.
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-300">
            One system of record for your organization's equipment, shared resources and the
            workflows around them.
          </p>
          <ul className="mt-8 space-y-3">
            {FEATURES.map((f, i) => (
              <li key={i} className="flex items-center gap-2.5">
                <span className="text-accent-300">{f.icon}</span>
                <span className="text-[13px] text-ink-200">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
          © {new Date().getFullYear()} AssetFlow
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex w-full items-center justify-center bg-paper px-4 py-10 sm:px-8 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-900">
              <Boxes className="h-4 w-4 text-white" />
            </div>
            <p className="text-[15px] font-semibold tracking-tight text-ink-900">AssetFlow</p>
          </div>
          <div className="card px-6 py-7">{children}</div>
        </div>
      </div>
    </div>
  );
}
