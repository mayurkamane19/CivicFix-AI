import mongoose from 'mongoose';

export const NOTIFICATION_EVENT_TYPES = [
  'COMPLAINT_SUBMISSION',
  'STATUS_UPDATE',
  'DEPARTMENT_ASSIGNED',
  'OFFICER_ASSIGNED',
  'COMPLAINT_RESOLVED',
  'SLA_APPROACHING_DEADLINE',
  'SLA_BREACH',
  'SLA_ESCALATION_LEVEL_1',
  'SLA_ESCALATION_LEVEL_2',
  'SLA_ESCALATION_LEVEL_3',
  'MANUAL_ESCALATION'
];

export const DELIVERY_STATUSES = ['Pending', 'Processing', 'Sent', 'Failed'];

/**
 * NotificationLog Schema
 * Durable outbox and operational audit log for all system email notifications.
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
    complaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      required: [true, 'Complaint reference is required']
    },
    complaintId: {
      type: String,
      required: [true, 'Complaint ID is required'],
      trim: true,
      index: true
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
      default: null
    },
    recipientRole: {
      type: String,
      enum: ['citizen', 'officer', 'admin'],
      default: 'citizen'
    },
    subject: {
      type: String,
      required: [true, 'Email subject is required'],
      trim: true
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

// Compound indexes for queue worker and admin dashboard queries
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
    complaintId: this.complaintId,
    recipientEmail: this.recipientEmail,
    recipientRole: this.recipientRole,
    subject: this.subject,
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
