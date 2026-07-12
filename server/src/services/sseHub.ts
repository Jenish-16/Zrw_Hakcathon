import type { Response } from 'express';

/**
 * In-memory Server-Sent Events hub for per-user real-time notifications.
 *
 * Connections are keyed by userId; publish() fans a payload out to every open
 * stream a user has (multiple tabs / devices). This deliberately lives in the
 * API process — the Express server is already the single JWT-authenticated
 * gatekeeper, so no Supabase key or Realtime authorization has to reach the
 * browser. If the API is ever scaled to multiple instances, swap this module's
 * internals for a shared pub/sub (Postgres LISTEN/NOTIFY or Redis) without
 * touching any caller.
 */
const connections = new Map<string, Set<Response>>();

export function addConnection(userId: string, res: Response): void {
  let set = connections.get(userId);
  if (!set) {
    set = new Set();
    connections.set(userId, set);
  }
  set.add(res);
}

export function removeConnection(userId: string, res: Response): void {
  const set = connections.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) connections.delete(userId);
}

/** Push a named JSON event to all of a user's open streams. Never throws. */
export function publish(userId: string, event: string, data: unknown): void {
  const set = connections.get(userId);
  if (!set || set.size === 0) return;
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(frame);
    } catch {
      // Broken pipe — the 'close' handler will clean this connection up.
    }
  }
}
