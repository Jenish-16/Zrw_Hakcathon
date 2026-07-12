// Enum values mirrored from the database (supabase/schema.sql). These replace
// the enums that used to be imported from '@prisma/client'. Each is a const
// object + a matching type of the same name, so both `Role.ADMIN` (value) and
// `Role` (type) keep working, and `z.nativeEnum(Role)` still validates.

export const Role = {
  ADMIN: 'ADMIN',
  ASSET_MANAGER: 'ASSET_MANAGER',
  DEPARTMENT_HEAD: 'DEPARTMENT_HEAD',
  EMPLOYEE: 'EMPLOYEE',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const UserStatus = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' } as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const DepartmentStatus = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' } as const;
export type DepartmentStatus = (typeof DepartmentStatus)[keyof typeof DepartmentStatus];

export const AssetStatus = {
  AVAILABLE: 'AVAILABLE',
  ALLOCATED: 'ALLOCATED',
  RESERVED: 'RESERVED',
  UNDER_MAINTENANCE: 'UNDER_MAINTENANCE',
  LOST: 'LOST',
  RETIRED: 'RETIRED',
  DISPOSED: 'DISPOSED',
} as const;
export type AssetStatus = (typeof AssetStatus)[keyof typeof AssetStatus];

export const AssetCondition = {
  NEW: 'NEW',
  GOOD: 'GOOD',
  FAIR: 'FAIR',
  POOR: 'POOR',
  DAMAGED: 'DAMAGED',
} as const;
export type AssetCondition = (typeof AssetCondition)[keyof typeof AssetCondition];

export const AllocationStatus = { ACTIVE: 'ACTIVE', RETURNED: 'RETURNED' } as const;
export type AllocationStatus = (typeof AllocationStatus)[keyof typeof AllocationStatus];

export const TransferStatus = {
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
} as const;
export type TransferStatus = (typeof TransferStatus)[keyof typeof TransferStatus];

export const BookingStatus = {
  UPCOMING: 'UPCOMING',
  ONGOING: 'ONGOING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const MaintenancePriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type MaintenancePriority = (typeof MaintenancePriority)[keyof typeof MaintenancePriority];

export const MaintenanceStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  TECHNICIAN_ASSIGNED: 'TECHNICIAN_ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
} as const;
export type MaintenanceStatus = (typeof MaintenanceStatus)[keyof typeof MaintenanceStatus];

export const AuditScope = { DEPARTMENT: 'DEPARTMENT', LOCATION: 'LOCATION' } as const;
export type AuditScope = (typeof AuditScope)[keyof typeof AuditScope];

export const AuditCycleStatus = { OPEN: 'OPEN', CLOSED: 'CLOSED' } as const;
export type AuditCycleStatus = (typeof AuditCycleStatus)[keyof typeof AuditCycleStatus];

export const AuditItemStatus = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  MISSING: 'MISSING',
  DAMAGED: 'DAMAGED',
} as const;
export type AuditItemStatus = (typeof AuditItemStatus)[keyof typeof AuditItemStatus];
