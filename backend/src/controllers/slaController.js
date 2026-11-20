import mongoose from 'mongoose';
import { Complaint } from '../models/Complaint.js';
import { Department } from '../models/Department.js';
import { EscalationLog } from '../models/EscalationLog.js';
import {
  getSlaConfigs,
  saveSlaConfig,
  manualEscalateComplaint
} from '../services/slaService.js';
import { evaluateSlaComplaints } from '../services/slaMonitoringService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * Admin: GET /api/admin/sla/config
 * Retrieves all SLA policies (Global default + Department-specific)
 */
export const getAdminSlaConfig = async (req, res, next) => {
  try {
    const configs = await getSlaConfigs();
    return successResponse(res, 200, 'SLA configurations retrieved successfully', configs);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: PUT /api/admin/sla/config
 * Creates or updates SLA settings for a department or global policy
 */
export const updateAdminSlaConfig = async (req, res, next) => {
  try {
    const {
      departmentId,
      priorityTargets,
      escalationThresholds,
      isEnabled
    } = req.body;

    const savedConfig = await saveSlaConfig({
      departmentId,
      priorityTargets,
      escalationThresholds,
      isEnabled,
      adminUser: req.user
    });

    return successResponse(res, 200, 'SLA configuration updated successfully', {
      config: savedConfig
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: GET /api/admin/sla/overview
 * Returns high-level SLA metrics and compliance summary
 */
export const getAdminSlaOverview = async (req, res, next) => {
  try {
    const now = new Date();

    const [
      totalActive,
      withinSla,
      approaching,
      overdue,
      escalated,
      resolvedWithin,
      resolvedAfter,
      deptAgg
    ] = await Promise.all([
      Complaint.countDocuments({ status: { $ne: 'Resolved' } }),
      Complaint.countDocuments({ status: { $ne: 'Resolved' }, 'sla.status': 'Within SLA' }),
      Complaint.countDocuments({ status: { $ne: 'Resolved' }, 'sla.status': 'Approaching Deadline' }),
      Complaint.countDocuments({ status: { $ne: 'Resolved' }, 'sla.status': 'Overdue' }),
      Complaint.countDocuments({ status: { $ne: 'Resolved' }, 'sla.currentEscalationLevel': { $gt: 0 } }),
      Complaint.countDocuments({ status: 'Resolved', 'sla.status': 'Resolved Within SLA' }),
      Complaint.countDocuments({ status: 'Resolved', 'sla.status': 'Resolved After SLA' }),
      Complaint.aggregate([
        { $match: { assignedDepartment: { $ne: null } } },
        {
          $group: {
            _id: '$assignedDepartment',
            total: { $sum: 1 },
            overdue: { $sum: { $cond: [{ $eq: ['$sla.status', 'Overdue'] }, 1, 0] } },
            escalated: { $sum: { $cond: [{ $gt: ['$sla.currentEscalationLevel', 0] }, 1, 0] } }
          }
        }
      ])
    ]);

    const totalResolved = resolvedWithin + resolvedAfter;
    const complianceRate = totalResolved > 0
      ? Math.round((resolvedWithin / totalResolved) * 100)
      : (totalActive > 0 ? Math.round(((totalActive - overdue) / totalActive) * 100) : 100);

    return successResponse(res, 200, 'SLA overview statistics retrieved successfully', {
      stats: {
        totalActive,
        withinSla,
        approaching,
        overdue,
        escalated,
        complianceRate,
        resolvedWithin,
        resolvedAfter
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: GET /api/admin/sla/overdue
 * Retrieves paginated overdue and approaching complaints
 */
export const getAdminOverdueComplaints = async (req, res, next) => {
  try {
    const { department, priority, search, page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    const filter = {
      status: { $ne: 'Resolved' },
      'sla.status': { $in: ['Overdue', 'Approaching Deadline'] }
    };

    if (department && department !== 'all' && mongoose.Types.ObjectId.isValid(department)) {
      filter.assignedDepartment = department;
    }

    if (priority && priority !== 'all') {
      filter['sla.priority'] = priority;
    }

    if (search && search.trim()) {
      filter.complaintId = { $regex: search.trim(), $options: 'i' };
    }

    const [total, complaintsRaw] = await Promise.all([
      Complaint.countDocuments(filter),
      Complaint.find(filter)
        .populate('assignedDepartment', 'name code')
        .populate('assignedOfficer', 'name email')
        .sort({ 'sla.deadline': 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
    ]);

    const complaints = complaintsRaw.map((c) => c.toAdminJSON());
    const totalPages = Math.ceil(total / limitNum) || 1;

    return successResponse(res, 200, 'Overdue complaints retrieved successfully', {
      complaints,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: GET /api/admin/escalations
 * Retrieves escalation logs with pagination and filters
 */
export const getAdminEscalationLogs = async (req, res, next) => {
  try {
    const { level, department, complaintId, page = 1, limit = 15 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));

    const filter = {};

    if (level && level !== 'all') {
      const lvl = parseInt(level, 10);
      if (!isNaN(lvl)) filter.newLevel = lvl;
    }

    if (department && department !== 'all' && mongoose.Types.ObjectId.isValid(department)) {
      filter.department = department;
    }

    if (complaintId && complaintId.trim()) {
      filter.complaintId = { $regex: complaintId.trim(), $options: 'i' };
    }

    const [total, logsRaw] = await Promise.all([
      EscalationLog.countDocuments(filter),
      EscalationLog.find(filter)
        .sort({ escalatedAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
    ]);

    const escalations = logsRaw.map((l) => l.toSafeObject());
    const totalPages = Math.ceil(total / limitNum) || 1;

    return successResponse(res, 200, 'Escalation logs retrieved successfully', {
      escalations,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: GET /api/admin/escalations/:complaintId
 * Retrieves full escalation history for a specific complaint
 */
export const getComplaintEscalationHistory = async (req, res, next) => {
  try {
    const { complaintId } = req.params;

    if (!complaintId || typeof complaintId !== 'string' || !complaintId.trim()) {
      return errorResponse(res, 400, 'Complaint ID is required');
    }

    const trimmedId = complaintId.trim();
    const logs = await EscalationLog.find({ complaintId: trimmedId }).sort({ escalatedAt: -1 });

    return successResponse(res, 200, 'Complaint escalation history retrieved successfully', {
      complaintId: trimmedId,
      escalations: logs.map((l) => l.toSafeObject()),
      total: logs.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: POST /api/admin/escalations/:complaintId/manual
 * Allows authorized administrators to manually escalate a complaint with mandatory reason
 */
export const manualEscalateController = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const { reason } = req.body;

    const result = await manualEscalateComplaint(complaintId, {
      reason,
      adminUser: req.user
    });

    return successResponse(res, 200, 'Complaint manually escalated successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: POST /api/admin/sla/evaluate
 * Triggers an immediate SLA monitoring pass
 */
export const triggerSlaEvaluation = async (req, res, next) => {
  try {
    const summary = await evaluateSlaComplaints();
    return successResponse(res, 200, 'SLA evaluation completed successfully', {
      summary
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Officer: GET /api/officer/sla
 * Retrieves SLA information for complaints assigned strictly to the authenticated officer
 */
export const getOfficerSlaOverview = async (req, res, next) => {
  try {
    const officerId = req.user._id;

    const [
      totalAssigned,
      approachingCount,
      overdueCount,
      escalatedCount,
      urgentComplaintsRaw
    ] = await Promise.all([
      Complaint.countDocuments({ assignedOfficer: officerId, status: { $ne: 'Resolved' } }),
      Complaint.countDocuments({ assignedOfficer: officerId, status: { $ne: 'Resolved' }, 'sla.status': 'Approaching Deadline' }),
      Complaint.countDocuments({ assignedOfficer: officerId, status: { $ne: 'Resolved' }, 'sla.status': 'Overdue' }),
      Complaint.countDocuments({ assignedOfficer: officerId, status: { $ne: 'Resolved' }, 'sla.currentEscalationLevel': { $gt: 0 } }),
      Complaint.find({
        assignedOfficer: officerId,
        status: { $ne: 'Resolved' },
        'sla.status': { $in: ['Overdue', 'Approaching Deadline'] }
      })
        .populate('assignedDepartment', 'name code')
        .sort({ 'sla.deadline': 1 })
        .limit(10)
    ]);

    const urgentComplaints = urgentComplaintsRaw.map((c) => c.toPublicJSON());

    return successResponse(res, 200, 'Officer SLA overview retrieved successfully', {
      metrics: {
        totalAssigned,
        approaching: approachingCount,
        overdue: overdueCount,
        escalated: escalatedCount
      },
      urgentComplaints
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Officer: GET /api/officer/escalations
 * Retrieves escalations on complaints assigned to this officer
 */
export const getOfficerEscalations = async (req, res, next) => {
  try {
    const officerId = req.user._id;

    const assignedComplaints = await Complaint.find({ assignedOfficer: officerId }).select('_id complaintId');
    const complaintIds = assignedComplaints.map((c) => c.complaintId);

    const logs = await EscalationLog.find({ complaintId: { $in: complaintIds } })
      .sort({ escalatedAt: -1 })
      .limit(25);

    return successResponse(res, 200, 'Officer escalation logs retrieved successfully', {
      escalations: logs.map((l) => l.toSafeObject()),
      total: logs.length
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getAdminSlaConfig,
  updateAdminSlaConfig,
  getAdminSlaOverview,
  getAdminOverdueComplaints,
  getAdminEscalationLogs,
  getComplaintEscalationHistory,
  manualEscalateController,
  triggerSlaEvaluation,
  getOfficerSlaOverview,
  getOfficerEscalations
};
