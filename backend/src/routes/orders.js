import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireSeller } from '../middleware/auth.js';
import * as ctrl from '../controllers/orders.js';

const router = Router();
router.use(requireAuth);

router.get('/mine',   ctrl.listMyOrders);
router.get('/seller', requireSeller, ctrl.listSellerOrders);

router.get('/:id',           ctrl.getOrder);
router.post('/:id/cancel',   ctrl.cancelOrder);
router.post('/:id/tax',      body('shippingAddressId').notEmpty(), validate, ctrl.applyTax);
router.patch('/:id/status',  requireSeller, body('status').notEmpty(), validate, ctrl.updateOrderStatus);
router.post('/:id/review',
  body('rating').isInt({ min: 1, max: 5 }),
  validate,
  ctrl.addReview
);

export default router;
