import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireSeller } from '../middleware/auth.js';
import * as ctrl from '../controllers/claims.js';

const router = Router();
router.use(requireAuth);

router.get('/mine', ctrl.getMyClaims);

router.post('/',
  body('listingId').notEmpty(),
  validate,
  ctrl.createClaim
);

router.post('/:id/release', ctrl.releaseClaim);

router.post('/:id/confirm',
  requireSeller,
  ctrl.confirmClaim
);

router.get('/event/:eventId', requireSeller, ctrl.getEventClaims);

export default router;
