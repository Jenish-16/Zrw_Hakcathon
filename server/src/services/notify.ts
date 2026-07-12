import { supabase } from '../lib/supabase';
import { publish } from './sseHub';

interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  /** Optional id of the record this is about (used to avoid duplicate sends). */
  entityId?: string;
}

/** Create a notification for a single user. Never throws. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('Notification')
      .insert({
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link ?? null,
        entityId: input.entityId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    // Push to any open real-time stream this user has (no-op if none).
    publish(input.userId, 'notification', data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notify] failed', err);
  }
}

/** Create the same notification for many users (de-duplicated). */
export async function notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>): Promise<void> {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return;
  try {
    const { data, error } = await supabase
      .from('Notification')
      .insert(
        unique.map((userId) => ({
          userId,
          type: input.type,
          title: input.title,
          message: input.message,
          link: input.link ?? null,
          entityId: input.entityId ?? null,
        }))
      )
      .select();
    if (error) throw error;
    // Push each row to its recipient's open stream(s), if any.
    for (const row of data ?? []) publish(row.userId, 'notification', row);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notifyMany] failed', err);
  }
}

/** All ADMIN + ASSET_MANAGER user ids — the operational approvers. */
export async function getManagerIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('User')
    .select('id')
    .in('role', ['ADMIN', 'ASSET_MANAGER'])
    .eq('status', 'ACTIVE');
  if (error) throw error;
  return (data ?? []).map((m) => m.id);
}
