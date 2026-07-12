import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in server/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@assetflow.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
const DEMO_PASSWORD = 'Password@123';

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}
function at(hour: number, dayOffset = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Insert one row and return it (with the DB-generated id). */
async function insertOne(table: string, row: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}
/** Insert many rows. */
async function insertMany(table: string, rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw error;
}
/** Delete every row in a table (supabase requires a filter, so match all). */
async function clearTable(table: string): Promise<void> {
  const { error } = await supabase.from(table).delete().neq('id', '__never_matches__');
  if (error) throw error;
}
async function updateAll(table: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from(table).update(patch).neq('id', '__never_matches__');
  if (error) throw error;
}
async function setAssetStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from('Asset').update({ status }).eq('id', id);
  if (error) throw error;
}

async function main() {
  console.log('🌱 Seeding AssetFlow...');

  // --- Reset (dependency order) ---------------------------------------------
  for (const t of [
    'Notification',
    'ActivityLog',
    'AuditItem',
    'AuditAssignment',
    'AuditCycle',
    'MaintenanceRequest',
    'Booking',
    'TransferRequest',
    'Allocation',
    'Asset',
    'AssetCategory',
  ]) {
    await clearTable(t);
  }
  // Departments/users need head/member relations cleared first.
  await updateAll('Department', { headId: null, parentId: null });
  await updateAll('User', { departmentId: null });
  await clearTable('Department');
  await clearTable('User');
  await clearTable('Counter');

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const demoHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // --- Users ----------------------------------------------------------------
  const admin = await insertOne('User', {
    name: 'Aarav Sharma', email: ADMIN_EMAIL, passwordHash: adminHash, role: 'ADMIN', jobTitle: 'System Administrator',
  });
  const assetManager = await insertOne('User', {
    name: 'Priya Nair', email: 'manager@assetflow.com', passwordHash: demoHash, role: 'ASSET_MANAGER', jobTitle: 'Asset Manager',
  });
  const itHead = await insertOne('User', {
    name: 'Rohan Mehta', email: 'ithead@assetflow.com', passwordHash: demoHash, role: 'DEPARTMENT_HEAD', jobTitle: 'Head of IT',
  });
  const hrHead = await insertOne('User', {
    name: 'Sneha Kapoor', email: 'hrhead@assetflow.com', passwordHash: demoHash, role: 'DEPARTMENT_HEAD', jobTitle: 'Head of HR',
  });

  const employees = await Promise.all(
    (
      [
        ['Vikram Singh', 'vikram@assetflow.com', 'Software Engineer'],
        ['Ananya Iyer', 'ananya@assetflow.com', 'UX Designer'],
        ['Karan Patel', 'karan@assetflow.com', 'Support Specialist'],
        ['Meera Joshi', 'meera@assetflow.com', 'HR Executive'],
        ['Aditya Rao', 'aditya@assetflow.com', 'Facilities Coordinator'],
        ['Isha Verma', 'isha@assetflow.com', 'Accountant'],
        ['Dev Malhotra', 'dev@assetflow.com', 'QA Engineer'],
        ['Nisha Reddy', 'nisha@assetflow.com', 'Operations Analyst'],
      ] as const
    ).map(([name, email, jobTitle]) =>
      insertOne('User', { name, email, passwordHash: demoHash, role: 'EMPLOYEE', jobTitle })
    )
  );

  // --- Departments ----------------------------------------------------------
  const it = await insertOne('Department', { name: 'Information Technology', code: 'IT', headId: itHead.id });
  const hr = await insertOne('Department', { name: 'Human Resources', code: 'HR', headId: hrHead.id });
  const facilities = await insertOne('Department', { name: 'Facilities', code: 'FAC' });
  const ops = await insertOne('Department', { name: 'Operations', code: 'OPS' });
  const finance = await insertOne('Department', { name: 'Finance', code: 'FIN' });
  const support = await insertOne('Department', { name: 'IT Support', code: 'ITS', parentId: it.id });

  // Assign members to departments.
  const setDept = async (userId: string, departmentId: string) => {
    const { error } = await supabase.from('User').update({ departmentId }).eq('id', userId);
    if (error) throw error;
  };
  await setDept(itHead.id, it.id);
  await setDept(hrHead.id, hr.id);
  await setDept(assetManager.id, facilities.id);
  const deptForEmp = [it.id, it.id, support.id, hr.id, facilities.id, finance.id, it.id, ops.id];
  await Promise.all(employees.map((e, i) => setDept(e.id, deptForEmp[i])));

  // --- Categories -----------------------------------------------------------
  const electronics = await insertOne('AssetCategory', {
    name: 'Electronics',
    description: 'Laptops, monitors, phones and IT peripherals',
    customFields: [{ key: 'warrantyMonths', label: 'Warranty (months)', type: 'number' }],
  });
  const furniture = await insertOne('AssetCategory', { name: 'Furniture', description: 'Desks, chairs and storage' });
  const vehicles = await insertOne('AssetCategory', {
    name: 'Vehicles',
    description: 'Company cars and delivery vehicles',
    customFields: [
      { key: 'registrationNo', label: 'Registration No.', type: 'text' },
      { key: 'fuelType', label: 'Fuel Type', type: 'text' },
    ],
  });
  const rooms = await insertOne('AssetCategory', { name: 'Meeting Rooms', description: 'Bookable shared spaces' });
  const equipment = await insertOne('AssetCategory', { name: 'Equipment', description: 'Projectors, cameras and tools' });

  // --- Counter for asset tags ----------------------------------------------
  let tagN = 0;
  const tag = () => `AF-${String(++tagN).padStart(4, '0')}`;

  type AssetSeed = {
    name: string;
    categoryId: string;
    status?: string;
    condition?: string;
    location?: string;
    departmentId?: string;
    cost?: number;
    isBookable?: boolean;
    ageYears?: number;
    custom?: Record<string, unknown>;
  };

  const assetSeeds: AssetSeed[] = [
    { name: 'MacBook Pro 16"', categoryId: electronics.id, cost: 249000, departmentId: it.id, ageYears: 1, custom: { warrantyMonths: 24 } },
    { name: 'Dell XPS 15', categoryId: electronics.id, cost: 165000, departmentId: it.id, ageYears: 2, custom: { warrantyMonths: 12 } },
    { name: 'ThinkPad X1 Carbon', categoryId: electronics.id, cost: 155000, departmentId: support.id, ageYears: 1 },
    { name: 'Dell UltraSharp Monitor 27"', categoryId: electronics.id, cost: 42000, departmentId: it.id, ageYears: 3 },
    { name: 'iPhone 15 Pro', categoryId: electronics.id, cost: 134900, departmentId: it.id, ageYears: 1, custom: { warrantyMonths: 12 } },
    { name: 'iPad Air', categoryId: electronics.id, cost: 59900, departmentId: hr.id, ageYears: 2 },
    { name: 'Logitech MX Keyboard', categoryId: electronics.id, cost: 12000, condition: 'FAIR', ageYears: 4 },
    { name: 'HP LaserJet Printer', categoryId: electronics.id, cost: 38000, departmentId: facilities.id, condition: 'POOR', ageYears: 5 },
    { name: 'Ergonomic Chair - Herman Miller', categoryId: furniture.id, cost: 78000, departmentId: it.id, ageYears: 2 },
    { name: 'Standing Desk', categoryId: furniture.id, cost: 45000, departmentId: it.id, ageYears: 1 },
    { name: 'Conference Table', categoryId: furniture.id, cost: 65000, departmentId: facilities.id, ageYears: 3 },
    { name: 'Filing Cabinet', categoryId: furniture.id, cost: 15000, departmentId: hr.id, condition: 'FAIR', ageYears: 6 },
    { name: 'Office Sofa', categoryId: furniture.id, cost: 55000, departmentId: hr.id, ageYears: 2 },
    { name: 'Toyota Innova', categoryId: vehicles.id, cost: 2500000, departmentId: ops.id, ageYears: 2, isBookable: true, custom: { registrationNo: 'MH12AB1234', fuelType: 'Diesel' } },
    { name: 'Maruti Swift', categoryId: vehicles.id, cost: 850000, departmentId: ops.id, ageYears: 3, isBookable: true, custom: { registrationNo: 'MH14CD5678', fuelType: 'Petrol' } },
    { name: 'Delivery Van', categoryId: vehicles.id, cost: 1200000, departmentId: ops.id, condition: 'FAIR', ageYears: 5, isBookable: true, custom: { registrationNo: 'MH01EF9012', fuelType: 'Diesel' } },
    { name: 'Conference Room A', categoryId: rooms.id, location: 'Floor 1 - North', isBookable: true, cost: 0 },
    { name: 'Conference Room B2', categoryId: rooms.id, location: 'Floor 2 - East', isBookable: true, cost: 0 },
    { name: 'Board Room', categoryId: rooms.id, location: 'Floor 3 - Executive', isBookable: true, cost: 0 },
    { name: 'Training Room', categoryId: rooms.id, location: 'Floor 1 - South', isBookable: true, cost: 0 },
    { name: 'Epson Projector', categoryId: equipment.id, cost: 68000, departmentId: facilities.id, isBookable: true, ageYears: 3 },
    { name: 'Sony Camera A7 III', categoryId: equipment.id, cost: 185000, departmentId: hr.id, isBookable: true, ageYears: 2 },
    { name: 'Whiteboard (Large)', categoryId: equipment.id, cost: 8000, departmentId: it.id, ageYears: 1 },
    { name: 'Cisco Network Switch', categoryId: equipment.id, cost: 95000, departmentId: it.id, ageYears: 4, condition: 'FAIR' },
    { name: 'UPS Battery Backup', categoryId: equipment.id, cost: 32000, departmentId: facilities.id, condition: 'POOR', ageYears: 5 },
    { name: 'Samsung Galaxy Tab', categoryId: electronics.id, cost: 45000, departmentId: ops.id, ageYears: 2 },
    { name: 'Wacom Drawing Tablet', categoryId: electronics.id, cost: 28000, departmentId: it.id, ageYears: 1 },
    { name: 'Portable Speaker JBL', categoryId: equipment.id, cost: 15000, isBookable: true, ageYears: 2 },
  ];

  const createdAssets: any[] = [];
  for (const s of assetSeeds) {
    const a = await insertOne('Asset', {
      assetTag: tag(),
      name: s.name,
      categoryId: s.categoryId,
      status: s.status ?? 'AVAILABLE',
      condition: s.condition ?? 'GOOD',
      location: s.location ?? 'HQ - Main Building',
      departmentId: s.departmentId ?? null,
      acquisitionCost: s.cost ?? null,
      acquisitionDate: s.ageYears ? daysFromNow(-s.ageYears * 365) : daysFromNow(-120),
      isBookable: s.isBookable ?? false,
      serialNumber: `SN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      customData: s.custom ?? null,
    });
    createdAssets.push(a);
  }
  await insertOne('Counter', { id: 'asset_tag', value: tagN });

  const byName = (n: string) => createdAssets.find((a) => a.name === n)!;

  // --- Allocations ----------------------------------------------------------
  async function allocate(assetName: string, holderId: string, expected: string | null, returned = false) {
    const asset = byName(assetName);
    await insertOne('Allocation', {
      assetId: asset.id,
      holderId,
      allocatedById: assetManager.id,
      expectedReturnDate: expected,
      allocatedAt: daysFromNow(returned ? -60 : -20),
      status: returned ? 'RETURNED' : 'ACTIVE',
      returnedAt: returned ? daysFromNow(-5) : null,
      returnCondition: returned ? 'GOOD' : null,
      checkInNotes: returned ? 'Returned in good condition.' : null,
    });
    if (!returned) await setAssetStatus(asset.id, 'ALLOCATED');
  }

  await allocate('MacBook Pro 16"', employees[0].id, daysFromNow(20));
  await allocate('Dell XPS 15', employees[1].id, daysFromNow(-3)); // overdue
  await allocate('iPhone 15 Pro', employees[6].id, daysFromNow(5)); // upcoming return
  await allocate('ThinkPad X1 Carbon', employees[2].id, null);
  await allocate('iPad Air', employees[3].id, daysFromNow(-8)); // overdue
  await allocate('Standing Desk', employees[0].id, null);
  await allocate('Samsung Galaxy Tab', employees[7].id, daysFromNow(3)); // upcoming
  await allocate('Wacom Drawing Tablet', employees[1].id, null);
  // A returned (historical) allocation.
  await allocate('Logitech MX Keyboard', employees[2].id, null, true);

  // --- Bookings -------------------------------------------------------------
  async function book(resourceName: string, userId: string, start: Date, end: Date, purpose: string) {
    const r = byName(resourceName);
    const now = new Date();
    const status = end <= now ? 'COMPLETED' : start <= now && end > now ? 'ONGOING' : 'UPCOMING';
    await insertOne('Booking', {
      resourceId: r.id,
      bookedById: userId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      purpose,
      status,
    });
  }
  await book('Conference Room B2', employees[0].id, at(9, 0), at(10, 0), 'Sprint planning');
  await book('Conference Room B2', hrHead.id, at(11, 0), at(12, 0), 'Interview panel');
  await book('Conference Room A', employees[3].id, at(14, 1), at(15, 1), 'Team sync');
  await book('Board Room', admin.id, at(10, 2), at(12, 2), 'Quarterly review');
  await book('Toyota Innova', employees[7].id, at(8, 1), at(18, 1), 'Client site visit');
  await book('Epson Projector', employees[4].id, at(9, -2), at(11, -2), 'Training session');
  await book('Training Room', hrHead.id, at(13, 3), at(16, 3), 'Onboarding workshop');
  await book('Sony Camera A7 III', employees[1].id, at(10, 4), at(17, 4), 'Product photoshoot');

  // --- Maintenance ----------------------------------------------------------
  await insertOne('MaintenanceRequest', {
    assetId: byName('HP LaserJet Printer').id,
    raisedById: employees[4].id,
    description: 'Printer jams frequently and produces faded prints. Needs servicing.',
    priority: 'HIGH',
    status: 'PENDING',
  });
  await insertOne('MaintenanceRequest', {
    assetId: byName('UPS Battery Backup').id,
    raisedById: employees[6].id,
    description: 'Battery backup lasts under 2 minutes. Likely needs replacement.',
    priority: 'CRITICAL',
    status: 'PENDING',
  });
  // Approved -> asset under maintenance
  const ciscoAsset = byName('Cisco Network Switch');
  await insertOne('MaintenanceRequest', {
    assetId: ciscoAsset.id,
    raisedById: itHead.id,
    description: 'Intermittent port failures on switch. Under repair.',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    approvedById: assetManager.id,
    technicianName: 'TechCare Solutions',
  });
  await setAssetStatus(ciscoAsset.id, 'UNDER_MAINTENANCE');
  // A resolved one for history
  await insertOne('MaintenanceRequest', {
    assetId: byName('Delivery Van').id,
    raisedById: employees[7].id,
    description: 'Scheduled service and brake inspection.',
    priority: 'MEDIUM',
    status: 'RESOLVED',
    approvedById: assetManager.id,
    technicianName: 'AutoFix Garage',
    resolutionNotes: 'Service completed, brakes replaced.',
    resolvedAt: daysFromNow(-2),
  });

  // --- Transfer request (pending) ------------------------------------------
  await insertOne('TransferRequest', {
    assetId: byName('MacBook Pro 16"').id,
    fromUserId: employees[0].id,
    toUserId: employees[6].id,
    requestedById: employees[6].id,
    note: 'Vikram is moving to another project; I need this laptop for QA automation.',
    status: 'REQUESTED',
  });

  // --- Audit cycle ----------------------------------------------------------
  const itAssets = createdAssets.filter(
    (a) => a.departmentId === it.id && !['RETIRED', 'DISPOSED'].includes(a.status)
  );
  const cycle = await insertOne('AuditCycle', {
    name: 'Q3 IT Department Audit',
    scopeType: 'DEPARTMENT',
    scopeValue: it.id,
    startDate: daysFromNow(-3),
    endDate: daysFromNow(10),
    createdById: admin.id,
  });
  await insertMany('AuditAssignment', [
    { cycleId: cycle.id, auditorId: itHead.id },
    { cycleId: cycle.id, auditorId: employees[0].id },
  ]);
  await insertMany(
    'AuditItem',
    itAssets.map((a, i) => ({
      cycleId: cycle.id,
      assetId: a.id,
      status: i === 0 ? 'VERIFIED' : i === 1 ? 'DAMAGED' : 'PENDING',
      notes: i === 1 ? 'Screen has visible scratches.' : null,
      auditedById: i < 2 ? itHead.id : null,
      auditedAt: i < 2 ? new Date().toISOString() : null,
    }))
  );

  // --- Notifications & activity log -----------------------------------------
  await insertMany('Notification', [
    { userId: employees[0].id, type: 'ASSET_ASSIGNED', title: 'Asset assigned to you', message: 'AF-0001 — MacBook Pro 16" has been allocated to you.', link: '/allocations' },
    { userId: employees[6].id, type: 'TRANSFER_REQUESTED', title: 'Transfer request submitted', message: 'Your transfer request for AF-0001 is pending approval.', link: '/transfers' },
    { userId: assetManager.id, type: 'MAINTENANCE_REQUESTED', title: 'Maintenance request pending', message: 'A CRITICAL request was raised for AF-0025 (UPS Battery Backup).', link: '/maintenance' },
    { userId: itHead.id, type: 'AUDIT_ASSIGNED', title: 'You were assigned to an audit', message: 'You are an auditor for "Q3 IT Department Audit".', link: '/audits' },
  ]);

  await insertMany('ActivityLog', [
    { userId: assetManager.id, actorName: assetManager.name, action: 'Registered asset', entityType: 'Asset', details: 'AF-0001 — MacBook Pro 16"' },
    { userId: assetManager.id, actorName: assetManager.name, action: 'Allocated asset', entityType: 'Asset', details: 'AF-0001 → Vikram Singh' },
    { userId: employees[4].id, actorName: employees[4].name, action: 'Raised maintenance request', entityType: 'Asset', details: 'AF-0008 — HIGH priority' },
    { userId: admin.id, actorName: admin.name, action: 'Created audit cycle', entityType: 'AuditCycle', details: 'Q3 IT Department Audit' },
    { userId: employees[6].id, actorName: employees[6].name, action: 'Requested transfer', entityType: 'Asset', details: 'AF-0001 → Dev Malhotra' },
  ]);

  console.log('✅ Seed complete!\n');
  console.log('   Login accounts (all demo passwords are "Password@123"):');
  console.log(`   • Admin          ${ADMIN_EMAIL}  /  ${ADMIN_PASSWORD}`);
  console.log('   • Asset Manager  manager@assetflow.com  /  Password@123');
  console.log('   • Dept Head      ithead@assetflow.com   /  Password@123');
  console.log('   • Employee       vikram@assetflow.com   /  Password@123\n');
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
