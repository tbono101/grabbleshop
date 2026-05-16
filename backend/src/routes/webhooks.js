import { Router } from 'express';
import * as ctrl from '../controllers/webhooks.js';

const router = Router();

// Raw body required for Stripe signature verification — mounted before express.json()
router.post('/stripe', ctrl.handleStripe);
router.post('/easypost', ctrl.handleEasyPost);

export default router;
