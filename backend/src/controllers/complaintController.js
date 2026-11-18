import {
  createComplaint,
  getComplaintByTrackId,
  analyzeComplaintById,
  checkDuplicatesById
} from '../services/complaintService.js';
import { getPublicMapComplaints } from '../services/mapService.js';
import { successResponse } from '../utils/apiResponse.js';

/**
 * Controller to handle new complaint submission
 * POST /api/complaints
 */
export const submitComplaint = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      address,
      latitude,
      longitude,
      imageUrl,
      citizenEmail,
      emailNotificationsEnabled
    } = req.body;

    const authenticatedUser = req.user || null;
    const finalCitizenEmail = citizenEmail || (authenticatedUser ? authenticatedUser.email : null);
    const finalConsent = emailNotificationsEnabled === true ||
      emailNotificationsEnabled === 'true' ||
      (authenticatedUser && authenticatedUser.emailNotificationsEnabled === true && emailNotificationsEnabled !== false && emailNotificationsEnabled !== 'false');

    const result = await createComplaint({
      title,
      description,
      category,
      address,
      latitude,
      longitude,
      file: req.file,
      imageUrl,
      citizenEmail: finalCitizenEmail,
      emailNotificationsEnabled: finalConsent,
      reportedBy: authenticatedUser?._id || null
    });

    return res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to handle public complaint tracking
 * GET /api/complaints/track/:complaintId
 */
export const trackComplaint = async (req, res, next) => {
  try {
    const { complaintId } = req.params;

    const result = await getComplaintByTrackId(complaintId);

    return res.status(200).json({
      success: true,
      message: 'Complaint details retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to trigger or retrieve AI analysis for a complaint
 * POST /api/complaints/:complaintId/analyze
 */
export const analyzeComplaint = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const { force } = req.body || {};

    const result = await analyzeComplaintById(complaintId, { force: Boolean(force) });

    return res.status(200).json({
      success: true,
      message: result.message,
      cached: Boolean(result.cached),
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to trigger or retrieve duplicate detection for a complaint
 * POST /api/complaints/:complaintId/check-duplicates
 */
export const checkDuplicates = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const { force } = req.body || {};

    const result = await checkDuplicatesById(complaintId, { force: Boolean(force) });

    return res.status(200).json({
      success: true,
      message: result.message,
      cached: Boolean(result.cached),
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to retrieve public-safe complaint markers with location approximation
 * GET /api/complaints/map
 */
export const getPublicMap = async (req, res, next) => {
  try {
    const { category, status, limit } = req.query;
    const mapData = await getPublicMapComplaints({ category, status, limit });

    return successResponse(res, 200, 'Public complaint map markers retrieved successfully', {
      complaints: mapData,
      total: mapData.length
    });
  } catch (error) {
    next(error);
  }
};

export default {
  submitComplaint,
  trackComplaint,
  analyzeComplaint,
  checkDuplicates,
  getPublicMap
};
