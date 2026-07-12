import { supabase } from '../lib/supabase';
import { AuthUser } from '../middleware/auth';

interface LogInput {
  action: string;
  entityType: string;
  entityId?: string;
  details?: string;
}

/** Record an entry in the global activity log. Never throws. */
export async function logActivity(actor: AuthUser | null, input: LogInput): Promise<void> {
  try {
    const { error } = await supabase.from('ActivityLog').insert({
      userId: actor?.id ?? null,
      actorName: actor?.name ?? 'System',
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      details: input.details ?? null,
    });
    if (error) throw error;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[activity] failed to log', err);
  }
}
