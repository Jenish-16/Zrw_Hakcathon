import { supabase } from '../lib/supabase';

/**
 * Atomically produce the next sequential asset tag (AF-0001, AF-0002, ...).
 * Delegates to the `next_asset_tag()` PostgreSQL function (see
 * supabase/schema.sql), which increments the Counter row atomically so
 * concurrent registrations never collide.
 */
export async function nextAssetTag(): Promise<string> {
  const { data, error } = await supabase.rpc('next_asset_tag');
  if (error) throw error;
  return data as string;
}
