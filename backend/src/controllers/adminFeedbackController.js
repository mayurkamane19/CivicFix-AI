import {
  getFeedbackForAdmin,
  getFeedbackStatsForAdmin
} from '../services/feedbackService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * Controller: GET /api/admin/feedback
 * Retrieves paginated, filtered feedback records for administrative inspection.
 * Restricted to authenticated administrators.
 */
export const getAdminFeedbackList = async (req, res, next) => {
  try {
    const { page, limit, rating, search } = req.query;

    const result = await getFeedbackForAdmin({
      page,
      limit,
      rating,
      search
    });

    return successResponse(res, 200, 'Admin feedback records retrieved successfully', {
      feedbacks: result.feedbacks,
      pagination: result.pagination,
      data: {
        feedbacks: result.feedbacks,
        pagination: result.pagination
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/feedback/stats
 * Retrieves aggregated citizen feedback metrics and rating distribution.
 * Restricted to authenticated administrators.
 */
export const getAdminFeedbackStats = async (req, res, next) => {
  try {
    const stats = await getFeedbackStatsForAdmin();

    return successResponse(res, 200, 'Admin feedback statistics retrieved successfully', {
      stats,
      totalFeedback: stats.totalFeedback,
      averageRating: stats.averageRating,
      ratingDistribution: stats.ratingDistribution,
      data: {
        stats,
        totalFeedback: stats.totalFeedback,
        averageRating: stats.averageRating,
        ratingDistribution: stats.ratingDistribution
      }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getAdminFeedbackList,
  getAdminFeedbackStats
};
