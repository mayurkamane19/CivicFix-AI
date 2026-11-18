import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const rawJwtSecret = process.env.JWT_SECRET;

// Enforce strict JWT secret policy in production
if (nodeEnv === 'production' && (!rawJwtSecret || rawJwtSecret.trim().length < 32)) {
  throw new Error(
    'CRITICAL SECURITY CONFIGURATION ERROR: JWT_SECRET must be explicitly defined in production and be at least 32 characters long.'
  );
}

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv,
  corsOrigin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173',
  frontendUrl: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: rawJwtSecret || 'civicfix_jwt_secret_key_development_only_change_in_production_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  jwtAlgorithm: 'HS256',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    isConfigured: Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    )
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    isConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim())
  },
  email: {
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: parseInt(process.env.SMTP_PORT, 10) || 587,
    smtpSecure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1',
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    fromAddress: process.env.EMAIL_FROM || 'notifications@civicfix.city',
    fromName: process.env.EMAIL_FROM_NAME || 'CivicFix AI Alerts',
    isEnabled: process.env.EMAIL_ENABLED === 'true' || process.env.EMAIL_ENABLED === '1',
    isConfigured: Boolean(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    )
  }
};

export default config;
