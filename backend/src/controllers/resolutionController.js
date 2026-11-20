import {
  getOfficerWorkspace,
  getResolutionEvidence,
  uploadResolutionEvidenceImages,
  submitOfficerResolution,
  verifyResolutionByCitizen,
  rejectResolutionByCitizen,
  reviewResolutionByAdmin,
  getAdminResolutionsList,
  getAdminResolutionStats,
  getOfficerPerformanceAnalytics
} from '../services/resolutionService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * Controller: GET /api/officer/workspace
 * Retrieves field officer priority workspace queue with urgency metrics and SLA countdowns
 */
export const getOfficerWorkspaceController = async (req, res, next) => {
  try {
    const result = await getOfficerWorkspace(req.user._id, req.query);
    return res.status(200).json({
      success: true,
      message: 'Officer workspace data retrieved successfully',
      metrics: result.metrics,
      complaints: result.complaints,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/officer/complaints/:complaintId/resolution or /api/complaints/:complaintId/resolution
 * Retrieves resolution evidence details with anti-IDOR role authorization
 */
export const getResolutionEvidenceController = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const evidence = await getResolutionEvidence(complaintId, req.user);
    return successResponse(res, 200, 'Resolution evidence retrieved successfully', {
      resolution: evidence
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: POST /api/officer/complaints/:complaintId/resolution/evidence
 * Uploads resolution evidence photos (before/after) for an assigned complaint
 */
export const uploadEvidenceController = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const { type = 'after', caption = '' } = req.body;

    // Normalize files from multer (either array or fields)
    let files = [];
    if (Array.isArray(req.files)) {
      files = req.files;
    } else if (req.files && typeof req.files === 'object') {
      files = [
        ...(req.files.images || []),
        ...(req.files.afterImages || []),
        ...(req.files.beforeImages || []),
        ...(req.files.evidenceImages || [])
      ];
    } else if (req.file) {
      files = [req.file];
    }

    const result = await uploadResolutionEvidenceImages(req.user._id, complaintId, files, {
      type,
      caption
    });

    return successResponse(res, 200, 'Evidence photos uploaded successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: POST /api/officer/complaints/:complaintId/resolution/submit
 * Submits resolution remarks and evidence, marking complaint 'Resolved' awaiting citizen confirmation
 */
export const submitResolutionController = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const { remarks, caption } = req.body;

    let afterFiles = [];
    let beforeFiles = [];

    if (req.files && typeof req.files === 'object' && !Array.isArray(req.files)) {
      afterFiles = req.files.afterImages || req.files.images || [];
      beforeFiles = req.files.beforeImages || [];
    } else if (Array.isArray(req.files)) {
      afterFiles = req.files;
    } else if (req.file) {
      afterFiles = [req.file];
    }

    const complaint = await submitOfficerResolution(req.user._id, complaintId, {
      remarks,
      afterFiles,
      beforeFiles,
      caption,
      officerUser: req.user
    });

    return successResponse(res, 200, 'Resolution evidence submitted successfully. Awaiting citizen verification.', {
      complaint: complaint.toPublicJSON ? complaint.toPublicJSON() : complaint
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: POST /api/complaints/:complaintId/resolution/verify
 * Citizen verifies and confirms complaint resolution
 */
export const verifyResolutionController = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const result = await verifyResolutionByCitizen(req.user._id, complaintId, {
      citizenUser: req.user
    });
    return successResponse(res, 200, result.message, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: POST /api/complaints/:complaintId/resolution/reject
 * Citizen rejects resolution and reopens complaint with mandatory reason and optional photos
 */
export const rejectResolutionController = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const { reason } = req.body;

    let files = [];
    if (Array.isArray(req.files)) {
      files = req.files;
    } else if (req.files && typeof req.files === 'object') {
      files = [
        ...(req.files.evidenceImages || []),
        ...(req.files.images || [])
      ];
    } else if (req.file) {
      files = [req.file];
    }

    const result = await rejectResolutionByCitizen(req.user._id, complaintId, {
      reason,
      files,
      citizenUser: req.user
    });

    return successResponse(res, 200, result.message, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: POST /api/admin/resolutions/:complaintId/review
 * Municipal admin reviews disputed resolution or repeat citizen rejections
 */
export const reviewResolutionController = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const { action, notes, reassignedDepartment, reassignedOfficer } = req.body;

    const complaint = await reviewResolutionByAdmin(req.user._id, complaintId, {
      action,
      notes,
      adminUser: req.user,
      reassignedDepartment,
      reassignedOfficer
    });

    return successResponse(res, 200, 'Administrative review processed successfully', {
      complaint: complaint.toAdminJSON ? complaint.toAdminJSON() : complaint
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/resolutions
 * Retrieves administrative list of complaints with resolution and dispute information
 */
export const getAdminResolutionsController = async (req, res, next) => {
  try {
    const result = await getAdminResolutionsList(req.query);
    return res.status(200).json({
      success: true,
      message: 'Administrative resolutions list retrieved successfully',
      resolutions: result.resolutions,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/resolutions/stats
 * Retrieves overview KPIs on resolution submissions, verifications, disputes, and reopens
 */
export const getAdminResolutionStatsController = async (req, res, next) => {
  try {
    const stats = await getAdminResolutionStats();
    return successResponse(res, 200, 'Resolution statistics retrieved successfully', {
      stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/analytics/officers/performance
 * Retrieves performance analytics for field officers
 */
export const getOfficerPerformanceAnalyticsController = async (req, res, next) => {
  try {
    const analytics = await getOfficerPerformanceAnalytics(req.query);
    return successResponse(res, 200, 'Officer performance analytics retrieved successfully', {
      analytics
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getOfficerWorkspaceController,
  getResolutionEvidenceController,
  uploadEvidenceController,
  submitResolutionController,
  verifyResolutionController,
  rejectResolutionController,
  reviewResolutionController,
  getAdminResolutionsController,
  getAdminResolutionStatsController,
  getOfficerPerformanceAnalyticsController
};
