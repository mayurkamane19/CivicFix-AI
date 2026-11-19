import {
  submitFeedback,
  getFeedbackByComplaint,
  getCitizenFeedback
} from '../services/feedbackService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * Controller: POST /api/feedback/:complaintId
 * Submits citizen rating and optional comment for a resolved complaint.
 * Authenticated citizen must be the verified owner of the complaint.
 */
export const submitComplaintFeedback = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const { rating, comment } = req.body;

    // Authenticated citizen ID strictly derived from JWT session (anti-IDOR)
    const citizenId = req.user._id;

    if (!complaintId || typeof complaintId !== 'string' || complaintId.trim() === '') {
      return errorResponse(res, 400, 'Complaint ID is required');
    }

    if (
      rating === undefined ||
      rating === null ||
      typeof rating !== 'number' ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return errorResponse(res, 400, 'Rating must be an integer between 1 and 5');
    }

    if (comment !== undefined && comment !== null && typeof comment !== 'string') {
      return errorResponse(res, 400, 'Comment must be a text string');
    }

    if (typeof comment === 'string' && comment.trim().length > 500) {
      return errorResponse(res, 400, 'Feedback comment cannot exceed 500 characters');
    }

    const feedback = await submitFeedback(citizenId, complaintId.trim(), {
      rating,
      comment: typeof comment === 'string' ? comment.trim() : ''
    });

    return successResponse(res, 201, 'Feedback submitted successfully', {
      feedback
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/feedback/complaint/:complaintId
 * Retrieves feedback for a specific complaint.
 * Restricted to the verified complaint owner or municipal administrators.
 */
export const getComplaintFeedback = async (req, res, next) => {
  try {
    const { complaintId } = req.params;

    if (!complaintId || typeof complaintId !== 'string' || complaintId.trim() === '') {
      return errorResponse(res, 400, 'Complaint ID is required');
    }

    const requestingUserId = req.user._id;
    const requestingUserRole = req.user.role;

    const feedback = await getFeedbackByComplaint(
      complaintId.trim(),
      requestingUserId,
      requestingUserRole
    );

    if (!feedback) {
      return successResponse(res, 200, 'No feedback found for this complaint', {
        feedback: null
      });
    }

    return successResponse(res, 200, 'Complaint feedback retrieved successfully', {
      feedback
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/feedback/my
 * Retrieves all feedback history submitted by the authenticated citizen.
 */
export const getMyFeedback = async (req, res, next) => {
  try {
    const citizenId = req.user._id;

    const feedbacks = await getCitizenFeedback(citizenId);

    return successResponse(res, 200, 'Citizen feedback history retrieved successfully', {
      feedbacks,
      count: feedbacks.length
    });
  } catch (error) {
    next(error);
  }
};

export default {
  submitComplaintFeedback,
  getComplaintFeedback,
  getMyFeedback
};
