import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { supabase, unwrap, unwrapMaybe } from '../lib/supabase';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { badRequest, notFound } from '../utils/errors';
import { logActivity } from '../services/activity';
import { notify } from '../services/notify';
import { Role } from '../lib/types';

const router = Router();
router.use(authenticate);

const publicUser =
  'id, name, email, role, status, phone, jobTitle, departmentId, createdAt, department:Department!User_departmentId_fkey(id,name,code)';

// List / search the employee directory. Available to all authenticated users
// (needed for allocation targets, auditor pickers, transfer recipients, etc.).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { role, status, departmentId, search, unallocated } = req.query as Record<string, string>;
    let q = supabase.from('User').select(publicUser);
    if (role) q = q.eq('role', role);
    if (status) q = q.eq('status', status);
    if (departmentId) q = q.eq('departmentId', departmentId);
    if (search) {
      q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,jobTitle.ilike.%${search}%`);
    }
    let users = unwrap(await q.order('name', { ascending: true })) as { id: string }[];

    // ?unallocated=true — keep only employees who currently hold NO active
    // allocation (used by the allocation + transfer recipient dropdowns so they
    // only show eligible people). Queried directly on Allocation (no embeds) so
    // it works regardless of the holderDepartment relation.
    if (unallocated === 'true') {
      const active = unwrap(
        await supabase.from('Allocation').select('holderId').eq('status', 'ACTIVE').not('holderId', 'is', null)
      ) as { holderId: string }[];
      const held = new Set(active.map((a) => a.holderId));
      users = users.filter((u) => !held.has(u.id));
    }
    res.json(users);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = unwrapMaybe(
      await supabase.from('User').select(publicUser).eq('id', req.params.id).single()
    );
    if (!user) throw notFound('User not found');
    res.json(user);
  })
);

const createSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).optional(),
  role: z.nativeEnum(Role).optional(),
  departmentId: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
});

// Admin adds an employee directly to the directory.
router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const existing = unwrapMaybe(
      await supabase.from('User').select('id').eq('email', data.email).single()
    );
    if (existing) throw badRequest('An account with this email already exists');
    const passwordHash = await bcrypt.hash(data.password ?? 'Welcome@123', 10);
    const user = unwrap(
      await supabase
        .from('User')
        .insert({
          name: data.name,
          email: data.email,
          passwordHash,
          role: data.role ?? 'EMPLOYEE',
          departmentId: data.departmentId ?? null,
          jobTitle: data.jobTitle ?? null,
          phone: data.phone ?? null,
        })
        .select(publicUser)
        .single()
    );
    await logActivity(req.user!, {
      action: 'Created employee',
      entityType: 'User',
      entityId: user.id,
      details: `${user.name} (${user.role}) added to directory`,
    });
    res.status(201).json(user);
  })
);

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  departmentId: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

router.patch(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const user = unwrap(
      await supabase.from('User').update(data).eq('id', req.params.id).select(publicUser).single()
    );
    await logActivity(req.user!, {
      action: 'Updated employee',
      entityType: 'User',
      entityId: user.id,
      details: `Updated ${user.name}`,
    });
    res.json(user);
  })
);

const roleSchema = z.object({ role: z.nativeEnum(Role) });

// The ONLY place roles are assigned — Admin promotes/demotes directory members.
router.patch(
  '/:id/role',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { role } = roleSchema.parse(req.body);
    const target = unwrapMaybe(
      await supabase.from('User').select('id').eq('id', req.params.id).single()
    );
    if (!target) throw notFound('User not found');
    if (target.id === req.user!.id) throw badRequest('You cannot change your own role');

    const user = unwrap(
      await supabase.from('User').update({ role }).eq('id', req.params.id).select(publicUser).single()
    );
    await logActivity(req.user!, {
      action: 'Changed role',
      entityType: 'User',
      entityId: user.id,
      details: `${user.name} is now ${role.replace('_', ' ')}`,
    });
    await notify({
      userId: user.id,
      type: 'ROLE_CHANGED',
      title: 'Your role was updated',
      message: `An administrator set your role to ${role.replace('_', ' ')}.`,
      link: '/dashboard',
    });
    res.json(user);
  })
);

const statusSchema = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) });

router.patch(
  '/:id/status',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { status } = statusSchema.parse(req.body);
    const target = unwrapMaybe(
      await supabase.from('User').select('id').eq('id', req.params.id).single()
    );
    if (!target) throw notFound('User not found');
    if (target.id === req.user!.id) throw badRequest('You cannot deactivate your own account');
    const user = unwrap(
      await supabase.from('User').update({ status }).eq('id', req.params.id).select(publicUser).single()
    );
    await logActivity(req.user!, {
      action: status === 'ACTIVE' ? 'Activated employee' : 'Deactivated employee',
      entityType: 'User',
      entityId: user.id,
      details: user.name,
    });
    res.json(user);
  })
);

export default router;
