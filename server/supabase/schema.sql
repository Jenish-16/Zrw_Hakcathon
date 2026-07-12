-- ===========================================================================
-- AssetFlow — Supabase / PostgreSQL schema
-- Run this ONCE in the Supabase Dashboard -> SQL Editor before starting the
-- app. It replaces what Prisma migrations used to create.
--
-- Notes:
--   * Table names are PascalCase and column names camelCase (quoted) to match
--     the field names the application code already uses.
--   * FK constraints are named "<Table>_<column>_fkey" — the server relies on
--     these exact names for supabase-js embedded (joined) selects.
--   * The service_role key bypasses Row Level Security, so no RLS policies are
--     defined here (the backend is the only client).
-- ===========================================================================

-- --- Enums -----------------------------------------------------------------
do $$ begin
  create type "Role" as enum ('ADMIN','ASSET_MANAGER','DEPARTMENT_HEAD','EMPLOYEE');
exception when duplicate_object then null; end $$;
do $$ begin
  create type "UserStatus" as enum ('ACTIVE','INACTIVE');
exception when duplicate_object then null; end $$;
do $$ begin
  create type "DepartmentStatus" as enum ('ACTIVE','INACTIVE');
exception when duplicate_object then null; end $$;
do $$ begin
  create type "AssetStatus" as enum ('AVAILABLE','ALLOCATED','RESERVED','UNDER_MAINTENANCE','LOST','RETIRED','DISPOSED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type "AssetCondition" as enum ('NEW','GOOD','FAIR','POOR','DAMAGED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type "AllocationStatus" as enum ('ACTIVE','RETURNED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type "TransferStatus" as enum ('REQUESTED','APPROVED','REJECTED','COMPLETED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type "BookingStatus" as enum ('UPCOMING','ONGOING','COMPLETED','CANCELLED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type "MaintenancePriority" as enum ('LOW','MEDIUM','HIGH','CRITICAL');
exception when duplicate_object then null; end $$;
do $$ begin
  create type "MaintenanceStatus" as enum ('PENDING','APPROVED','REJECTED','TECHNICIAN_ASSIGNED','IN_PROGRESS','RESOLVED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type "AuditScope" as enum ('DEPARTMENT','LOCATION');
exception when duplicate_object then null; end $$;
do $$ begin
  create type "AuditCycleStatus" as enum ('OPEN','CLOSED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type "AuditItemStatus" as enum ('PENDING','VERIFIED','MISSING','DAMAGED');
exception when duplicate_object then null; end $$;

-- --- Helper: auto-update "updatedAt" ---------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$ language plpgsql;

-- --- Tables ----------------------------------------------------------------
create table if not exists "Counter" (
  id    text primary key,
  value integer not null default 0
);

create table if not exists "User" (
  id           text primary key default gen_random_uuid()::text,
  name         text not null,
  email        text not null unique,
  "passwordHash" text not null,
  role         "Role" not null default 'EMPLOYEE',
  status       "UserStatus" not null default 'ACTIVE',
  phone        text,
  "jobTitle"   text,
  "departmentId" text,
  "createdAt"  timestamptz not null default now(),
  "updatedAt"  timestamptz not null default now()
);

create table if not exists "Department" (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  code        text not null unique,
  status      "DepartmentStatus" not null default 'ACTIVE',
  "headId"    text,
  "parentId"  text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "AssetCategory" (
  id            text primary key default gen_random_uuid()::text,
  name          text not null unique,
  description   text,
  "customFields" jsonb,
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now()
);

create table if not exists "Asset" (
  id                text primary key default gen_random_uuid()::text,
  "assetTag"        text not null unique,
  "qrCode"          text,
  name              text not null,
  "serialNumber"    text,
  "acquisitionDate" timestamptz,
  "acquisitionCost" double precision,
  condition         "AssetCondition" not null default 'GOOD',
  location          text,
  "photoUrl"        text,
  "documentUrl"     text,
  "isBookable"      boolean not null default false,
  status            "AssetStatus" not null default 'AVAILABLE',
  "customData"      jsonb,
  "categoryId"      text not null,
  "departmentId"    text,
  -- Real scheduled date for the asset's next preventive maintenance. Set when a
  -- maintenance request is resolved (resolved date + interval) and manually
  -- editable by managers. Drives the "due for maintenance" report.
  "nextMaintenanceDueDate" timestamptz,
  "createdAt"       timestamptz not null default now(),
  "updatedAt"       timestamptz not null default now()
);

create table if not exists "Allocation" (
  id                 text primary key default gen_random_uuid()::text,
  "assetId"          text not null,
  -- Exactly one of holderId (employee) / holderDepartmentId (whole department)
  -- is set; the API enforces this.
  "holderId"         text,
  "holderDepartmentId" text,
  "allocatedById"    text not null,
  "expectedReturnDate" timestamptz,
  "allocatedAt"      timestamptz not null default now(),
  "returnedAt"       timestamptz,
  "returnCondition"  "AssetCondition",
  "checkInNotes"     text,
  status             "AllocationStatus" not null default 'ACTIVE',
  "createdAt"        timestamptz not null default now()
);

create table if not exists "TransferRequest" (
  id             text primary key default gen_random_uuid()::text,
  "assetId"      text not null,
  "fromUserId"   text,
  "toUserId"     text not null,
  "requestedById" text not null,
  "approvedById" text,
  status         "TransferStatus" not null default 'REQUESTED',
  note           text,
  "decisionNote" text,
  "createdAt"    timestamptz not null default now(),
  "updatedAt"    timestamptz not null default now()
);

create table if not exists "Booking" (
  id           text primary key default gen_random_uuid()::text,
  "resourceId" text not null,
  "bookedById" text not null,
  "startTime"  timestamptz not null,
  "endTime"    timestamptz not null,
  purpose      text,
  status       "BookingStatus" not null default 'UPCOMING',
  "createdAt"  timestamptz not null default now(),
  "updatedAt"  timestamptz not null default now()
);

create table if not exists "MaintenanceRequest" (
  id              text primary key default gen_random_uuid()::text,
  "assetId"       text not null,
  "raisedById"    text not null,
  description     text not null,
  priority        "MaintenancePriority" not null default 'MEDIUM',
  "photoUrl"      text,
  status          "MaintenanceStatus" not null default 'PENDING',
  "approvedById"  text,
  "technicianName" text,
  "resolutionNotes" text,
  "decisionNote"  text,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now(),
  "resolvedAt"    timestamptz
);

create table if not exists "AuditCycle" (
  id            text primary key default gen_random_uuid()::text,
  name          text not null,
  "scopeType"   "AuditScope" not null,
  "scopeValue"  text not null,
  "startDate"   timestamptz not null,
  "endDate"     timestamptz not null,
  status        "AuditCycleStatus" not null default 'OPEN',
  "createdById" text not null,
  "createdAt"   timestamptz not null default now(),
  "closedAt"    timestamptz
);

create table if not exists "AuditAssignment" (
  id          text primary key default gen_random_uuid()::text,
  "cycleId"   text not null,
  "auditorId" text not null,
  unique ("cycleId", "auditorId")
);

create table if not exists "AuditItem" (
  id            text primary key default gen_random_uuid()::text,
  "cycleId"     text not null,
  "assetId"     text not null,
  status        "AuditItemStatus" not null default 'PENDING',
  notes         text,
  "auditedById" text,
  "auditedAt"   timestamptz,
  unique ("cycleId", "assetId")
);

create table if not exists "Notification" (
  id        text primary key default gen_random_uuid()::text,
  "userId"  text not null,
  type      text not null,
  title     text not null,
  message   text not null,
  link      text,
  -- Optional reference to the record this notification is about (e.g. an
  -- Allocation id) so repeat checks can detect "already notified".
  "entityId" text,
  "isRead"  boolean not null default false,
  "createdAt" timestamptz not null default now()
);

create table if not exists "ActivityLog" (
  id           text primary key default gen_random_uuid()::text,
  "userId"     text,
  "actorName"  text not null,
  action       text not null,
  "entityType" text not null,
  "entityId"   text,
  details      text,
  "createdAt"  timestamptz not null default now()
);

-- --- Column repairs for databases created before these features ------------
-- (must run BEFORE the foreign-key block below references the new columns)
alter table "Allocation"   alter column "holderId" drop not null;
alter table "Allocation"   add column if not exists "holderDepartmentId" text;
alter table "Notification" add column if not exists "entityId" text;
alter table "Asset"        add column if not exists "nextMaintenanceDueDate" timestamptz;

-- --- Foreign keys (named to match supabase-js embedded selects) ------------
-- Each is guarded so the script is idempotent: re-running it repairs any
-- constraint that a previous partial run left missing.
do $$ begin
  alter table "User"            add constraint "User_departmentId_fkey"            foreign key ("departmentId")   references "Department"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "Department"      add constraint "Department_headId_fkey"            foreign key ("headId")         references "User"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "Department"      add constraint "Department_parentId_fkey"          foreign key ("parentId")       references "Department"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "Asset"           add constraint "Asset_categoryId_fkey"             foreign key ("categoryId")     references "AssetCategory"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "Asset"           add constraint "Asset_departmentId_fkey"           foreign key ("departmentId")   references "Department"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "Allocation"      add constraint "Allocation_assetId_fkey"           foreign key ("assetId")        references "Asset"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "Allocation"      add constraint "Allocation_holderId_fkey"          foreign key ("holderId")       references "User"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "Allocation"      add constraint "Allocation_allocatedById_fkey"     foreign key ("allocatedById")  references "User"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "Allocation"      add constraint "Allocation_holderDepartmentId_fkey" foreign key ("holderDepartmentId") references "Department"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "TransferRequest" add constraint "TransferRequest_assetId_fkey"      foreign key ("assetId")        references "Asset"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "TransferRequest" add constraint "TransferRequest_fromUserId_fkey"   foreign key ("fromUserId")     references "User"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "TransferRequest" add constraint "TransferRequest_toUserId_fkey"     foreign key ("toUserId")       references "User"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "TransferRequest" add constraint "TransferRequest_requestedById_fkey" foreign key ("requestedById") references "User"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "TransferRequest" add constraint "TransferRequest_approvedById_fkey" foreign key ("approvedById")   references "User"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "Booking"         add constraint "Booking_resourceId_fkey"           foreign key ("resourceId")     references "Asset"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "Booking"         add constraint "Booking_bookedById_fkey"           foreign key ("bookedById")     references "User"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "MaintenanceRequest" add constraint "MaintenanceRequest_assetId_fkey"     foreign key ("assetId")     references "Asset"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "MaintenanceRequest" add constraint "MaintenanceRequest_raisedById_fkey"  foreign key ("raisedById")  references "User"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "MaintenanceRequest" add constraint "MaintenanceRequest_approvedById_fkey" foreign key ("approvedById") references "User"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "AuditCycle"      add constraint "AuditCycle_createdById_fkey"        foreign key ("createdById")    references "User"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "AuditAssignment" add constraint "AuditAssignment_cycleId_fkey"       foreign key ("cycleId")        references "AuditCycle"(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "AuditAssignment" add constraint "AuditAssignment_auditorId_fkey"     foreign key ("auditorId")      references "User"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "AuditItem"       add constraint "AuditItem_cycleId_fkey"             foreign key ("cycleId")        references "AuditCycle"(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "AuditItem"       add constraint "AuditItem_assetId_fkey"             foreign key ("assetId")        references "Asset"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "AuditItem"       add constraint "AuditItem_auditedById_fkey"         foreign key ("auditedById")    references "User"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "Notification"    add constraint "Notification_userId_fkey"           foreign key ("userId")         references "User"(id);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table "ActivityLog"     add constraint "ActivityLog_userId_fkey"            foreign key ("userId")         references "User"(id);
exception when duplicate_object then null; end $$;

-- --- updatedAt triggers (idempotent) ----------------------------------------
drop trigger if exists set_updated_at_user            on "User";
drop trigger if exists set_updated_at_department      on "Department";
drop trigger if exists set_updated_at_assetcategory   on "AssetCategory";
drop trigger if exists set_updated_at_asset           on "Asset";
drop trigger if exists set_updated_at_transferrequest on "TransferRequest";
drop trigger if exists set_updated_at_booking         on "Booking";
drop trigger if exists set_updated_at_maintenance     on "MaintenanceRequest";
create trigger set_updated_at_user            before update on "User"            for each row execute function set_updated_at();
create trigger set_updated_at_department      before update on "Department"      for each row execute function set_updated_at();
create trigger set_updated_at_assetcategory   before update on "AssetCategory"   for each row execute function set_updated_at();
create trigger set_updated_at_asset           before update on "Asset"           for each row execute function set_updated_at();
create trigger set_updated_at_transferrequest before update on "TransferRequest" for each row execute function set_updated_at();
create trigger set_updated_at_booking         before update on "Booking"         for each row execute function set_updated_at();
create trigger set_updated_at_maintenance     before update on "MaintenanceRequest" for each row execute function set_updated_at();

-- --- Asset QR code (added later; guarded so re-runs repair old databases) ---
-- Each asset carries a scannable QR identifier, e.g. "QR-AF-0001-3F7A2B".
-- New assets get theirs from the API at registration; the backfill below
-- covers rows created before the column existed.
alter table "Asset" add column if not exists "qrCode" text;
create unique index if not exists "Asset_qrCode_key" on "Asset"("qrCode");
update "Asset"
   set "qrCode" = 'QR-' || "assetTag" || '-' || upper(substr(md5(random()::text), 1, 6))
 where "qrCode" is null;

-- --- Sequential asset tag (AF-0001, AF-0002, ...) --------------------------
create or replace function next_asset_tag() returns text as $$
declare v integer;
begin
  insert into "Counter"(id, value) values ('asset_tag', 0)
    on conflict (id) do nothing;
  update "Counter" set value = value + 1 where id = 'asset_tag' returning value into v;
  return 'AF-' || lpad(v::text, 4, '0');
end;
$$ language plpgsql;
