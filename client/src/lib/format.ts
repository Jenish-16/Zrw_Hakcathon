import { format, formatDistanceToNow, isValid } from 'date-fns';

export function fmtDate(value?: string | Date | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return isValid(d) ? format(d, 'dd MMM yyyy') : '—';
}

export function fmtDateTime(value?: string | Date | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return isValid(d) ? format(d, 'dd MMM yyyy, h:mm a') : '—';
}

export function fmtTime(value?: string | Date | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return isValid(d) ? format(d, 'h:mm a') : '—';
}

export function fromNow(value?: string | Date | null): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : '';
}

export function fmtCurrency(value?: number | null): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Deterministic muted avatar color from a string (restrained warm set). */
export function avatarColor(seed: string): string {
  const colors = [
    'bg-ink-100 text-ink-700',
    'bg-accent-100 text-accent-800',
    'bg-[#e7ece3] text-[#41523a]',
    'bg-[#f0e9db] text-[#6b5a2e]',
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
