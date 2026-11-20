import mongoose from 'mongoose';
import { SlaConfig, DEFAULT_SLA_TARGETS, DEFAULT_ESCALATION_THRESHOLDS } from '../models/SlaConfig.js';
import { Complaint } from '../models/Complaint.js';
import { Department } from '../models/Department.js';
import { EscalationLog } from '../models/EscalationLog.js';
import { getDatabaseStatus } from '../config/db.js';
import { notifyManualEscalation } from './notificationService.js';

/**
 * Ensures MongoDB is connected
 */
const assertDatabaseConnected = () => {
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }
};

/**
 * Normalizes priority from string, AI analysis, or fallback
 * @param {string} rawPriority
 * @param {string} [category]
 * @returns {string} 'Critical' | 'High' | 'Medium' | 'Low'
 */
export const normalizePriority = (rawPriority, category = null) => {
  if (rawPriority && typeof rawPriority === 'string') {
    const p = rawPriority.trim().toLowerCase();
    if (p === 'critical') return 'Critical';
    if (p === 'high') return 'High';
    if (p === 'low') return 'Low';
    if (p === 'medium') return 'Medium';
  }
  if (category && typeof category === 'string') {
    const cat = category.trim().toLowerCase();
    if (cat.includes('water') || cat.includes('leak') || cat.includes('road') || cat.includes('pothole') || cat.includes('electric')) {
      return 'High';
    }
  }
  return 'Medium';
};

/**
 * Service: Retrieves all configured SLA policies (Global standard + Department-specific)
 * @returns {Promise<{global: object, departments: Array<object>}>}
 */
export const getSlaConfigs = async () => {
  assertDatabaseConnected();

  const [allConfigs, activeDepts] = await Promise.all([
    SlaConfig.find({}).populate('department', 'name code isActive'),
    Department.find({ isActive: true }).select('name code')
  ]);

  let globalConfig = allConfigs.find((c) => !c.department);
  if (!globalConfig) {
    globalConfig = {
      id: null,
      department: null,
      departmentName: 'Global Default',
      priorityTargets: { ...DEFAULT_SLA_TARGETS },
      escalationThresholds: { ...DEFAULT_ESCALATION_THRESHOLDS },
      isEnabled: true,
      updatedByName: 'System Built-In Standard',
      updatedAt: new Date()
    };
  } else {
    globalConfig = globalConfig.toSafeObject();
  }

  // Map department configs
  const departmentConfigs = activeDepts.map((dept) => {
    const custom = allConfigs.find(
      (c) => c.department && c.department._id.toString() === dept._id.toString()
    );
    if (custom) {
      return custom.toSafeObject();
    }
    return {
      id: null,
      department: dept._id.toString(),
      departmentName: dept.name,
      departmentCode: dept.code,
      priorityTargets: { ...globalConfig.priorityTargets },
      escalationThresholds: { ...globalConfig.escalationThresholds },
      isEnabled: true,
      isInherited: true,
      updatedByName: 'Inherited from Global',
      updatedAt: null
    };
  });

  return {
    global: globalConfig,
    departments: departmentConfigs
  };
};

/**
 * Service: Creates or updates an SLA configuration policy
 * @param {object} params
 * @param {string|null} [params.departmentId=null] - null for global default
 * @param {object} params.priorityTargets - { Critical, High, Medium, Low } in hours
 * @param {object} [params.escalationThresholds] - { level1WarningPercent, level2OverduePercent, level3CriticalPercent }
 * @param {boolean} [params.isEnabled=true]
 * @param {object} params.adminUser
 * @returns {Promise<object>} Saved SLA configuration
 */
