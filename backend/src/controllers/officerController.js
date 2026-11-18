import {
  getOfficerDashboardStats,
  getOfficerComplaints,
  getOfficerComplaintDetails,
  updateOfficerComplaintStatus
} from '../services/officerService.js';
import { getOfficerMapComplaints } from '../services/mapService.js';
import { successResponse } from '../utils/apiResponse.js';

/**
 * Controller: GET /api/officer/dashboard/stats
 * Retrieves dashboard KPI statistics for the authenticated field officer
 */
export const getStats = async (req, res, next) => {
  try {
    const stats = await getOfficerDashboardStats(req.user._id);
    return successResponse(res, 200, 'Officer dashboard statistics retrieved successfully', {
      stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/officer/complaints
 * Retrieves paginated complaints assigned strictly to the authenticated field officer
 */
export const getComplaints = async (req, res, next) => {
  try {
    const { status, search, sortBy, page, limit } = req.query;
    const result = await getOfficerComplaints(req.user._id, {
      status,
      search,
      sortBy,
      page,
      limit
    });

    return res.status(200).json({
      success: true,
      message: 'Assigned complaints retrieved successfully',
      data: result.complaints,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/officer/complaints/:complaintId
 * Retrieves detailed inspection of a complaint assigned to the authenticated field officer
 */
export const getComplaintById = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const complaint = await getOfficerComplaintDetails(req.user._id, complaintId);

    return successResponse(res, 200, 'Complaint details retrieved successfully', {
      complaint
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: PATCH /api/officer/complaints/:complaintId/status
 * Updates status of an assigned complaint ('In Progress' or 'Resolved') with optional progress note
 */
export const updateStatus = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const { status, note } = req.body;

    const updatedComplaint = await updateOfficerComplaintStatus(
      req.user._id,
      complaintId,
      status,
      {
        note,
        officerUser: req.user
      }
    );

    return successResponse(res, 200, `Complaint status successfully updated to "${status}"`, {
      complaint: updatedComplaint
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/officer/map/complaints
 * Retrieves geographic complaints assigned strictly to the authenticated field officer
 */
export const getOfficerMap = async (req, res, next) => {
  try {
    const { status, category, limit } = req.query;
    const complaints = await getOfficerMapComplaints(req.user._id, {
      status,
      category,
      limit
    });

    return successResponse(res, 200, 'Officer assigned map complaints retrieved successfully', {
      complaints,
      total: complaints.length
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getStats,
  getComplaints,
  getComplaintById,
  updateStatus,
  getOfficerMap
};
