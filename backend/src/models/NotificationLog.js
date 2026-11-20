import mongoose from 'mongoose';

export const NOTIFICATION_EVENT_TYPES = [
  'COMPLAINT_SUBMISSION',
  'STATUS_UPDATE',
  'DEPARTMENT_ASSIGNED',
  'OFFICER_ASSIGNED',
  'COMPLAINT_RESOLVED',
  'COMPLAINT_REOPENED',
  'SLA_APPROACHING_DEADLINE',
  'SLA_BREACH',
  'SLA_ESCALATION_LEVEL_1',
  'SLA_ESCALATION_LEVEL_2',
  'SLA_ESCALATION_LEVEL_3',
  'MANUAL_ESCALATION',
  'FEEDBACK_RECEIVED',
  'SYSTEM_ANNOUNCEMENT',
  'RESOLUTION_SUBMITTED',
  'RESOLUTION_VERIFIED',
  'RESOLUTION_REJECTED',
  'ADMIN_REVIEW_REQUIRED'
];

export const NOTIFICATION_CATEGORIES = [
  'submission',
  'status',
  'assignment',
  'resolution',
  'reopened',
  'sla_warning',
  'sla_breach',
  'escalation',
  'feedback',
  'announcement',
  'general'
];

export const DELIVERY_STATUSES = ['Pending', 'Processing', 'Sent', 'Failed', 'Skipped'];

/**
 * Maps eventType to unified category string
 * @param {string} eventType
 * @returns {string}
 */
export const mapEventToCategory = (eventType) => {
  switch (eventType) {
    case 'COMPLAINT_SUBMISSION':
      return 'submission';
    case 'STATUS_UPDATE':
      return 'status';
    case 'DEPARTMENT_ASSIGNED':
    case 'OFFICER_ASSIGNED':
      return 'assignment';
    case 'COMPLAINT_RESOLVED':
    case 'RESOLUTION_SUBMITTED':
    case 'RESOLUTION_VERIFIED':
    case 'RESOLUTION_REJECTED':
      return 'resolution';
    case 'COMPLAINT_REOPENED':
      return 'reopened';
    case 'SLA_APPROACHING_DEADLINE':
      return 'sla_warning';
    case 'SLA_BREACH':
      return 'sla_breach';
    case 'SLA_ESCALATION_LEVEL_1':
    case 'SLA_ESCALATION_LEVEL_2':
    case 'SLA_ESCALATION_LEVEL_3':
    case 'MANUAL_ESCALATION':
    case 'ADMIN_REVIEW_REQUIRED':
      return 'escalation';
    case 'FEEDBACK_RECEIVED':
      return 'feedback';
    case 'SYSTEM_ANNOUNCEMENT':
      return 'announcement';
    default:
      return 'general';
  }
};

/**
 * NotificationLog Schema
 * Unified durable outbox, in-app notification inbox, and operational audit log.
 */
const notificationLogSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: [true, 'Event type is required'],
      enum: {
        values: NOTIFICATION_EVENT_TYPES,
        message: '{VALUE} is not a valid notification event type'
      },
      index: true
    },
    title: {
      type: String,
      trim: true,
      default: ''
    },
    message: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      enum: {
        values: NOTIFICATION_CATEGORIES,
        message: '{VALUE} is not a valid notification category'
      },
      default: 'general',
      index: true
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
      index: true
    },
    complaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      default: null,
      index: true
    },
    complaintId: {
      type: String,
      trim: true,
      default: null,
      index: true
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null
    },
    recipientEmail: {
      type: String,
      required: [true, 'Recipient email is required'],
      trim: true,
      lowercase: true,
      index: true
    },
    recipientUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    recipientRole: {
      type: String,
      enum: ['citizen', 'officer', 'admin'],
      default: 'citizen',
      index: true
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date,
      default: null
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true
    },
    actionUrl: {
      type: String,
      trim: true,
      default: null
    },
    deliveryStatus: {
      type: String,
      enum: {
        values: DELIVERY_STATUSES,
        message: '{VALUE} is not a valid delivery status'
      },
      default: 'Pending',
      index: true
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0
    },
    maxRetries: {
      type: Number,
      default: 3
    },
    lastError: {
      type: String,
      default: null
    },
    sentAt: {
      type: Date,
      default: null
    },
    idempotencyKey: {
      type: String,
      required: [true, 'Idempotency key is required'],
      unique: true,
      trim: true,
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook: auto-fill title, message, category if absent
notificationLogSchema.pre('save', function (next) {
  if (!this.title && this.subject) {
    this.title = this.subject;
  }
  if (!this.category && this.eventType) {
    this.category = mapEventToCategory(this.eventType);
  }
  if (typeof next === 'function') next();
});

// Compound indexes for user inbox queries and queue worker queries
notificationLogSchema.index({ recipientUser: 1, isArchived: 1, isRead: 1, createdAt: -1 });
notificationLogSchema.index({ recipientUser: 1, isArchived: 1, category: 1, createdAt: -1 });
notificationLogSchema.index({ deliveryStatus: 1, retryCount: 1, createdAt: 1 });
notificationLogSchema.index({ complaintId: 1, createdAt: -1 });
notificationLogSchema.index({ recipientEmail: 1, createdAt: -1 });

/**
 * Returns safe public/admin representation of notification record
 * @returns {object}
 */
notificationLogSchema.methods.toSafeObject = function () {
  return {
    id: this._id ? this._id.toString() : undefined,
    eventType: this.eventType,
    title: this.title || this.subject,
    subject: this.subject,
    message: this.message || this.metadata?.summary || '',
    category: this.category || mapEventToCategory(this.eventType),
    priority: this.priority || 'Medium',
    complaintId: this.complaintId || null,
    complaint: this.complaint ? (this.complaint._id ? this.complaint._id.toString() : this.complaint.toString()) : null,
    recipientEmail: this.recipientEmail,
    recipientUser: this.recipientUser ? (this.recipientUser._id ? this.recipientUser._id.toString() : this.recipientUser.toString()) : null,
    recipientRole: this.recipientRole,
    isRead: Boolean(this.isRead),
    readAt: this.readAt || null,
    isArchived: Boolean(this.isArchived),
    actionUrl: this.actionUrl || null,
    deliveryStatus: this.deliveryStatus,
    retryCount: this.retryCount,
    maxRetries: this.maxRetries,
    lastError: this.lastError,
    sentAt: this.sentAt,
    idempotencyKey: this.idempotencyKey,
    metadata: this.metadata,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

export const NotificationLog = mongoose.model('NotificationLog', notificationLogSchema);

export default NotificationLog;
