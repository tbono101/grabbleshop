import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireSeller } from '../middleware/auth.js';
import * as ctrl from '../controllers/payments.js';

const router = Router();
router.use(requireAuth);

router.post('/checkout',
  body('orderId').notEmpty(),
  validate,
  ctrl.createCheckoutSession
);

router.get('/status/:orderId', ctrl.getPaymentStatus);

router.get('/seller/dashboard', requireSeller, ctrl.createSellerDashboardLink);

export default router;
