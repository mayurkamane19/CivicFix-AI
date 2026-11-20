import mongoose from 'mongoose';
import { Feedback } from '../models/Feedback.js';
import { Complaint } from '../models/Complaint.js';
import { getDatabaseStatus } from '../config/db.js';
import { notifyFeedbackReceived } from './notificationService.js';

/**
 * Helper to check database availability
 */
const assertDatabaseConnected = () => {
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }
};

/**
 * Service: Submits citizen rating and comment for a resolved complaint.
 * @param {string|mongoose.Types.ObjectId} citizenId - Authenticated citizen's User ID
 * @param {string} complaintIdentifier - Complaint MongoDB _id or public complaintId (CFX-...)
 * @param {object} feedbackData
 * @param {number} feedbackData.rating - Integer rating from 1 to 5
 * @param {string} [feedbackData.comment=''] - Optional comment (max 500 chars)
 * @returns {Promise<object>} Safe feedback object
 */
export const submitFeedback = async (citizenId, complaintIdentifier, { rating, comment = '' } = {}) => {
  assertDatabaseConnected();

  if (!citizenId) {
    const error = new Error('Authentication required to submit feedback');
    error.statusCode = 401;
    throw error;
  }

  if (!complaintIdentifier || typeof complaintIdentifier !== 'string' || complaintIdentifier.trim() === '') {
    const error = new Error('Valid complaint identifier is required');
    error.statusCode = 400;
    throw error;
  }

  const trimmedIdentifier = complaintIdentifier.trim();

  // 1. Locate Complaint by ObjectId or CFX ticket ID
  let complaint = null;
  if (mongoose.Types.ObjectId.isValid(trimmedIdentifier)) {
    complaint = await Complaint.findById(trimmedIdentifier);
  }
  if (!complaint) {
    complaint = await Complaint.findOne({ complaintId: trimmedIdentifier });
  }

  if (!complaint) {
    const error = new Error('Complaint not found with this identifier');
    error.statusCode = 404;
    throw error;
  }

  // 2. Validate Complaint Status: Must be 'Resolved'
  if (complaint.status !== 'Resolved') {
    const error = new Error(
      `Feedback can only be submitted for resolved complaints. Current status: '${complaint.status}'`
    );
    error.statusCode = 400;
    throw error;
  }

  // 3. Authorization: Only the citizen who reported the complaint can submit feedback
  if (!complaint.reportedBy) {
    const error = new Error('Feedback cannot be submitted for guest complaints without registered ownership');
    error.statusCode = 403;
    throw error;
  }

  const reportedById = complaint.reportedBy._id
    ? complaint.reportedBy._id.toString()
    : complaint.reportedBy.toString();

  if (reportedById !== citizenId.toString()) {
    const error = new Error('You are not authorized to submit feedback for this complaint');
    error.statusCode = 403;
    throw error;
  }

  // 4. Validate Rating: Must be integer between 1 and 5
  if (
    rating === undefined ||
    rating === null ||
    typeof rating !== 'number' ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    const error = new Error('Rating must be an integer between 1 and 5');
    error.statusCode = 400;
    throw error;
  }

  // 5. Validate Comment: Optional string up to 500 characters
  let trimmedComment = '';
  if (comment !== undefined && comment !== null && comment !== '') {
    if (typeof comment !== 'string') {
      const error = new Error('Feedback comment must be text');
      error.statusCode = 400;
      throw error;
    }
    trimmedComment = comment.trim();
    if (trimmedComment.length > 500) {
      const error = new Error('Feedback comment cannot exceed 500 characters');
      error.statusCode = 400;
      throw error;
    }
  }

  // 6. Check Duplicate Feedback (One feedback per complaint)
  const existingFeedback = await Feedback.findOne({ complaint: complaint._id });
  if (existingFeedback) {
    const error = new Error('Feedback has already been submitted for this complaint');
    error.statusCode = 400;
    throw error;
  }

  // 7. Persist Feedback
  try {
    const feedback = new Feedback({
      complaint: complaint._id,
      citizen: citizenId,
      rating,
      comment: trimmedComment
    });

    await feedback.save();

    // Trigger non-blocking feedback notification for officer and admin
    try {
      notifyFeedbackReceived({ complaint, feedback, citizenId }).catch((err) => {
        console.warn('[Notification] Failed to dispatch feedback notification:', err.message);
      });
    } catch (_) {}

    return feedback.toSafeObject();
  } catch (err) {
    if (err.code === 11000) {
      const error = new Error('Feedback has already been submitted for this complaint');
      error.statusCode = 400;
      throw error;
    }
    throw err;
  }
};

