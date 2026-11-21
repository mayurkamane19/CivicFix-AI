import { Router } from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
  getPreferences,
  updatePreferences,
  broadcastAnnouncement,
  getPushPublicKey,
  subscribePush,
  unsubscribePush
} from '../controllers/notificationController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = Router();

// All notification routes require authenticated user session
router.use(protect);

// 1. User Notification Preferences (Preserves Phase 13 paths)
router.get('/preferences', getPreferences);
router.patch('/preferences', updatePreferences);

// 2. Web Push Notification Infrastructure (Phase 21 PWA)
router.get('/push/public-key', getPushPublicKey);
router.post('/push/subscribe', subscribePush);
router.post('/push/unsubscribe', unsubscribePush);

// 3. Unread Count for Real-Time Polling Badge
router.get('/unread-count', getUnreadCount);

// 4. Batch Read Actions
router.patch('/read-all', markAllAsRead);

// 5. Batch Clear Read Actions (MUST BE DEFINED BEFORE /:notificationId to avoid route capture)
router.delete('/read', clearReadNotifications);

// 6. Paginated User Notification List
router.get('/', getNotifications);

// 7. Single Notification State Actions
router.patch('/:notificationId/read', markAsRead);
router.delete('/:notificationId', deleteNotification);

// 8. Municipal Admin Broadcast Announcement
router.post('/announcement', authorize('admin'), broadcastAnnouncement);

export default router;
