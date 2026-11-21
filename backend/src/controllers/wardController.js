import {
  createWard,
  getWards,
  getWardById,
  updateWard,
  toggleWardStatus,
  deleteWard,
  assignOfficersToWard,
  removeOfficerFromWard,
  assignDepartmentsToWard,
  transferComplaintBetweenWards,
  getMunicipalOverviewStats,
  getWardAnalytics,
  exportMunicipalWardCsv
} from '../services/wardService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * Controller: POST /api/wards
 * Creates a new municipal ward (Municipal Admin only)
 */
export const createWardController = async (req, res, next) => {
  try {
    const ward = await createWard(req.body);
    return successResponse(res, 201, `Ward "${ward.name}" (${ward.code}) created successfully`, { ward });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/wards
 * Retrieves paginated, filtered wards
 */
export const getWardsController = async (req, res, next) => {
  try {
    const { search, zone, isActive, page, limit } = req.query;
    const result = await getWards({ search, zone, isActive, page, limit });
    return res.status(200).json({
      success: true,
      message: 'Wards retrieved successfully',
      data: result.wards,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/wards/overview
 * Retrieves city-wide multi-ward dashboard KPIs & performance comparison
 */
export const getMunicipalOverviewController = async (req, res, next) => {
  try {
    const stats = await getMunicipalOverviewStats();
    return successResponse(res, 200, 'Municipal multi-ward overview retrieved successfully', { stats });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/wards/analytics/export
 * Exports city-wide complaints CSV report for authorized municipal administrators
 */
export const exportMunicipalWardCsvController = async (req, res, next) => {
  try {
    const { wardId, startDate, endDate } = req.query;
    const csvData = await exportMunicipalWardCsv({ wardId, startDate, endDate });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="civicfix_municipal_report_${Date.now()}.csv"`);
    return res.status(200).send(csvData);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/wards/:id
 * Retrieves full details and operational metrics for a specific ward
 */
export const getWardDetailsController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const details = await getWardById(id);
    return successResponse(res, 200, 'Ward details retrieved successfully', details);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: PUT /api/wards/:id
 * Updates ward properties (Admin only)
 */
export const updateWardController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await updateWard(id, req.body);
    return successResponse(res, 200, `Ward "${updated.name}" updated successfully`, { ward: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: PATCH /api/wards/:id/status
 * Activates or deactivates a ward
 */
export const toggleWardStatusController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    if (isActive === undefined) {
      return errorResponse(res, 400, 'Field "isActive" (boolean) is required in request body');
    }
    const result = await toggleWardStatus(id, isActive);
    return successResponse(res, 200, result.message, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: DELETE /api/wards/:id
 * Permanently deletes a ward only if it has zero active complaints and zero assigned officers
 */
export const deleteWardController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await deleteWard(id);
    return successResponse(res, 200, result.message, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/wards/:id/officers
 * Retrieves all officers currently assigned to this ward
 */
export const getWardOfficersController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const details = await getWardById(id);
    return successResponse(res, 200, 'Ward officers retrieved successfully', {
      officers: details.ward.officers || []
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: POST /api/wards/:id/officers
 * Assigns one or more field officers to a ward
 */
export const assignOfficersController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { officerIds } = req.body;
    if (!Array.isArray(officerIds) || officerIds.length === 0) {
      return errorResponse(res, 400, 'Field "officerIds" must be a non-empty array of valid officer IDs');
    }
    const result = await assignOfficersToWard(id, officerIds, req.user);
    return successResponse(res, 200, 'Officers assigned to ward successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: DELETE /api/wards/:id/officers/:officerId
 * Removes an officer from ward assignment
 */
export const removeOfficerController = async (req, res, next) => {
  try {
    const { id, officerId } = req.params;
    const result = await removeOfficerFromWard(id, officerId);
    return successResponse(res, 200, result.message, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: POST /api/wards/:id/departments
 * Assigns departments to a ward
 */
export const assignDepartmentsController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { departmentIds } = req.body;
    if (!Array.isArray(departmentIds)) {
      return errorResponse(res, 400, 'Field "departmentIds" must be an array of department IDs');
    }
    const result = await assignDepartmentsToWard(id, departmentIds);
    return successResponse(res, 200, 'Departments assigned to ward successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: POST /api/wards/complaints/:complaintId/transfer
 * Inter-ward complaint transfer with audit trail and SLA preservation
 */
export const transferComplaintController = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const { destinationWardId, destinationDepartmentId, reason } = req.body;

    if (!destinationWardId) {
      return errorResponse(res, 400, 'Field "destinationWardId" is required');
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return errorResponse(res, 400, 'Field "reason" is mandatory and must be at least 10 characters long');
    }

    const result = await transferComplaintBetweenWards(complaintId, {
      destinationWardId,
      destinationDepartmentId,
      reason,
      adminUser: req.user
    });

    return successResponse(res, 200, `Complaint ${complaintId} successfully transferred to ${result.destinationWard.name}`, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/wards/:id/analytics
 * Retrieves ward-specific analytics, performance metrics, and citizen feedback
 */
export const getWardAnalyticsController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    const analytics = await getWardAnalytics(id, { startDate, endDate });
    return successResponse(res, 200, 'Ward analytics retrieved successfully', analytics);
  } catch (error) {
    next(error);
  }
};
