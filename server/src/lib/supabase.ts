import { createClient, PostgrestError } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Server-side Supabase client using the SERVICE ROLE key. This bypasses Row
 * Level Security, so the Express API remains the single trusted gatekeeper
 * (exactly as it was with Prisma). Never expose this client to the browser.
 */
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// The service-role client is created without generated Database types, so
// query results are effectively untyped. The `data` parameter below is typed
// as `any` on purpose: it stops TypeScript from inferring `never`/`null` row
// types from the client, so callers get `any` by default (or an explicit type
// when they pass one, e.g. `unwrapMaybe<AuthUser>(...)`).

/**
 * Unwrap a supabase-js result: return the data or throw the PostgrestError so
 * the central error handler can map it to an HTTP status.
 */
export function unwrap<T = any>(res: { data: any; error: PostgrestError | null }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

/**
 * Like unwrap() but for single-row fetches that may legitimately return no
 * row. Returns null when nothing was found (PGRST116) instead of throwing.
 */
export function unwrapMaybe<T = any>(res: { data: any; error: PostgrestError | null }): T | null {
  if (res.error) {
    if (res.error.code === 'PGRST116') return null; // no rows for .single()
    throw res.error;
  }
  return res.data as T | null;
}
