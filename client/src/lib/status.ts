// Central mapping of domain statuses to badge color classes.
// Badges are quiet chips: faint wash, hairline ring, dark text + status dot.

export const assetStatusStyle: Record<string, string> = {
  AVAILABLE: 'bg-emerald-500/10 text-emerald-800 ring-emerald-600/20',
  ALLOCATED: 'bg-accent-500/10 text-accent-800 ring-accent-600/20',
  RESERVED: 'bg-violet-500/10 text-violet-800 ring-violet-600/20',
  UNDER_MAINTENANCE: 'bg-amber-500/10 text-amber-800 ring-amber-600/25',
  LOST: 'bg-danger-600/10 text-danger-700 ring-danger-600/20',
  RETIRED: 'bg-ink-500/10 text-ink-600 ring-ink-400/25',
  DISPOSED: 'bg-ink-500/10 text-ink-500 ring-ink-400/25',
};

export const conditionStyle: Record<string, string> = {
  NEW: 'bg-emerald-500/10 text-emerald-800 ring-emerald-600/20',
  GOOD: 'bg-accent-500/10 text-accent-800 ring-accent-600/20',
  FAIR: 'bg-amber-500/10 text-amber-800 ring-amber-600/25',
  POOR: 'bg-orange-500/10 text-orange-800 ring-orange-600/25',
  DAMAGED: 'bg-danger-600/10 text-danger-700 ring-danger-600/20',
};

export const bookingStatusStyle: Record<string, string> = {
  UPCOMING: 'bg-accent-500/10 text-accent-800 ring-accent-600/20',
  ONGOING: 'bg-emerald-500/10 text-emerald-800 ring-emerald-600/20',
  COMPLETED: 'bg-ink-500/10 text-ink-600 ring-ink-400/25',
  CANCELLED: 'bg-danger-600/10 text-danger-700 ring-danger-600/20',
};

export const maintenanceStatusStyle: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-800 ring-amber-600/25',
  APPROVED: 'bg-accent-500/10 text-accent-800 ring-accent-600/20',
  REJECTED: 'bg-danger-600/10 text-danger-700 ring-danger-600/20',
  TECHNICIAN_ASSIGNED: 'bg-violet-500/10 text-violet-800 ring-violet-600/20',
  IN_PROGRESS: 'bg-accent-500/10 text-accent-800 ring-accent-600/20',
  RESOLVED: 'bg-emerald-500/10 text-emerald-800 ring-emerald-600/20',
};

export const priorityStyle: Record<string, string> = {
  LOW: 'bg-ink-500/10 text-ink-600 ring-ink-400/25',
  MEDIUM: 'bg-accent-500/10 text-accent-800 ring-accent-600/20',
  HIGH: 'bg-amber-500/10 text-amber-800 ring-amber-600/25',
  CRITICAL: 'bg-danger-600/10 text-danger-700 ring-danger-600/20',
};

export const transferStatusStyle: Record<string, string> = {
  REQUESTED: 'bg-amber-500/10 text-amber-800 ring-amber-600/25',
  APPROVED: 'bg-accent-500/10 text-accent-800 ring-accent-600/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-800 ring-emerald-600/20',
  REJECTED: 'bg-danger-600/10 text-danger-700 ring-danger-600/20',
};

export const auditItemStyle: Record<string, string> = {
  PENDING: 'bg-ink-500/10 text-ink-600 ring-ink-400/25',
  VERIFIED: 'bg-emerald-500/10 text-emerald-800 ring-emerald-600/20',
  MISSING: 'bg-danger-600/10 text-danger-700 ring-danger-600/20',
  DAMAGED: 'bg-amber-500/10 text-amber-800 ring-amber-600/25',
};

export const roleLabel: Record<string, string> = {
  ADMIN: 'Administrator',
  ASSET_MANAGER: 'Asset Manager',
  DEPARTMENT_HEAD: 'Department Head',
  EMPLOYEE: 'Employee',
};

export const roleStyle: Record<string, string> = {
  ADMIN: 'bg-ink-900/90 text-white ring-ink-900',
  ASSET_MANAGER: 'bg-accent-500/10 text-accent-800 ring-accent-600/20',
  DEPARTMENT_HEAD: 'bg-violet-500/10 text-violet-800 ring-violet-600/20',
  EMPLOYEE: 'bg-ink-500/10 text-ink-600 ring-ink-400/25',
};
