import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import * as ctrl from '../controllers/auth.js';

const router = Router();

router.post('/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  validate,
  ctrl.register
);

router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate,
  ctrl.login
);

router.post('/refresh',
  body('refreshToken').notEmpty(),
  validate,
  ctrl.refresh
);

router.post('/logout', ctrl.logout);

router.get('/me', requireAuth, ctrl.me);

export default router;
