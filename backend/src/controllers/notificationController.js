import { User } from '../models/User.js';
import { PushSubscription } from '../models/PushSubscription.js';
import {
  getUserNotifications,
  getUserUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  archiveUserNotification,
  clearReadUserNotifications,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  notifySystemAnnouncement,
  getAdminNotificationLogs
} from '../services/notificationService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * Controller: GET /api/notifications
 * Retrieves user's in-app notifications with pagination & filtering
 * Anti-IDOR: strictly isolated to req.user._id
 */
export const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, status, category, search } = req.query;

    const result = await getUserNotifications(req.user._id, {
      page,
      limit,
      status,
      category,
      search
    });

    return successResponse(res, 200, 'Notifications retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/notifications/unread-count
 * Returns unread notification count for the authenticated user
 */
export const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await getUserUnreadCount(req.user._id);
    return successResponse(res, 200, 'Unread notification count retrieved', { unreadCount });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: PATCH /api/notifications/:notificationId/read
 * Marks a single notification as read
 * Strictly enforces user ownership (anti-IDOR)
 */
export const markAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    const notification = await markNotificationAsRead(notificationId, req.user._id);
    if (!notification) {
      return errorResponse(res, 404, 'Notification not found or access denied');
    }

    return successResponse(res, 200, 'Notification marked as read', { notification });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: PATCH /api/notifications/read-all
 * Marks all unread notifications for the user as read
 */
export const markAllAsRead = async (req, res, next) => {
  try {
    const result = await markAllNotificationsAsRead(req.user._id);
    return successResponse(res, 200, 'All notifications marked as read', { count: result.count });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: DELETE /api/notifications/:notificationId
 * Archives (dismisses) a single notification
 * Strictly enforces user ownership (anti-IDOR)
 */
export const deleteNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    const notification = await archiveUserNotification(notificationId, req.user._id);
    if (!notification) {
      return errorResponse(res, 404, 'Notification not found or access denied');
    }

    return successResponse(res, 200, 'Notification dismissed successfully', { notification });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: DELETE /api/notifications/read
 * Clears (archives) all read notifications for the authenticated user
 */
export const clearReadNotifications = async (req, res, next) => {
  try {
    const result = await clearReadUserNotifications(req.user._id);
    return successResponse(res, 200, 'Read notifications cleared successfully', { count: result.count });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/notifications/preferences
 * Retrieves the authenticated user's notification preferences
 */
export const getPreferences = async (req, res, next) => {
  try {
    const preferences = await getUserNotificationPreferences(req.user._id);
    if (!preferences) {
      return errorResponse(res, 404, 'User profile not found');
    }

    return successResponse(res, 200, 'Notification preferences retrieved successfully', preferences);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: PATCH /api/notifications/preferences
 * Updates the authenticated user's notification preferences
 * Strictly scoped to req.user._id (anti-IDOR)
 */
export const updatePreferences = async (req, res, next) => {
  try {
    const body = req.body || {};

    // Validate legacy format if provided alone
    if (
      body.emailNotificationsEnabled !== undefined &&
      typeof body.emailNotificationsEnabled !== 'boolean'
    ) {
      return errorResponse(
        res,
        400,
        'Invalid input: emailNotificationsEnabled must be a boolean (true or false)'
      );
    }

    const updated = await updateUserNotificationPreferences(req.user._id, body);
    if (!updated) {
      return errorResponse(res, 404, 'User profile not found');
    }

    return successResponse(res, 200, 'Notification preferences updated successfully', updated);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: POST /api/notifications/announcement
 * Broadcasts a system announcement (Administrator only)
 */
export const broadcastAnnouncement = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return errorResponse(res, 403, 'Forbidden: Administrative privilege required to broadcast announcements');
    }

    const { title, message, priority, targetRole, actionUrl } = req.body;
    if (!title || !message) {
      return errorResponse(res, 400, 'Title and message are required for system announcements');
    }

    const results = await notifySystemAnnouncement({
      title,
      message,
      priority: priority || 'Medium',
      targetRole: targetRole || 'all',
      actionUrl: actionUrl || null,
      adminUser: req.user
    });

    return successResponse(res, 201, 'System announcement broadcast successfully', {
      recipientCount: results.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/notifications
 * Administrative monitoring of notification delivery logs
 */
export const getAdminNotifications = async (req, res, next) => {
  try {
    const { status, eventType, complaintId, page, limit } = req.query;

    const data = await getAdminNotificationLogs({
      status,
      eventType,
      complaintId,
      page,
      limit
    });

    return successResponse(res, 200, 'Notification audit logs retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/notifications/push/public-key
 * Returns VAPID public key for Web Push subscription
 */
export const getPushPublicKey = async (req, res, next) => {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZElO7BpwtGN_4v89zN83v_5N1xXp29eJ7wF9K0';
    return successResponse(res, 200, 'VAPID public key retrieved successfully', { publicKey });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: POST /api/notifications/push/subscribe
 * Registers or updates a browser Web Push subscription for authenticated user
 */
export const subscribePush = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { endpoint, keys, userAgent } = req.body;

    if (!endpoint || typeof endpoint !== 'string' || !endpoint.startsWith('http')) {
      return errorResponse(res, 400, 'Valid push subscription endpoint URL is required');
    }

    if (!keys || typeof keys !== 'object' || !keys.p256dh || !keys.auth) {
      return errorResponse(res, 400, 'Push keys with valid p256dh and auth components are required');
    }

    const subscription = await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        user: userId,
        endpoint,
        keys: {
          p256dh: String(keys.p256dh).trim(),
          auth: String(keys.auth).trim()
        },
        userAgent: userAgent ? String(userAgent).slice(0, 500) : ''
      },
      { upsert: true, new: true, runValidators: true }
    );

    return successResponse(res, 201, 'Push notification subscription registered successfully', {
      subscriptionId: subscription._id
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: POST /api/notifications/push/unsubscribe
 * Removes browser push subscription belonging to the authenticated user (anti-IDOR)
 */
export const unsubscribePush = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { endpoint } = req.body;

    if (!endpoint || typeof endpoint !== 'string') {
      return errorResponse(res, 400, 'Subscription endpoint is required to unsubscribe');
    }

    const result = await PushSubscription.findOneAndDelete({
      endpoint,
      user: userId
    });

    if (!result) {
      return successResponse(res, 200, 'Subscription already removed or not found', { unsubscribed: true });
    }

    return successResponse(res, 200, 'Push notification subscription removed successfully', { unsubscribed: true });
  } catch (error) {
    next(error);
  }
};

export default {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
  getPreferences,
  updatePreferences,
  broadcastAnnouncement,
  getAdminNotifications,
  getPushPublicKey,
  subscribePush,
  unsubscribePush
};
