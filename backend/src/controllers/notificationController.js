import { User } from '../models/User.js';
import { getAdminNotificationLogs } from '../services/notificationService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * Controller: GET /api/notifications/preferences
 * Retrieves the authenticated user's notification preferences
 */
export const getPreferences = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('email emailNotificationsEnabled');
    if (!user) {
      return errorResponse(res, 404, 'User profile not found');
    }

    return successResponse(res, 200, 'Notification preferences retrieved successfully', {
      email: user.email,
      emailNotificationsEnabled: Boolean(user.emailNotificationsEnabled)
    });
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
    const { emailNotificationsEnabled } = req.body;

    if (typeof emailNotificationsEnabled !== 'boolean') {
      return errorResponse(
        res,
        400,
        'Invalid input: emailNotificationsEnabled must be a boolean (true or false)'
      );
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { emailNotificationsEnabled },
      { new: true }
    ).select('email emailNotificationsEnabled');

    if (!updatedUser) {
      return errorResponse(res, 404, 'User profile not found');
    }

    return successResponse(res, 200, 'Notification preferences updated successfully', {
      email: updatedUser.email,
      emailNotificationsEnabled: updatedUser.emailNotificationsEnabled
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

export default {
  getPreferences,
  updatePreferences,
  getAdminNotifications
};
