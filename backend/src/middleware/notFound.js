/**
 * Middleware to handle 404 (Not Found) errors
 */
export const notFound = (req, res, next) => {
  const error = new Error(`Resource not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};
