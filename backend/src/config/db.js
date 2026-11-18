import mongoose from 'mongoose';
import { config } from './env.js';

/**
 * Helper to mask sensitive credentials in MongoDB URI for safe logging
 * @param {string} uri - Raw connection string
 * @returns {string} Sanitized string
 */
const sanitizeMongoUri = (uri) => {
  if (!uri) return '';
  return uri.replace(/\/\/(.*?)@/, '//***:***@');
};

/**
 * Connects to MongoDB asynchronously using Mongoose.
 * Supports both local MongoDB and MongoDB Atlas connection strings.
 * Gracefully handles missing configuration or connection errors.
 * 
 * @returns {Promise<typeof mongoose | null>}
 */
export const connectDB = async () => {
  const mongoUri = config.mongoUri || process.env.MONGODB_URI;

  if (!mongoUri || mongoUri.trim() === '') {
    console.warn('[Database] MONGODB_URI is not configured in .env. Server will run with database in disconnected state.');
    return null;
  }

  try {
    // Configure event listeners once
    mongoose.connection.on('disconnected', () => {
      console.warn('[Database] MongoDB connection lost (disconnected).');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('[Database] MongoDB connection restored (reconnected).');
    });

    mongoose.connection.on('error', (err) => {
      console.error('[Database] MongoDB connection runtime error:', err.message);
    });

    const sanitized = sanitizeMongoUri(mongoUri);
    console.log(`[Database] Attempting connection to MongoDB (${sanitized})...`);

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000 // Timeout after 5s if server unreachable
    });

    console.log(`[Database] MongoDB Connected Successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[Database] MongoDB Connection Error: ${error.message}`);
    // Do not throw: allow Express server to start and respond with database disconnected
    return null;
  }
};

/**
 * Returns the current database connection state.
 * @returns {'connected' | 'disconnected'}
 */
export const getDatabaseStatus = () => {
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
};

export default connectDB;