export const saveSlaConfig = async ({
  departmentId = null,
  priorityTargets,
  escalationThresholds,
  isEnabled = true,
  adminUser = null
}) => {
  assertDatabaseConnected();

  // 1. Validate Priority Targets
  if (!priorityTargets || typeof priorityTargets !== 'object') {
    const error = new Error('Priority resolution targets are required');
    error.statusCode = 400;
    throw error;
  }

  const validatedTargets = {};
  for (const prio of ['Critical', 'High', 'Medium', 'Low']) {
    const val = Number(priorityTargets[prio]);
    if (isNaN(val) || val < 1 || !Number.isFinite(val)) {
      const error = new Error(`Resolution target for ${prio} priority must be a valid number of at least 1 hour`);
      error.statusCode = 400;
      throw error;
    }
    validatedTargets[prio] = Math.round(val * 10) / 10;
  }

  // 2. Validate Escalation Thresholds
  const validatedThresholds = { ...DEFAULT_ESCALATION_THRESHOLDS };
  if (escalationThresholds && typeof escalationThresholds === 'object') {
    if (escalationThresholds.level1WarningPercent !== undefined) {
      const l1 = Number(escalationThresholds.level1WarningPercent);
      if (isNaN(l1) || l1 < 10 || l1 > 100) {
        const error = new Error('Level 1 Warning Threshold must be a percentage between 10% and 100%');
        error.statusCode = 400;
        throw error;
      }
      validatedThresholds.level1WarningPercent = l1;
    }

    if (escalationThresholds.level2OverduePercent !== undefined) {
      const l2 = Number(escalationThresholds.level2OverduePercent);
      if (isNaN(l2) || l2 < 100) {
        const error = new Error('Level 2 Overdue Threshold must be at least 100%');
        error.statusCode = 400;
        throw error;
      }
      validatedThresholds.level2OverduePercent = l2;
    }

    if (escalationThresholds.level3CriticalPercent !== undefined) {
      const l3 = Number(escalationThresholds.level3CriticalPercent);
      if (isNaN(l3) || l3 <= validatedThresholds.level2OverduePercent) {
        const error = new Error('Level 3 Critical Threshold must be greater than Level 2 threshold');
        error.statusCode = 400;
        throw error;
      }
      validatedThresholds.level3CriticalPercent = l3;
    }
  }

  // 3. Resolve Department Details
  let targetDepartmentId = null;
  let departmentName = 'Global Default';

  if (departmentId && departmentId !== 'global' && departmentId !== 'null') {
    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      const error = new Error('Invalid department identifier');
      error.statusCode = 400;
      throw error;
    }
    const dept = await Department.findById(departmentId);
    if (!dept) {
      const error = new Error('Department not found with provided identifier');
      error.statusCode = 404;
      throw error;
    }
    targetDepartmentId = dept._id;
    departmentName = dept.name;
  }

  // 4. Upsert Configuration
  const updatedByName = adminUser?.name || 'Municipal Administrator';
  const updatedBy = adminUser?._id || null;

  const configDoc = await SlaConfig.findOneAndUpdate(
    { department: targetDepartmentId },
    {
      department: targetDepartmentId,
      departmentName,
      priorityTargets: validatedTargets,
      escalationThresholds: validatedThresholds,
      isEnabled: Boolean(isEnabled),
      updatedBy,
      updatedByName
    },
    { new: true, upsert: true, runValidators: true }
  );

  return configDoc.toSafeObject();
};

/**
 * Service: Initializes SLA tracking fields on a new complaint
 * @param {object} complaint - Mongoose Complaint document
 * @param {object} [options]
 * @param {string} [options.priorityOverride]
 * @returns {Promise<object>} Initialized complaint
 */
export const initializeComplaintSla = async (complaint, { priorityOverride = null } = {}) => {
  if (!complaint) return null;

  // Determine priority
  let priority = normalizePriority(priorityOverride);
  if (!priorityOverride) {
    if (complaint.aiAnalysis?.severity) {
      priority = normalizePriority(complaint.aiAnalysis.severity);
    } else if (complaint.imageAnalysis?.suggestedSeverity) {
      priority = normalizePriority(complaint.imageAnalysis.suggestedSeverity);
    } else if (complaint.category === 'Water Leakage' || complaint.category === 'Road Damage') {
      priority = 'High';
    }
  }

  // Fetch applicable SLA policy
  const effectiveConfig = await SlaConfig.getEffectiveConfig(complaint.assignedDepartment);
  const targetResolutionHours = effectiveConfig.priorityTargets[priority] || DEFAULT_SLA_TARGETS[priority] || 72;

  const startTime = complaint.createdAt || new Date();
  const deadline = new Date(startTime.getTime() + targetResolutionHours * 3600 * 1000);
  const remainingHours = targetResolutionHours;

  const level1Percent = effectiveConfig.escalationThresholds?.level1WarningPercent || 75;
  const nextEscalationThreshold = new Date(
    startTime.getTime() + (targetResolutionHours * (level1Percent / 100)) * 3600 * 1000
  );

  complaint.sla = {
    status: 'Within SLA',
    priority,
    targetResolutionHours,
    startTime,
    deadline,
    remainingHours,
    overdueHours: 0,
    resolvedAt: null,
    currentEscalationLevel: 0,
    lastEscalatedAt: null,
    nextEscalationThreshold,
    isEscalated: false,
    monitoringActive: complaint.status !== 'Resolved'
  };

  return complaint;
};

/**
 * Service: Updates SLA tracking when complaint status changes (e.g. Resolved or Reopened)
 * @param {object} complaint - Mongoose Complaint document
 * @param {string} newStatus - New status ('Pending' | 'In Progress' | 'Resolved')
 * @returns {object} Updated complaint
 */
