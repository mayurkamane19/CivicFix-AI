import mongoose from 'mongoose';
import { verifyToken } from '../utils/jwt.js';
import { User } from '../models/User.js';

/**
 * Protect routes: Authenticates incoming request using JWT Bearer token
 * Enforces algorithm check, expiration, active account check, and clean error messages.
 */
export const protect = async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token || typeof token !== 'string' || token.trim() === '') {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.'
    });
  }

  try {
    // Verify token using centralized utility with strict algorithm verification
    const decoded = verifyToken(token.trim());

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token payload.'
      });
    }

    // Validate ID format before querying MongoDB
    if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token identity.'
      });
    }

    // Fetch user from database excluding password and populate department
    const user = await User.findById(decoded.id)
      .select('-password')
      .populate('department', 'name code isActive');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact municipal administrator.'
      });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication token has expired. Please log in again.'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token.'
    });
  }
};

/**
 * Role-based authorization middleware
 * @param  {...string} roles - Permitted roles (e.g. 'admin')
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: User role '${req.user?.role || 'unknown'}' is not authorized to access this resource.`
      });
    }
    next();
  };
};

export default {
  protect,
  authorize
};
