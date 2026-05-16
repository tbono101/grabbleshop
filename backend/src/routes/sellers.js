import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireSeller } from '../middleware/auth.js';
import * as ctrl from '../controllers/sellers.js';

const router = Router();

router.get('/',    ctrl.listSellers);
router.get('/:id', ctrl.getSeller);
router.get('/:id/reviews', ctrl.getSellerReviews);

router.use(requireAuth);

router.post('/',
  body('shopName').trim().isLength({ min: 2, max: 60 }),
  validate,
  ctrl.createSeller
);

router.get('/me/store',   requireSeller, ctrl.getMyStore);
router.patch('/me/store', requireSeller, ctrl.updateSeller);

router.post('/me/stripe/onboard',    requireSeller, ctrl.createStripeOnboardingLink);
router.get('/me/stripe/status',      requireSeller, ctrl.checkStripeStatus);

router.post('/:id/follow',   ctrl.followSeller);
router.delete('/:id/follow', ctrl.unfollowSeller);

export default router;