export const handleComplaintStatusChangeSla = (complaint, newStatus, effectiveNow = null) => {
  if (!complaint || !complaint.sla) return complaint;

  const now = effectiveNow instanceof Date ? effectiveNow : new Date();

  if (newStatus === 'Resolved') {
    complaint.sla.monitoringActive = false;
    complaint.sla.resolvedAt = now;
    complaint.sla.remainingHours = 0;

    const deadline = complaint.sla.deadline ? new Date(complaint.sla.deadline) : null;
    if (deadline && now <= deadline) {
      complaint.sla.status = 'Resolved Within SLA';
      complaint.sla.citizenSafeStatus = 'Resolved Within SLA';
      complaint.sla.isOverdue = false;
      complaint.sla.overdueHours = 0;
    } else {
      complaint.sla.status = 'Resolved After SLA';
      complaint.sla.citizenSafeStatus = 'Resolved After SLA';
      complaint.sla.isOverdue = true;
      if (deadline) {
        complaint.sla.overdueHours = Math.max(0, Math.round(((now.getTime() - deadline.getTime()) / 3600000) * 10) / 10);
      }
    }
  } else {
    // Reopened complaint (Pending or In Progress)
    complaint.sla.monitoringActive = true;
    complaint.sla.resolvedAt = null;

    if (complaint.sla.deadline) {
      const deadline = new Date(complaint.sla.deadline);
      if (now > deadline) {
        complaint.sla.status = 'Overdue';
        complaint.sla.citizenSafeStatus = 'Overdue';
        complaint.sla.isOverdue = true;
        complaint.sla.overdueHours = Math.round(((now.getTime() - deadline.getTime()) / 3600000) * 10) / 10;
        complaint.sla.remainingHours = 0;
      } else {
        const remaining = (deadline.getTime() - now.getTime()) / 3600000;
        complaint.sla.remainingHours = Math.max(0, Math.round(remaining * 10) / 10);
        complaint.sla.overdueHours = 0;
        complaint.sla.isOverdue = false;

        const nextThreshold = complaint.sla.nextEscalationThreshold ? new Date(complaint.sla.nextEscalationThreshold) : null;
        if (nextThreshold && now >= nextThreshold) {
          complaint.sla.status = 'Approaching Deadline';
          complaint.sla.citizenSafeStatus = 'Approaching Deadline';
        } else {
          complaint.sla.status = 'Within SLA';
          complaint.sla.citizenSafeStatus = 'Within SLA';
        }
      }
    }
  }

  return complaint;
};

/**
 * Service: Handles administrative manual escalation with mandatory reason
 * @param {string|object} rawComplaintIdOrOptions
 * @param {object} [maybeOptions]
 * @returns {Promise<object>} Updated complaint and created escalation log
 */
