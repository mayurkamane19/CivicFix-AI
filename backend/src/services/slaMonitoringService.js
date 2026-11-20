import mongoose from 'mongoose';
import { Complaint } from '../models/Complaint.js';
import { SlaConfig, DEFAULT_SLA_TARGETS } from '../models/SlaConfig.js';
import { EscalationLog } from '../models/EscalationLog.js';
import { initializeComplaintSla } from './slaService.js';
import {
  notifySlaWarning,
  notifySlaBreach,
  notifySlaEscalation
} from './notificationService.js';
import { getDatabaseStatus } from '../config/db.js';

let schedulerTimer = null;
let isEvaluating = false;

/**
 * Service: Evaluates active complaints against their SLA deadlines and triggers multi-level escalations
 * @returns {Promise<object>} Evaluation execution summary
 */
export const evaluateSlaComplaints = async () => {
  if (isEvaluating) {
    return { status: 'skipped', reason: 'Evaluation already in progress' };
  }

  if (getDatabaseStatus() !== 'connected') {
    return { status: 'skipped', reason: 'Database not connected' };
  }

  isEvaluating = true;
  const summary = {
    evaluatedCount: 0,
    approachingCount: 0,
    overdueCount: 0,
    escalatedLevel1: 0,
    escalatedLevel2: 0,
    escalatedLevel3: 0,
    errors: []
  };

  try {
    // 1. Fetch active, unresolved complaints
    const activeComplaints = await Complaint.find({
      status: { $ne: 'Resolved' },
      'sla.monitoringActive': { $ne: false }
    })
      .populate('assignedDepartment', 'name code')
      .populate('assignedOfficer', 'name email');

    summary.evaluatedCount = activeComplaints.length;
    const now = new Date();

    for (const complaint of activeComplaints) {
      try {
        // Ensure complaint has initialized SLA
        if (!complaint.sla || !complaint.sla.deadline) {
          await initializeComplaintSla(complaint);
        }

        const deadline = new Date(complaint.sla.deadline);
        const startTime = new Date(complaint.sla.startTime || complaint.createdAt);
        const targetHours = complaint.sla.targetResolutionHours || DEFAULT_SLA_TARGETS[complaint.sla.priority] || 72;

        const remainingMs = deadline.getTime() - now.getTime();
        const remainingHours = Math.round((remainingMs / 3600000) * 10) / 10;
        const overdueHours = now > deadline
          ? Math.round(((now.getTime() - deadline.getTime()) / 3600000) * 10) / 10
          : 0;

        complaint.sla.remainingHours = Math.max(0, remainingHours);
        complaint.sla.overdueHours = overdueHours;

        const effectiveConfig = await SlaConfig.getEffectiveConfig(complaint.assignedDepartment?._id);
        const l1WarningPercent = effectiveConfig.escalationThresholds?.level1WarningPercent || 75;
        const l3CriticalPercent = effectiveConfig.escalationThresholds?.level3CriticalPercent || 150;

        const totalDurationMs = targetHours * 3600 * 1000;
        const elapsedMs = now.getTime() - startTime.getTime();
        const elapsedPercent = totalDurationMs > 0 ? (elapsedMs / totalDurationMs) * 100 : 100;

        const isOverdue = now >= deadline;
        const isApproaching = !isOverdue && elapsedPercent >= l1WarningPercent;

        // Update SLA Status
        if (isOverdue) {
          complaint.sla.status = 'Overdue';
          summary.overdueCount++;
        } else if (isApproaching) {
          complaint.sla.status = 'Approaching Deadline';
          summary.approachingCount++;
        } else {
          complaint.sla.status = 'Within SLA';
        }

        const currentLevel = complaint.sla.currentEscalationLevel || 0;
        let newEscalationLevel = null;
        let triggerReason = '';

        // Escalation Level 3: Severe Breach (>= 150% target elapsed or severe overdue)
        if (elapsedPercent >= l3CriticalPercent && currentLevel < 3) {
          newEscalationLevel = 3;
          triggerReason = `Critical SLA breach: Complaint is overdue by ${overdueHours} hours (reached ${Math.round(elapsedPercent)}% of target SLA)`;
        }
        // Escalation Level 2: Target Deadline Breached (100% target elapsed)
        else if (isOverdue && currentLevel < 2) {
          newEscalationLevel = 2;
          triggerReason = `SLA deadline breached: Complaint unresolved after ${targetHours} target hours (overdue by ${overdueHours} hours)`;
        }
        // Escalation Level 1: Warning (>= 75% target elapsed)
        else if (isApproaching && currentLevel < 1) {
          newEscalationLevel = 1;
          triggerReason = `Resolution deadline approaching: ${Math.max(0, remainingHours)} hours remaining before SLA breach (${Math.round(elapsedPercent)}% elapsed)`;
        }

        // Apply Escalation if threshold crossed
        if (newEscalationLevel !== null) {
          complaint.sla.currentEscalationLevel = newEscalationLevel;
          complaint.sla.lastEscalatedAt = now;
          if (newEscalationLevel >= 2) {
            complaint.sla.isEscalated = true;
          }

          if (newEscalationLevel === 1) summary.escalatedLevel1++;
          if (newEscalationLevel === 2) summary.escalatedLevel2++;
          if (newEscalationLevel === 3) summary.escalatedLevel3++;

          // Record Escalation Log
          const log = new EscalationLog({
            complaint: complaint._id,
            complaintId: complaint.complaintId,
            previousLevel: currentLevel,
            newLevel: newEscalationLevel,
            triggerType: 'AUTOMATIC_TIMEOUT',
            triggerReason,
            department: complaint.assignedDepartment?._id || null,
            departmentName: complaint.assignedDepartment?.name || complaint.assignedDepartmentName || 'Unassigned',
            assignedOfficer: complaint.assignedOfficer?._id || null,
            assignedOfficerName: complaint.assignedOfficer?.name || complaint.assignedOfficerName || null,
            notificationStatus: 'Sent',
            notifiedRecipients: [],
            actionTaken: `Automated escalation to Level ${newEscalationLevel}`,
            escalatedByName: 'System Automated SLA Engine',
            escalatedAt: now
          });
          await log.save();

          // Dispatch Notification
          try {
            if (newEscalationLevel === 1) {
              await notifySlaWarning({ complaint, remainingHours });
            } else if (newEscalationLevel === 2) {
              await notifySlaBreach({ complaint, overdueHours });
            } else if (newEscalationLevel === 3) {
              await notifySlaEscalation({ complaint, escalationLevel: 3, reason: triggerReason });
            }
          } catch (notifErr) {
            console.warn(`[SLA Monitor] Notification dispatch error for ${complaint.complaintId}:`, notifErr.message);
          }
        }

        await complaint.save();
      } catch (err) {
        summary.errors.push({ complaintId: complaint.complaintId, error: err.message });
      }
    }
  } finally {
    isEvaluating = false;
  }

  return summary;
};

/**
 * Starts background SLA monitoring scheduler
 * @param {object} [options]
 * @param {number} [options.intervalMs=60000] - Evaluation interval in milliseconds
 */
export const startSlaScheduler = ({ intervalMs = 60000 } = {}) => {
  if (schedulerTimer) {
    return;
  }

  // Initial evaluation pass upon startup
  setImmediate(() => {
    evaluateSlaComplaints().catch((err) => {
      console.warn('[SLA Scheduler] Initial evaluation error:', err.message);
    });
  });

  schedulerTimer = setInterval(() => {
    evaluateSlaComplaints().catch((err) => {
      console.warn('[SLA Scheduler] Background evaluation error:', err.message);
    });
  }, intervalMs);

  if (schedulerTimer.unref) {
    schedulerTimer.unref(); // Prevent timer from keeping Node process alive if everything else exits
  }

  console.log(`[SLA Scheduler] Started background monitoring (interval: ${intervalMs}ms)`);
};

/**
 * Stops background SLA monitoring scheduler
 */
export const stopSlaScheduler = () => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log('[SLA Scheduler] Stopped background monitoring');
  }
};

export default {
  evaluateSlaComplaints,
  startSlaScheduler,
  stopSlaScheduler
};
