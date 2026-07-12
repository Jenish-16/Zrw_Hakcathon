import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { supabase, unwrapMaybe } from '../lib/supabase';
import { AppError, forbidden, unauthorized } from '../utils/errors';
import { Role, UserStatus } from '../lib/types';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
  status: UserStatus;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw unauthorized('Authentication required');
    }
    const token = header.slice(7);
    const payload = verifyToken(token);
    const user = unwrapMaybe<AuthUser>(
      await supabase
        .from('User')
        .select('id, name, email, role, departmentId, status')
        .eq('id', payload.sub)
        .single()
    );
    if (!user) throw unauthorized('Account no longer exists');
    if (user.status === 'INACTIVE') throw forbidden('Your account has been deactivated');
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      status: user.status,
    };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(unauthorized('Invalid or expired session'));
  }
}

/** Restrict a route to one or more roles. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden());
    }
    next();
  };
}