/**
 * Service: Retrieves feedback for a specific complaint.
 * Restricted to the complaint owner or administrators.
 * @param {string} complaintIdentifier - Complaint MongoDB _id or complaintId
 * @param {string|mongoose.Types.ObjectId} requestingUserId - ID of authenticated user
 * @param {string} [requestingUserRole='citizen'] - Role of authenticated user
 * @returns {Promise<object|null>} Safe feedback object or null if none exists
 */
export const getFeedbackByComplaint = async (
  complaintIdentifier,
  requestingUserId,
  requestingUserRole = 'citizen'
) => {
  assertDatabaseConnected();

  if (!complaintIdentifier || typeof complaintIdentifier !== 'string' || complaintIdentifier.trim() === '') {
    const error = new Error('Valid complaint identifier is required');
    error.statusCode = 400;
    throw error;
  }

  const trimmedIdentifier = complaintIdentifier.trim();

  let complaint = null;
  if (mongoose.Types.ObjectId.isValid(trimmedIdentifier)) {
    complaint = await Complaint.findById(trimmedIdentifier);
  }
  if (!complaint) {
    complaint = await Complaint.findOne({ complaintId: trimmedIdentifier });
  }

  if (!complaint) {
    const error = new Error('Complaint not found with this identifier');
    error.statusCode = 404;
    throw error;
  }

  // Authorization check: Only complaint owner or admin can retrieve feedback
  if (requestingUserRole !== 'admin') {
    if (!complaint.reportedBy || complaint.reportedBy.toString() !== requestingUserId.toString()) {
      const error = new Error('You are not authorized to view feedback for this complaint');
      error.statusCode = 403;
      throw error;
    }
  }

  const feedback = await Feedback.findOne({ complaint: complaint._id });
  return feedback ? feedback.toSafeObject() : null;
};

/**
 * Service: Retrieves all feedback submitted by the authenticated citizen.
 * @param {string|mongoose.Types.ObjectId} citizenId - ID of authenticated citizen
 * @returns {Promise<Array<object>>} List of feedback records with complaint details
 */
export const getCitizenFeedback = async (citizenId) => {
  assertDatabaseConnected();

  if (!citizenId) {
    const error = new Error('Authentication required to retrieve citizen feedback');
    error.statusCode = 401;
    throw error;
  }

  const feedbacks = await Feedback.find({ citizen: citizenId })
    .sort({ createdAt: -1 })
    .populate('complaint', 'complaintId title category status');

  return feedbacks.map((f) => ({
    ...f.toSafeObject(),
    complaintId: f.complaint?.complaintId || undefined,
    complaintTitle: f.complaint?.title || undefined,
    complaintCategory: f.complaint?.category || undefined,
    complaintStatus: f.complaint?.status || undefined
  }));
};

/**
 * Service: Retrieves paginated and filtered feedback records for administrative audit.
 * Restricted to municipal administrators.
 * @param {object} queryOptions
 * @param {number|string} [queryOptions.page=1]
 * @param {number|string} [queryOptions.limit=10]
 * @param {number|string} [queryOptions.rating] - Optional rating filter (1-5)
 * @param {string} [queryOptions.search=''] - Search by complaint ticket ID
 * @returns {Promise<{feedbacks: Array<object>, pagination: object}>}
 */
