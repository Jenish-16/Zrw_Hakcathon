import { Router } from 'express';
import { supabase, unwrap } from '../lib/supabase';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Full activity/audit log. Admin & Asset Managers see everything; other roles
// see their own actions only.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { entityType, entityId, search } = req.query as Record<string, string>;
    const user = req.user!;
    let q = supabase.from('ActivityLog').select('*');
    if (!['ADMIN', 'ASSET_MANAGER'].includes(user.role)) {
      q = q.eq('userId', user.id);
    }
    if (entityType) q = q.eq('entityType', entityType);
    if (entityId) q = q.eq('entityId', entityId);
    if (search) {
      q = q.or(
        `action.ilike.%${search}%,details.ilike.%${search}%,actorName.ilike.%${search}%`
      );
    }
    const logs = unwrap(await q.order('createdAt', { ascending: false }).limit(200));
    res.json(logs);
  })
);

export default router;
