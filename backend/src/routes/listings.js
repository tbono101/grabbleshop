import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireSeller } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import * as ctrl from '../controllers/listings.js';

const router = Router();

router.get('/:id', ctrl.getListing);

router.use(requireAuth);

router.post('/',
  requireSeller,
  body('eventId').notEmpty(),
  body('title').trim().isLength({ min: 2, max: 200 }),
  body('startingPrice').isFloat({ min: 0.01 }),
  validate,
  ctrl.createListing
);

router.patch('/:id',                    requireSeller, ctrl.updateListing);
router.delete('/:id',                   requireSeller, ctrl.deleteListing);
router.post('/:id/activate',            requireSeller, ctrl.activateListing);
router.post('/:id/deactivate',          requireSeller, ctrl.deactivateListing);
router.post('/:id/generate-description', requireSeller, ctrl.generateDescription);
router.post('/:id/images',              requireSeller, upload.array('images', 10), ctrl.uploadImages);
router.delete('/:id/images/:imageId',   requireSeller, ctrl.deleteImage);

export default router;