export const manualEscalateComplaint = async (rawComplaintIdOrOptions, maybeOptions) => {
  let rawComplaintId;
  let options;
  if (typeof rawComplaintIdOrOptions === 'object' && rawComplaintIdOrOptions !== null && rawComplaintIdOrOptions.complaintId) {
    rawComplaintId = rawComplaintIdOrOptions.complaintId;
    options = rawComplaintIdOrOptions;
  } else {
    rawComplaintId = rawComplaintIdOrOptions;
    options = maybeOptions || {};
  }
  const reason = options.reason;
  const targetLevel = options.targetLevel;
  const adminUser = options.adminUser || options.escalatedBy;

  if (!rawComplaintId || typeof rawComplaintId !== 'string' || rawComplaintId.trim() === '') {
    const error = new Error('Valid complaint ID is required for manual escalation');
    error.statusCode = 400;
    throw error;
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    const error = new Error('A mandatory justification reason (at least 5 characters) is required to manually escalate');
    error.statusCode = 400;
    throw error;
  }

  if (reason.trim().length > 1000) {
    const error = new Error('Escalation reason cannot exceed 1000 characters');
    error.statusCode = 400;
    throw error;
  }

  assertDatabaseConnected();
  const trimmedComplaintId = rawComplaintId.trim();
  const trimmedReason = reason.trim();

  const complaint = await Complaint.findOne({ complaintId: trimmedComplaintId })
    .populate('assignedDepartment', 'name code')
    .populate('assignedOfficer', 'name email');

  if (!complaint) {
    const error = new Error(`Complaint not found with ID: ${trimmedComplaintId}`);
    error.statusCode = 404;
    throw error;
  }

  if (complaint.status === 'Resolved') {
    const error = new Error('Cannot escalate an already resolved complaint');
    error.statusCode = 400;
    throw error;
  }

  if (!complaint.sla) {
    await initializeComplaintSla(complaint);
  }

  const prevLevel = complaint.sla.currentEscalationLevel || 0;
  let newLevel;
  if (targetLevel !== undefined && targetLevel !== null) {
    const parsed = Number(targetLevel);
    if (isNaN(parsed) || parsed < 1 || parsed > 3 || parsed <= prevLevel) {
      const error = new Error(`Target escalation level must be higher than current level (${prevLevel}) and up to 3`);
      error.statusCode = 400;
      throw error;
    }
    newLevel = parsed;
  } else {
    newLevel = Math.min(3, prevLevel + 1);
  }

  const escalatedByName = adminUser?.name || 'Municipal Administrator';
  const escalatedBy = adminUser?._id || null;
  const now = new Date();

  // Update Complaint SLA fields
  complaint.sla.currentEscalationLevel = newLevel;
  complaint.sla.isEscalated = true;
  complaint.sla.lastEscalatedAt = now;

  // Add entry to status history for transparency
  complaint.statusHistory.push({
    previousStatus: complaint.status,
    newStatus: complaint.status,
    changedBy: escalatedBy,
    changedByName: escalatedByName,
    note: `[Manual Escalation to Level ${newLevel}]: ${trimmedReason}`,
    changedAt: now
  });

  await complaint.save();

  // Create Escalation Audit Log
  const escalationLog = new EscalationLog({
    complaint: complaint._id,
    complaintId: complaint.complaintId,
    previousLevel: prevLevel,
    newLevel: newLevel,
    triggerType: 'MANUAL_ADMIN',
    triggerReason: trimmedReason,
    department: complaint.assignedDepartment?._id || null,
    departmentName: complaint.assignedDepartment?.name || complaint.assignedDepartmentName || 'Unassigned',
    assignedOfficer: complaint.assignedOfficer?._id || null,
    assignedOfficerName: complaint.assignedOfficer?.name || complaint.assignedOfficerName || null,
    notificationStatus: 'Sent',
    notifiedRecipients: [],
    actionTaken: `Complaint manually elevated to Level ${newLevel} by ${escalatedByName}`,
    escalatedBy,
    escalatedByName,
    escalatedAt: now
  });

  await escalationLog.save();

  // Dispatch Email Notification in background
  try {
    await notifyManualEscalation({
      complaint,
      escalationLevel: newLevel,
      reason: trimmedReason,
      adminUser
    });
  } catch (notifyErr) {
    console.warn(`[Escalation] Notification dispatch warning for ${complaint.complaintId}:`, notifyErr.message);
  }

  return {
    complaint: complaint.toAdminJSON(),
    escalationLog: escalationLog.toSafeObject()
  };
};

/**
 * Service: Retrieves high-level SLA performance overview
 * @param {object} [queryParams]
 * @returns {Promise<object>}
 */
export const getSlaPerformanceOverview = async (queryParams = {}) => {
  assertDatabaseConnected();
  const [
    totalActive,
    withinSla,
    approaching,
    overdue,
    escalated,
    resolvedWithin,
    resolvedAfter,
    escLevel1,
    escLevel2,
    escLevel3
  ] = await Promise.all([
    Complaint.countDocuments({ status: { $ne: 'Resolved' } }),
    Complaint.countDocuments({ status: { $ne: 'Resolved' }, 'sla.status': 'Within SLA' }),
    Complaint.countDocuments({ status: { $ne: 'Resolved' }, 'sla.status': 'Approaching Deadline' }),
    Complaint.countDocuments({ status: { $ne: 'Resolved' }, 'sla.status': 'Overdue' }),
    Complaint.countDocuments({ status: { $ne: 'Resolved' }, 'sla.currentEscalationLevel': { $gt: 0 } }),
    Complaint.countDocuments({ status: 'Resolved', 'sla.status': 'Resolved Within SLA' }),
    Complaint.countDocuments({ status: 'Resolved', 'sla.status': 'Resolved After SLA' }),
    Complaint.countDocuments({ 'sla.currentEscalationLevel': 1 }),
    Complaint.countDocuments({ 'sla.currentEscalationLevel': 2 }),
    Complaint.countDocuments({ 'sla.currentEscalationLevel': 3 })
  ]);

  const totalResolved = resolvedWithin + resolvedAfter;
  const complianceRate = totalResolved > 0
    ? Math.round((resolvedWithin / totalResolved) * 100)
    : 100;
  const overdueRate = totalActive > 0
    ? Math.round((overdue / totalActive) * 100)
    : 0;

  return {
    summary: {
      activeMonitored: totalActive,
      withinSla,
      approachingDeadline: approaching,
      overdue,
      escalated,
      resolvedWithinSla: resolvedWithin,
      resolvedAfterSla: resolvedAfter,
      complianceRate,
      overdueRate
    },
    escalations: {
      level1: escLevel1,
      level2: escLevel2,
      level3: escLevel3
    }
  };
};

export default {
  normalizePriority,
  getSlaConfigs,
  saveSlaConfig,
  initializeComplaintSla,
  handleComplaintStatusChangeSla,
  manualEscalateComplaint,
  getSlaPerformanceOverview
};
