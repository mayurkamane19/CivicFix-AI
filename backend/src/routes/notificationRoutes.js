import { Router } from 'express';
import {
  getPreferences,
  updatePreferences
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

// User notification preferences (protected)
router.get('/preferences', protect, getPreferences);
router.patch('/preferences', protect, updatePreferences);

export default router;
