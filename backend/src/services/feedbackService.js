import mongoose from 'mongoose';
import { Feedback } from '../models/Feedback.js';
import { Complaint } from '../models/Complaint.js';
import { getDatabaseStatus } from '../config/db.js';

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

export default {
  submitFeedback,
  getFeedbackByComplaint,
  getCitizenFeedback
};
