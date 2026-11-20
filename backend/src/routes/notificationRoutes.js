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
  broadcastAnnouncement
} from '../controllers/notificationController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = Router();

// All notification routes require authenticated user session
router.use(protect);

// 1. User Notification Preferences (Preserves Phase 13 paths)
router.get('/preferences', getPreferences);
router.patch('/preferences', updatePreferences);

// 2. Unread Count for Real-Time Polling Badge
router.get('/unread-count', getUnreadCount);

// 3. Batch Read Actions
router.patch('/read-all', markAllAsRead);

// 4. Batch Clear Read Actions (MUST BE DEFINED BEFORE /:notificationId to avoid route capture)
router.delete('/read', clearReadNotifications);

// 5. Paginated User Notification List
router.get('/', getNotifications);

// 6. Single Notification State Actions
router.patch('/:notificationId/read', markAsRead);
router.delete('/:notificationId', deleteNotification);

// 7. Municipal Admin Broadcast Announcement
router.post('/announcement', authorize('admin'), broadcastAnnouncement);

export default router;
