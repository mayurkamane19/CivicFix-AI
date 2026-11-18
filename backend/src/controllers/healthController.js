import { getHealthData } from '../services/healthService.js';

/**
 * Controller to handle health check endpoint
 * GET /api/health
 */
export const getHealth = (req, res, next) => {
  try {
    const healthStatus = getHealthData();
    return res.status(200).json(healthStatus);
  } catch (error) {
    next(error);
  }
};
