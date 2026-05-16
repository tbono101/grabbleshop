import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireSeller } from '../middleware/auth.js';
import * as ctrl from '../controllers/events.js';

const router = Router();

router.get('/',    ctrl.listEvents);
router.get('/:id', ctrl.getEvent);
router.get('/:id/listings', ctrl.getEventListings);

router.use(requireAuth, requireSeller);

router.post('/',
  body('title').trim().isLength({ min: 3, max: 120 }),
  validate,
  ctrl.createEvent
);
router.patch('/:id',          ctrl.updateEvent);
router.delete('/:id',         ctrl.deleteEvent);
router.post('/:id/start',     ctrl.startEvent);
router.post('/:id/end',       ctrl.endEvent);
router.post('/:id/cancel',    ctrl.cancelEvent);

export default router;