export const getFeedbackForAdmin = async ({
  page = 1,
  limit = 10,
  rating,
  search = ''
} = {}) => {
  assertDatabaseConnected();

  const pageNum = parseInt(page, 10);
  if (isNaN(pageNum) || pageNum < 1) {
    const error = new Error('Page must be a positive integer');
    error.statusCode = 400;
    throw error;
  }

  const limitNum = parseInt(limit, 10);
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    const error = new Error('Limit must be an integer between 1 and 100');
    error.statusCode = 400;
    throw error;
  }

  const filterQuery = {};

  // Rating Filter (1-5)
  if (rating !== undefined && rating !== null && rating !== '' && rating !== 'all') {
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      const error = new Error('Rating filter must be an integer between 1 and 5');
      error.statusCode = 400;
      throw error;
    }
    filterQuery.rating = ratingNum;
  }

  // Complaint ID Search
  if (search && typeof search === 'string' && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim(), 'i');
    const matchedComplaints = await Complaint.find({
      complaintId: searchRegex
    }).select('_id');

    filterQuery.complaint = { $in: matchedComplaints.map((c) => c._id) };
  }

  const skip = (pageNum - 1) * limitNum;

  const [total, feedbacksRaw] = await Promise.all([
    Feedback.countDocuments(filterQuery),
    Feedback.find(filterQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('complaint', 'complaintId title category status location')
      .populate('citizen', 'name')
  ]);

  const totalPages = Math.ceil(total / limitNum) || 1;

  const feedbacks = feedbacksRaw.map((f) => ({
    id: f._id ? f._id.toString() : undefined,
    rating: f.rating,
    comment: f.comment || '',
    createdAt: f.createdAt,
    complaintId: f.complaint?.complaintId || null,
    complaintTitle: f.complaint?.title || null,
    complaintCategory: f.complaint?.category || null,
    complaintStatus: f.complaint?.status || null,
    citizenName: f.citizen?.name || 'Verified Citizen'
  }));

  return {
    feedbacks,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1
    }
  };
};

/**
 * Service: Calculates aggregate satisfaction statistics and rating distribution for admin dashboard.
 * @returns {Promise<{totalFeedback: number, averageRating: number, ratingDistribution: object}>}
 */
export const getFeedbackStatsForAdmin = async () => {
  assertDatabaseConnected();

  let totalFeedback = 0;
  let averageRating = 0;
  const ratingDistribution = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0
  };

  // Primary: Fast MongoDB aggregation pipeline
  if (typeof Feedback.aggregate === 'function') {
    try {
      const [statsAgg, distAgg] = await Promise.all([
        Feedback.aggregate([
          {
            $group: {
              _id: null,
              totalFeedback: { $sum: 1 },
              avgRating: { $avg: '$rating' }
            }
          }
        ]),
        Feedback.aggregate([
          {
            $group: {
              _id: '$rating',
              count: { $sum: 1 }
            }
          }
        ])
      ]);

      if (Array.isArray(statsAgg) && statsAgg.length > 0) {
        totalFeedback = statsAgg[0].totalFeedback || 0;
        const rawAvg = statsAgg[0].avgRating || 0;
        averageRating = totalFeedback > 0 ? Math.round(rawAvg * 10) / 10 : 0;
      }

      if (Array.isArray(distAgg)) {
        for (const item of distAgg) {
          if (item && item._id >= 1 && item._id <= 5) {
            ratingDistribution[item._id] = item.count;
          }
        }
      }

      return {
        totalFeedback,
        averageRating,
        ratingDistribution
      };
    } catch {
      // In-memory or testing mock fallback
    }
  }

  // Fallback if aggregate is not supported by mock environment
  const allFeedbacks = await Feedback.find({});
  totalFeedback = allFeedbacks.length;
  if (totalFeedback > 0) {
    const sum = allFeedbacks.reduce((acc, f) => acc + (f.rating || 0), 0);
    averageRating = Math.round((sum / totalFeedback) * 10) / 10;
    for (const f of allFeedbacks) {
      if (f.rating >= 1 && f.rating <= 5) {
        ratingDistribution[f.rating] = (ratingDistribution[f.rating] || 0) + 1;
      }
    }
  }

  return {
    totalFeedback,
    averageRating,
    ratingDistribution
  };
};

export default {
  submitFeedback,
  getFeedbackByComplaint,
  getCitizenFeedback,
  getFeedbackForAdmin,
  getFeedbackStatsForAdmin
};
