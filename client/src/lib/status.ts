// Central mapping of domain statuses to badge color classes.

export const assetStatusStyle: Record<string, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  ALLOCATED: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  RESERVED: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  UNDER_MAINTENANCE: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  LOST: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  RETIRED: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  DISPOSED: 'bg-slate-100 text-slate-500 ring-slate-500/20',
};

export const conditionStyle: Record<string, string> = {
  NEW: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  GOOD: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  FAIR: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  POOR: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  DAMAGED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
};

export const bookingStatusStyle: Record<string, string> = {
  UPCOMING: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  ONGOING: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  COMPLETED: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  CANCELLED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
};

export const maintenanceStatusStyle: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  APPROVED: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  REJECTED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  TECHNICIAN_ASSIGNED: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  IN_PROGRESS: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  RESOLVED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
};

export const priorityStyle: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  MEDIUM: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  HIGH: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  CRITICAL: 'bg-rose-50 text-rose-700 ring-rose-600/20',
};

export const transferStatusStyle: Record<string, string> = {
  REQUESTED: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  APPROVED: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  REJECTED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
};

export const auditItemStyle: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  VERIFIED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  MISSING: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  DAMAGED: 'bg-amber-50 text-amber-700 ring-amber-600/20',
};

export const roleLabel: Record<string, string> = {
  ADMIN: 'Administrator',
  ASSET_MANAGER: 'Asset Manager',
  DEPARTMENT_HEAD: 'Department Head',
  EMPLOYEE: 'Employee',
};

export const roleStyle: Record<string, string> = {
  ADMIN: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20',
  ASSET_MANAGER: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  DEPARTMENT_HEAD: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  EMPLOYEE: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};
