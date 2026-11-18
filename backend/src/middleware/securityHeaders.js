/**
 * Security Headers Middleware
 * Sets defensive HTTP headers according to OWASP secure headers best practices
 */
export const securityHeaders = (req, res, next) => {
  // Remove Express fingerprint header
  res.removeHeader('X-Powered-By');

  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking by forbidding embedding in frames or iframes
  res.setHeader('X-Frame-Options', 'DENY');

  // Enable legacy cross-site scripting filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Control referrer information leakage
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Disable cross-domain policy file execution
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // Enforce HSTS in production environments
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
};

export default securityHeaders;
