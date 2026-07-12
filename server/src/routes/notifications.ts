import { Router } from 'express';
import { supabase, unwrap } from '../lib/supabase';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { verifyToken } from '../utils/jwt';
import { addConnection, removeConnection } from '../services/sseHub';

const router = Router();

// Real-time stream (Server-Sent Events). The browser's EventSource cannot set
// an Authorization header, so the JWT is passed as a query param and verified
// here directly. This route is declared BEFORE the header-based `authenticate`
// guard below so it uses its own auth. Delivery is scoped per user id, so a
// client only ever receives its own notifications.
router.get('/stream', (req, res) => {
  let userId: string;
  try {
    userId = verifyToken((req.query.token as string) || '').sub;
  } catch {
    res.status(401).end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable proxy buffering (nginx et al.)
  });
  res.write('retry: 5000\n\n'); // reconnect backoff hint for the client
  res.write(': connected\n\n'); // open the stream with a comment frame
  addConnection(userId, res);

  // Heartbeat so idle proxies don't drop a quiet connection.
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      /* ignore — close handler cleans up */
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeConnection(userId, res);
  });
});

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { unread } = req.query as Record<string, string>;
    let q = supabase.from('Notification').select('*').eq('userId', req.user!.id);
    if (unread === 'true') q = q.eq('isRead', false);
    const notifications = unwrap(await q.order('createdAt', { ascending: false }).limit(50));
    res.json(notifications);
  })
);

router.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const { count, error } = await supabase
      .from('Notification')
      .select('*', { count: 'exact', head: true })
      .eq('userId', req.user!.id)
      .eq('isRead', false);
    if (error) throw error;
    res.json({ count: count ?? 0 });
  })
);

router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const { error } = await supabase
      .from('Notification')
      .update({ isRead: true })
      .eq('id', req.params.id)
      .eq('userId', req.user!.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    const { error } = await supabase
      .from('Notification')
      .update({ isRead: true })
      .eq('userId', req.user!.id)
      .eq('isRead', false);
    if (error) throw error;
    res.json({ ok: true });
  })
);

export default router;
