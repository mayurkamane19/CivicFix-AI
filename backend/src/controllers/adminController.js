import {
  getDashboardStatistics,
  getComplaintsForAdmin,
  getAdminComplaintDetails,
  getComplaintStatusHistory,
  updateComplaintStatus
} from '../services/adminService.js';
import {
  getAllDepartments,
  createDepartment,
  updateDepartment
} from '../services/departmentService.js';
import {
  getOfficersForAdmin,
  assignComplaint,
  getComplaintAssignmentHistory
} from '../services/assignmentService.js';
import { getAdminMapComplaints } from '../services/mapService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * Controller: GET /api/admin/dashboard/stats
 * Retrieves high-level operational statistics for municipal administration
 */
export const getStats = async (req, res, next) => {
  try {
    const stats = await getDashboardStatistics();
    return successResponse(res, 200, 'Admin dashboard statistics retrieved successfully', {
      stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/complaints
 * Retrieves paginated, filtered, and sorted complaints for administration
 */
export const getComplaints = async (req, res, next) => {
  try {
    const {
      search,
      category,
      status,
      severity,
      department,
      officer,
      ward,
      sortBy,
      page,
      limit
    } = req.query;

    let targetWard = ward;
    let targetDept = department;

    // Ward admin data scoping: strictly restrict queries to their assigned ward
    if (req.user && req.user.role === 'ward_admin') {
      const userWardId = req.user.ward ? (req.user.ward._id ? req.user.ward._id.toString() : req.user.ward.toString()) : null;
      targetWard = userWardId || 'none';
    }

    // Department head data scoping: strictly restrict queries to their assigned department
    if (req.user && req.user.role === 'department_head') {
      const userDeptId = req.user.department ? (req.user.department._id ? req.user.department._id.toString() : req.user.department.toString()) : null;
      targetDept = userDeptId || 'none';
    }

    const result = await getComplaintsForAdmin({
      search,
      category,
      status,
      severity,
      department: targetDept,
      officer,
      ward: targetWard,
      sortBy,
      page,
      limit
    });

    return res.status(200).json({
      success: true,
      message: 'Complaints list retrieved successfully',
      data: result.complaints,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/complaints/:complaintId
 * Retrieves detailed complaint record including AI analysis and duplicates
 */
export const getComplaintById = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const complaint = await getAdminComplaintDetails(complaintId);

    // Ward admin data isolation: cannot view complaints from other wards
    if (req.user && req.user.role === 'ward_admin') {
      const userWardId = req.user.ward ? (req.user.ward._id ? req.user.ward._id.toString() : req.user.ward.toString()) : null;
      const compWardId = complaint.ward ? (complaint.ward._id ? complaint.ward._id.toString() : complaint.ward.toString()) : null;
      if (!compWardId || compWardId !== userWardId) {
        return errorResponse(res, 403, 'Access denied: Ward Administrators cannot view complaints from other wards');
      }
    }

    // Department head data isolation: cannot view complaints from other departments
    if (req.user && req.user.role === 'department_head') {
      const userDeptId = req.user.department ? (req.user.department._id ? req.user.department._id.toString() : req.user.department.toString()) : null;
      const compDeptId = complaint.assignedDepartment ? (complaint.assignedDepartment._id ? complaint.assignedDepartment._id.toString() : complaint.assignedDepartment.toString()) : null;
      if (!compDeptId || compDeptId !== userDeptId) {
        return errorResponse(res, 403, 'Access denied: Department Heads cannot view complaints from other departments');
      }
    }

    return successResponse(res, 200, 'Complaint details retrieved successfully', {
      complaint
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/complaints/:complaintId/history
 * Retrieves full audit history and status transitions for a complaint
 */
export const getHistory = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const historyData = await getComplaintStatusHistory(complaintId);

    return successResponse(res, 200, 'Complaint status history retrieved successfully', {
      history: historyData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: PATCH /api/admin/complaints/:complaintId/status
 * Updates complaint status ('Pending', 'In Progress', 'Resolved') with optional note and audit trail
 */
export const updateStatus = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const { status, note } = req.body;

    if (!status || typeof status !== 'string') {
      return errorResponse(res, 400, "Request body must contain 'status' field (Pending, In Progress, or Resolved)");
    }

    if (note !== undefined && note !== null && typeof note !== 'string') {
      return errorResponse(res, 400, "Status 'note' must be a valid text string");
    }

    // Pass authenticated user from req.user (never trust client-supplied admin ID)
    const updatedComplaint = await updateComplaintStatus(complaintId, status, {
      note,
      adminUser: req.user
    });

    return successResponse(
      res,
      200,
      `Complaint status updated to '${status}' successfully`,
      {
        complaint: updatedComplaint
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/departments
 * Retrieves all municipal departments
 */
export const getDepartments = async (req, res, next) => {
  try {
    const departments = await getAllDepartments({ includeInactive: true });
    return successResponse(res, 200, 'Departments retrieved successfully', {
      departments
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: POST /api/admin/departments
 * Creates a new municipal department
 */
export const createDepartmentController = async (req, res, next) => {
  try {
    const { name, code, description } = req.body;
    const department = await createDepartment({ name, code, description });
    return successResponse(res, 201, 'Department created successfully', {
      department
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: PATCH /api/admin/departments/:departmentId
 * Updates an existing municipal department (name, code, description, isActive)
 */
export const updateDepartmentController = async (req, res, next) => {
  try {
    const { departmentId } = req.params;
    const department = await updateDepartment(departmentId, req.body);
    return successResponse(res, 200, 'Department updated successfully', {
      department
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/officers
 * Retrieves all field officers with populated department information
 */
export const getOfficers = async (req, res, next) => {
  try {
    const { departmentId } = req.query;
    const officers = await getOfficersForAdmin({ departmentId });
    return successResponse(res, 200, 'Officers list retrieved successfully', {
      officers
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: PATCH /api/admin/complaints/:complaintId/assignment
 * Assigns or reassigns complaint to a department and field officer
 */
export const assignComplaintController = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const { departmentId, officerId, note } = req.body;

    // Department head scoping: can only assign within their own department
    if (req.user && req.user.role === 'department_head') {
      const userDeptId = req.user.department ? (req.user.department._id ? req.user.department._id.toString() : req.user.department.toString()) : null;
      if (!userDeptId || userDeptId !== departmentId) {
        return errorResponse(res, 403, 'Access denied: Department Heads can only assign complaints to their own department');
      }
    }

    // Security: derive admin identity solely from authenticated backend req.user
    const updatedComplaint = await assignComplaint(complaintId, {
      departmentId,
      officerId,
      note,
      adminUser: req.user
    });

    return successResponse(res, 200, 'Complaint assigned successfully', {
      complaint: updatedComplaint
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/complaints/:complaintId/assignment-history
 * Retrieves full chronological assignment history and audit trail
 */
export const getAssignmentHistoryController = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const historyData = await getComplaintAssignmentHistory(complaintId);

    return successResponse(res, 200, 'Complaint assignment history retrieved successfully', {
      history: historyData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/map/complaints
 * Retrieves geographic complaints with valid GPS coordinates for municipal GIS map
 */
export const getAdminMap = async (req, res, next) => {
  try {
    const {
      category,
      status,
      severity,
      department,
      officer,
      ward,
      startDate,
      endDate,
      limit
    } = req.query;

    const complaints = await getAdminMapComplaints({
      category,
      status,
      severity,
      department,
      officer,
      ward,
      startDate,
      endDate,
      limit
    });

    return successResponse(res, 200, 'Admin map complaints retrieved successfully', {
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
  getHistory,
  updateStatus,
  getDepartments,
  createDepartmentController,
  updateDepartmentController,
  getOfficers,
  assignComplaintController,
  getAssignmentHistoryController,
  getAdminMap
};
