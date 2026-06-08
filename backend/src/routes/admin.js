import { Router } from 'express';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { listUsers, getUser, updateUser, updateSellerFee, listSellers, getStats, getSettings, updateSettings } from '../controllers/admin.js';

const router = Router();

router.use(requireAuth, requireSuperAdmin);

router.get('/stats',           getStats);
router.get('/settings',        getSettings);
router.patch('/settings',      updateSettings);
router.get('/users',           listUsers);
router.get('/users/:id',       getUser);
router.patch('/users/:id',     updateUser);
router.get('/sellers',           listSellers);
router.patch('/sellers/:id/fee', updateSellerFee);

export default router;
