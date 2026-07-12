export type Role = 'ADMIN' | 'ASSET_MANAGER' | 'DEPARTMENT_HEAD' | 'EMPLOYEE';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface Department {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'INACTIVE';
  headId: string | null;
  parentId: string | null;
  head?: { id: string; name: string; email: string } | null;
  parent?: { id: string; name: string; code: string } | null;
  _count?: { members: number; assets: number; children: number };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  phone?: string | null;
  jobTitle?: string | null;
  departmentId?: string | null;
  department?: { id: string; name: string; code: string } | null;
  createdAt?: string;
}

export interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean';
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  customFields?: CustomField[] | null;
  _count?: { assets: number };
}

export type AssetStatus =
  | 'AVAILABLE'
  | 'ALLOCATED'
  | 'RESERVED'
  | 'UNDER_MAINTENANCE'
  | 'LOST'
  | 'RETIRED'
  | 'DISPOSED';
export type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';

export interface Asset {
  id: string;
  assetTag: string;
  qrCode?: string | null;
  name: string;
  serialNumber?: string | null;
  acquisitionDate?: string | null;
  acquisitionCost?: number | null;
  condition: AssetCondition;
  location?: string | null;
  photoUrl?: string | null;
  documentUrl?: string | null;
  isBookable: boolean;
  status: AssetStatus;
  nextMaintenanceDueDate?: string | null;
  customData?: Record<string, unknown> | null;
  categoryId: string;
  category?: { id: string; name: string };
  departmentId?: string | null;
  department?: { id: string; name: string; code: string } | null;
  currentHolder?: { id: string; name: string; email: string } | null;
  createdAt?: string;
  allocations?: Allocation[];
  maintenanceRequests?: MaintenanceRequest[];
  bookings?: Booking[];
  transferRequests?: TransferRequest[];
}

export type AllocationStatus = 'ACTIVE' | 'RETURNED';
export interface Allocation {
  id: string;
  assetId: string;
  asset?: { id: string; assetTag: string; name: string; status: AssetStatus };
  /** Exactly one of holderId / holderDepartmentId is set. */
  holderId: string | null;
  holder?: { id: string; name: string; email: string; departmentId?: string | null } | null;
  holderDepartmentId?: string | null;
  holderDepartment?: { id: string; name: string; code?: string } | null;
  allocatedBy?: { id: string; name: string };
  expectedReturnDate?: string | null;
  allocatedAt: string;
  returnedAt?: string | null;
  returnCondition?: AssetCondition | null;
  checkInNotes?: string | null;
  status: AllocationStatus;
  isOverdue?: boolean;
}

export type TransferStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
export interface TransferRequest {
  id: string;
  assetId: string;
  asset?: { id: string; assetTag: string; name: string; status: AssetStatus };
  fromUser?: { id: string; name: string } | null;
  toUser?: { id: string; name: string };
  requestedBy?: { id: string; name: string };
  approvedBy?: { id: string; name: string } | null;
  status: TransferStatus;
  note?: string | null;
  decisionNote?: string | null;
  createdAt: string;
}

export type BookingStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export interface Booking {
  id: string;
  resourceId: string;
  resource?: { id: string; assetTag: string; name: string; location?: string | null };
  bookedById: string;
  bookedBy?: { id: string; name: string; email: string };
  startTime: string;
  endTime: string;
  purpose?: string | null;
  status: BookingStatus;
}

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MaintenanceStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'TECHNICIAN_ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED';
export interface MaintenanceRequest {
  id: string;
  assetId: string;
  asset?: { id: string; assetTag: string; name: string; status: AssetStatus };
  raisedBy?: { id: string; name: string };
  approvedBy?: { id: string; name: string } | null;
  description: string;
  priority: MaintenancePriority;
  photoUrl?: string | null;
  status: MaintenanceStatus;
  technicianName?: string | null;
  resolutionNotes?: string | null;
  decisionNote?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

export type AuditScope = 'DEPARTMENT' | 'LOCATION';
export type AuditCycleStatus = 'OPEN' | 'CLOSED';
export type AuditItemStatus = 'PENDING' | 'VERIFIED' | 'MISSING' | 'DAMAGED';
export interface AuditItem {
  id: string;
  cycleId: string;
  assetId: string;
  asset?: { id: string; assetTag: string; name: string; location?: string | null; status: AssetStatus };
  status: AuditItemStatus;
  notes?: string | null;
  auditedBy?: { id: string; name: string } | null;
  auditedAt?: string | null;
}
export interface AuditCycle {
  id: string;
  name: string;
  scopeType: AuditScope;
  scopeValue: string;
  startDate: string;
  endDate: string;
  status: AuditCycleStatus;
  createdBy?: { id: string; name: string };
  createdAt: string;
  closedAt?: string | null;
  assignments?: { id: string; auditor: { id: string; name: string; email: string } }[];
  items?: AuditItem[];
  counts?: Record<AuditItemStatus, number>;
  _count?: { items: number };
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: string | null;
  createdAt: string;
}

export interface DashboardData {
  kpis: {
    assetsAvailable: number;
    assetsAllocated: number;
    underMaintenance: number;
    maintenanceToday: number;
    activeBookings: number;
    pendingTransfers: number;
    upcomingReturns: number;
    overdueReturns: number;
    totalAssets: number;
  };
  statusBreakdown: { status: AssetStatus; count: number }[];
  overdue: Allocation[];
  upcomingReturns: Allocation[];
  recentActivity: ActivityLog[];
  personal: { myAssets: number; myBookings: number; myOpenMaintenance: number };
}
