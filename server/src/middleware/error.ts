import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ZodError } from 'zod';
import { PostgrestError } from '@supabase/supabase-js';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Route not found' });
}

function isPostgrestError(err: unknown): err is PostgrestError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err instanceof ZodError) {
    const first = err.errors[0];
    const field = first?.path?.join('.') ?? 'input';
    return res.status(400).json({
      error: first ? `${field}: ${first.message}` : 'Validation failed',
      details: err.errors,
    });
  }

  // Supabase config/auth failures (bad or missing API key) arrive as plain
  // objects with a message/hint but no PostgREST `code`. Surface a clear 503.
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    const msg = (err as { message: string }).message.toLowerCase();
    if (msg.includes('invalid api key') || msg.includes('fetch failed') || msg.includes('jwt')) {
      return res.status(503).json({
        error:
          'Cannot authenticate with Supabase. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env.',
      });
    }
  }

  if (isPostgrestError(err)) {
    // PostgreSQL SQLSTATE codes surfaced through PostgREST / supabase-js.
    switch (err.code) {
      case '23505': // unique_violation
        return res.status(409).json({ error: 'A record with these details already exists' });
      case '23503': // foreign_key_violation
        return res
          .status(409)
          .json({ error: 'This record is referenced by other data and cannot be modified' });
      case '23502': // not_null_violation
        return res.status(400).json({ error: 'A required field is missing' });
      case 'PGRST116': // no rows returned for a .single() query
        return res.status(404).json({ error: 'Record not found' });
      default:
        break;
    }
    // Network / configuration failures reaching Supabase.
    if (err.message?.toLowerCase().includes('fetch failed')) {
      return res.status(503).json({
        error:
          'Cannot reach Supabase. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env.',
      });
    }
    // eslint-disable-next-line no-console
    console.error('[SUPABASE ERROR]', err);
    return res.status(400).json({ error: err.message });
  }

  // eslint-disable-next-line no-console
  console.error('[UNHANDLED ERROR]', err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ error: message });
}
