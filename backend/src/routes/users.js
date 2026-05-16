import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import * as ctrl from '../controllers/users.js';

const router = Router();
router.use(requireAuth);

router.get('/me',           ctrl.getProfile);
router.patch('/me',         body('firstName').optional().trim().notEmpty(), validate, ctrl.updateProfile);
router.get('/me/orders',    ctrl.getMyOrders);
router.get('/me/following', ctrl.getMyFollows);

router.get('/me/addresses',       ctrl.listAddresses);
router.post('/me/addresses',
  body('line1').trim().notEmpty(),
  body('city').trim().notEmpty(),
  body('state').trim().notEmpty(),
  body('zip').trim().notEmpty(),
  validate,
  ctrl.createAddress
);
router.patch('/me/addresses/:id',         ctrl.updateAddress);
router.delete('/me/addresses/:id',        ctrl.deleteAddress);
router.post('/me/addresses/:id/default',  ctrl.setDefaultAddress);

export default router;
