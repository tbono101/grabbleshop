import { Router } from 'express';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { listUsers, getUser, updateUser, listSellers, getStats } from '../controllers/admin.js';

const router = Router();

router.use(requireAuth, requireSuperAdmin);

router.get('/stats',           getStats);
router.get('/users',           listUsers);
router.get('/users/:id',       getUser);
router.patch('/users/:id',     updateUser);
router.get('/sellers',         listSellers);

export default router;
