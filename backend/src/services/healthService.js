import { getDatabaseStatus } from '../config/db.js';

/**
 * Service to handle health check operations
 * Reports server health and live MongoDB connection state.
 */
export const getHealthData = () => {
  return {
    success: true,
    message: 'CivicFix AI backend is running',
    status: 'healthy',
    database: getDatabaseStatus()
  };
};
