import { Router } from 'express';
import { supabase, unwrap } from '../lib/supabase';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';

const router = Router();
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
