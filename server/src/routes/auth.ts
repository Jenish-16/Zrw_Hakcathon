import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { supabase, unwrap, unwrapMaybe } from '../lib/supabase';
import { asyncHandler } from '../utils/asyncHandler';
import { signToken } from '../utils/jwt';
import { authenticate } from '../middleware/auth';
import { badRequest, unauthorized } from '../utils/errors';
import { logActivity } from '../services/activity';

const router = Router();

const publicUser =
  'id, name, email, role, status, phone, jobTitle, departmentId, department:Department!User_departmentId_fkey(id,name,code)';

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Signup ALWAYS creates a plain Employee account. Roles are never self-assigned;
// an Admin promotes users from the Employee Directory.
router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { name, email, password } = signupSchema.parse(req.body);
    const existing = unwrapMaybe(
      await supabase.from('User').select('id').eq('email', email).single()
    );
    if (existing) throw badRequest('An account with this email already exists');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = unwrap(
      await supabase
        .from('User')
        .insert({ name, email, passwordHash, role: 'EMPLOYEE', status: 'ACTIVE' })
        .select(publicUser)
        .single()
    );

    await logActivity({ ...user, status: 'ACTIVE' } as any, {
      action: 'Signed up',
      entityType: 'User',
      entityId: user.id,
      details: `${name} created an Employee account`,
    });

    const token = signToken({ sub: user.id, role: user.role, email: user.email });
    res.status(201).json({ token, user });
  })
);

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = unwrapMaybe(await supabase.from('User').select('*').eq('email', email).single());
    if (!user) throw unauthorized('Invalid email or password');
    if (user.status === 'INACTIVE') throw unauthorized('Your account has been deactivated. Contact an administrator.');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw unauthorized('Invalid email or password');

    const token = signToken({ sub: user.id, role: user.role, email: user.email });
    const safe = unwrapMaybe(await supabase.from('User').select(publicUser).eq('id', user.id).single());
    res.json({ token, user: safe });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = unwrapMaybe(
      await supabase.from('User').select(publicUser).eq('id', req.user!.id).single()
    );
    res.json({ user });
  })
);

const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

// Simplified reset for the demo environment: verifies the email exists and sets
// a new password directly (no email delivery infrastructure required).
router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email, newPassword } = forgotSchema.parse(req.body);
    const user = unwrapMaybe(await supabase.from('User').select('id').eq('email', email).single());
    if (!user) throw badRequest('No account found with that email address');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const { error } = await supabase.from('User').update({ passwordHash }).eq('id', user.id);
    if (error) throw error;
    res.json({ message: 'Password updated. You can now log in with your new password.' });
  })
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

router.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = unwrapMaybe(
      await supabase.from('User').select('id, passwordHash').eq('id', req.user!.id).single()
    );
    if (!user) throw unauthorized();
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw badRequest('Current password is incorrect');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const { error } = await supabase.from('User').update({ passwordHash }).eq('id', user.id);
    if (error) throw error;
    res.json({ message: 'Password changed successfully' });
  })
);

export default router;
