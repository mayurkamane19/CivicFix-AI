import mongoose from 'mongoose';

export const ESCALATION_LEVELS = [0, 1, 2, 3];
export const ESCALATION_TRIGGER_TYPES = ['AUTOMATIC_TIMEOUT', 'MANUAL_ADMIN'];

/**
 * EscalationLog Schema
 * Immutable operational audit trail of all complaint escalation events,
 * tracking level changes, trigger reasons, responsible personnel, and notification dispatches.
 */
const escalationLogSchema = new mongoose.Schema(
  {
    complaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      required: [true, 'Complaint reference is required'],
      index: true
    },
    complaintId: {
      type: String,
      required: [true, 'Complaint ticket ID is required'],
      trim: true,
      index: true
    },
    previousLevel: {
      type: Number,
      enum: ESCALATION_LEVELS,
      required: [true, 'Previous escalation level is required']
    },
    newLevel: {
      type: Number,
      enum: [1, 2, 3],
      required: [true, 'New escalation level is required'],
      index: true
    },
    triggerType: {
      type: String,
      enum: ESCALATION_TRIGGER_TYPES,
      default: 'AUTOMATIC_TIMEOUT'
    },
    triggerReason: {
      type: String,
      required: [true, 'Escalation trigger reason is required'],
      trim: true,
      maxlength: [1000, 'Trigger reason cannot exceed 1000 characters']
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true
    },
    departmentName: {
      type: String,
      trim: true,
      default: 'Unassigned'
    },
    assignedOfficer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    assignedOfficerName: {
      type: String,
      trim: true,
      default: null
    },
    notificationStatus: {
      type: String,
      enum: ['Sent', 'Pending', 'Failed', 'Skipped'],
      default: 'Sent'
    },
    notifiedRecipients: [
      {
        email: { type: String, trim: true, lowercase: true },
        role: { type: String, trim: true },
        name: { type: String, trim: true }
      }
    ],
    actionTaken: {
      type: String,
      trim: true,
      default: 'Complaint priority elevated and responsible supervisors notified'
    },
    escalatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    escalatedByName: {
      type: String,
      trim: true,
      default: 'System Automated Monitor'
    },
    escalatedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Query optimization compound indexes
escalationLogSchema.index({ complaintId: 1, escalatedAt: -1 });
escalationLogSchema.index({ department: 1, escalatedAt: -1 });
escalationLogSchema.index({ newLevel: 1, escalatedAt: -1 });
escalationLogSchema.index({ complaint: 1, newLevel: 1 });

/**
 * Returns safe public/admin representation of escalation log
 * @returns {object}
 */
escalationLogSchema.methods.toSafeObject = function () {
  return {
    id: this._id ? this._id.toString() : undefined,
    complaintId: this.complaintId,
    previousLevel: this.previousLevel,
    newLevel: this.newLevel,
    triggerType: this.triggerType,
    triggerReason: this.triggerReason,
    departmentName: this.departmentName || 'Unassigned',
    assignedOfficerName: this.assignedOfficerName || null,
    notificationStatus: this.notificationStatus,
    notifiedRecipients: (this.notifiedRecipients || []).map((r) => ({
      role: r.role,
      name: r.name
    })),
    actionTaken: this.actionTaken,
    escalatedByName: this.escalatedByName || 'System Automated Monitor',
    escalatedAt: this.escalatedAt || this.createdAt
  };
};

export const EscalationLog = mongoose.model('EscalationLog', escalationLogSchema);

export default EscalationLog;
