import { registerUser, loginUser, getMeUser } from '../services/authService.js';
import { User } from '../models/User.js';

/**
 * Controller to handle citizen registration
 * POST /api/auth/register
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const result = await registerUser({ name, email, password });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to handle user login
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser({ email, password });

    return res.status(200).json({
      success: true,
      message: 'User logged in successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to fetch currently authenticated user profile
 * GET /api/auth/me
 */
export const getMe = async (req, res, next) => {
  try {
    const result = await getMeUser(req.user);

    return res.status(200).json({
      success: true,
      message: 'Authenticated user profile retrieved',
      data: result.user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to update authenticated citizen's own profile
 * PUT /api/auth/profile
 */
export const updateMyProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Whitelist: only these fields may be updated
    const { name, phone, notificationPreferences } = req.body;

    // Build safe update object
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Name must be between 2 and 100 characters long'
        });
      }
      updates.name = name.trim();
    }

    if (phone !== undefined) {
      updates.phone = typeof phone === 'string' ? phone.trim() : phone;
    }

    if (notificationPreferences !== undefined) {
      if (typeof notificationPreferences !== 'object' || notificationPreferences === null) {
        return res.status(400).json({
          success: false,
          message: 'notificationPreferences must be an object'
        });
      }
      // Merge individual preference keys safely (boolean values only)
      const allowedPrefKeys = [
        'emailNotifications', 'complaintStatus', 'slaReminders', 'feedbackReminders',
        'newAssignments', 'slaAlerts', 'escalationAlerts', 'criticalEscalations',
        'departmentAlerts', 'systemAlerts', 'resolutionAlerts'
      ];
      const safePrefs = {};
      for (const key of allowedPrefKeys) {
        if (notificationPreferences[key] !== undefined) {
          safePrefs[`notificationPreferences.${key}`] = Boolean(notificationPreferences[key]);
        }
      }
      Object.assign(updates, safePrefs);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided to update. Allowed: name, phone, notificationPreferences'
      });
    }

    // Disallow sensitive field tampering in body — not reflected in updates but good to guard
    const forbidden = ['role', 'password', 'department', '_id', 'email', 'isActive'];
    for (const field of forbidden) {
      if (req.body[field] !== undefined) {
        return res.status(400).json({
          success: false,
          message: `Field '${field}' cannot be updated through this endpoint`
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true, select: '-password' }
    ).populate('department', 'name code isActive');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser.toSafeObject()
    });
  } catch (error) {
    next(error);
  }
};

export default {
  register,
  login,
  getMe,
  updateMyProfile
};
