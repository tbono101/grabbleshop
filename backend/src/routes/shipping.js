import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireSeller } from '../middleware/auth.js';
import * as ctrl from '../controllers/shipping.js';

const router = Router();
router.use(requireAuth);

router.post('/:orderId/rates',
  requireSeller,
  body('weight').optional().isFloat({ min: 0.1 }),
  validate,
  ctrl.getRates
);

router.post('/:orderId/label',
  requireSeller,
  body('rateId').notEmpty(),
  validate,
  ctrl.createLabel
);

router.get('/:orderId/tracking', ctrl.getTracking);

export default router;
