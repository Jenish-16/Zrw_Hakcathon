import { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, useEffect } from 'react';
import { X, Loader2, Search, Inbox } from 'lucide-react';

// --------------------------------------------------------------------------
// Badge — quiet chip with an optional status dot (dot inherits text color)
// --------------------------------------------------------------------------
export function Badge({ children, className = '', dot = true }: { children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${className}`}
    >
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

// --------------------------------------------------------------------------
// Card
// --------------------------------------------------------------------------
export function Card({
  children,
  className = '',
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** Uppercase section heading used at the top of cards/panels. */
export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`micro-label ${className}`}>{children}</p>;
}

// --------------------------------------------------------------------------
// Inputs
// --------------------------------------------------------------------------
export function Field({
  label,
  hint,
  error,
  children,
  required,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      {label && (
        <label className="label">
          {label} {required && <span className="text-danger-600">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ''}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input ${props.className ?? ''}`} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`input ${props.className ?? ''}`}>
      {children}
    </select>
  );
}

// --------------------------------------------------------------------------
// Button
// --------------------------------------------------------------------------
type ButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ children, variant = 'primary', size = 'md', loading, className = '', disabled, ...props }: ButtonProps) {
  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  }[variant];
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${variantClass} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

// --------------------------------------------------------------------------
// Modal
// --------------------------------------------------------------------------
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 sm:p-6"
      onMouseDown={onClose}
    >
      <div
        className={`card animate-scale-in mt-10 w-full ${widths[size]} shadow-overlay`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-surface-border px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-900/5 hover:text-ink-700">
            <X className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2.5 border-t border-surface-border px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Empty state / loading / error
// --------------------------------------------------------------------------
export function EmptyState({ icon, title, subtitle, action }: { icon?: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-ink-200 px-6 py-12 text-center">
      <div className="text-ink-300">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <div>
        <p className="text-sm font-medium text-ink-700">{title}</p>
        {subtitle && <p className="mt-1 text-[13px] text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-20 text-ink-400">
      <Loader2 className="h-5 w-5 animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
        className="input pl-9"
      />
    </div>
  );
}

// --------------------------------------------------------------------------
// Page header
// --------------------------------------------------------------------------
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-surface-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// --------------------------------------------------------------------------
// Tabs — quiet underline style
// --------------------------------------------------------------------------
export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string; icon?: ReactNode }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex gap-1 border-b border-surface-border">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
            active === t.key
              ? 'border-ink-900 text-ink-900'
              : 'border-transparent text-ink-500 hover:border-ink-200 hover:text-ink-700'
          }`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}
