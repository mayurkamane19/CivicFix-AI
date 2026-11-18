import { config } from '../config/env.js';

/**
 * Centralized error handling middleware with security sanitization
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // 1. Handle JSON syntax errors from body-parser
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON payload in request body';
  }

  // 2. Handle Mongoose Validation Errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors || {}).map((e) => e.message);
    message = errors.length > 0 ? errors.join(', ') : 'Database validation failed';
  }

  // 3. Handle Mongoose CastError (e.g. invalid ObjectId format)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for resource identifier '${err.path || 'id'}'`;
  }

  // 4. Handle MongoDB Duplicate Key (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    const duplicateField = Object.keys(err.keyPattern || {})[0] || 'field';
    message = `A record with this ${duplicateField} already exists`;
  }

  // 5. Handle JWT verification errors that bubble up
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired. Please log in again.';
  }

  // Log server errors for internal operations visibility (excluding tests)
  if (config.nodeEnv !== 'test' && statusCode >= 500) {
    console.error(`[Server Error] ${req.method} ${req.originalUrl}:`, err);
  }

  // In production, sanitize unexpected 500 error messages to prevent internal leakage
  if (config.nodeEnv === 'production' && statusCode === 500) {
    message = 'An unexpected internal server error occurred';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  });
};

export default errorHandler;
