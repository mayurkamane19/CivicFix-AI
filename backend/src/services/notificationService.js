import mongoose from 'mongoose';
import { NotificationLog } from '../models/NotificationLog.js';
import { User } from '../models/User.js';
import { config } from '../config/env.js';
import {
  renderComplaintSubmissionEmail,
  renderComplaintStatusUpdateEmail,
  renderDepartmentAssignmentEmail,
  renderOfficerAssignmentEmail,
  renderComplaintResolutionEmail
} from './emailTemplates.js';
import { sendMailAsync } from './emailService.js';

/**
 * Builds the canonical public tracking URL for a given complaint
 * @param {string} complaintId
 * @returns {string}
 */
export const buildTrackingUrl = (complaintId) => {
  const base = (config.frontendUrl || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/#track?id=${encodeURIComponent(complaintId)}`;
};

/**
 * Builds the field officer portal URL
 * @returns {string}
 */
export const buildOfficerPortalUrl = () => {
  const base = (config.frontendUrl || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/#officer`;
};

/**
 * Queues a notification into the durable MongoDB outbox
 * Strictly prevents duplicate event execution using unique idempotency keys
 * 
 * @param {object} params
 * @param {string} params.eventType
 * @param {object} params.complaint
 * @param {string} params.recipientEmail
 * @param {string} [params.recipientUser]
 * @param {string} [params.recipientRole='citizen']
 * @param {string} params.subject
 * @param {string} params.html
 * @param {string} params.text
 * @param {string} params.idempotencyKey
 * @param {object} [params.metadata={}]
 * @returns {Promise<object>} Created or existing NotificationLog document
 */
export const queueNotification = async ({
  eventType,
  complaint,
  recipientEmail,
  recipientUser = null,
  recipientRole = 'citizen',
  subject,
  html,
  text,
  idempotencyKey,
  metadata = {}
}) => {
  if (!eventType || !complaint || !recipientEmail || !subject || !idempotencyKey) {
    throw new Error('Missing required notification parameters');
  }

  // 1. Idempotency Check: Return existing log if this exact event was already registered
  const existingLog = await NotificationLog.findOne({ idempotencyKey });
  if (existingLog) {
    return existingLog;
  }

  // 2. Persist in durable outbox
  try {
    const notification = new NotificationLog({
      eventType,
      complaint: complaint._id || complaint.id,
      complaintId: complaint.complaintId,
      recipientEmail: recipientEmail.trim().toLowerCase(),
      recipientUser: recipientUser || null,
      recipientRole,
      subject,
      deliveryStatus: 'Pending',
      retryCount: 0,
      maxRetries: 3,
      idempotencyKey,
      metadata: {
        ...metadata,
        html,
        text
      }
    });

    await notification.save();

    // 3. Trigger asynchronous background dispatch worker without blocking caller
    setImmediate(() => {
      processNotificationAsync(notification._id).catch((err) => {
        console.warn(`[Notification Worker] Background dispatch error for ${notification._id}:`, err.message);
      });
    });

    return notification;
  } catch (err) {
    // Handle concurrent duplicate key race condition gracefully (E11000)
    if (err.code === 11000) {
      const raceExisting = await NotificationLog.findOne({ idempotencyKey });
      if (raceExisting) return raceExisting;
    }
    throw err;
  }
};

/**
 * Worker: Processes a pending notification from the outbox
 * Implements atomic status transition and bounded retries
 * 
 * @param {string|mongoose.Types.ObjectId} notificationId
 * @returns {Promise<object>}
 */
export const processNotificationAsync = async (notificationId) => {
  // 1. Atomically lock notification in 'Processing' state
  const log = await NotificationLog.findOneAndUpdate(
    { _id: notificationId, deliveryStatus: { $in: ['Pending', 'Processing'] } },
    { deliveryStatus: 'Processing' },
    { new: true }
  );

  if (!log) {
    return null; // Already processed or not found
  }

  try {
    const html = log.metadata?.html;
    const text = log.metadata?.text;

    // 2. Attempt email dispatch via Nodemailer service
    await sendMailAsync({
      to: log.recipientEmail,
      subject: log.subject,
      html,
      text
    });

    // 3. Mark as Sent
    log.deliveryStatus = 'Sent';
    log.sentAt = new Date();
    log.lastError = null;
    await log.save();

    return log;
  } catch (err) {
    log.retryCount = (log.retryCount || 0) + 1;
    log.lastError = err.message || 'Unknown delivery failure';

    if (log.retryCount >= log.maxRetries) {
      log.deliveryStatus = 'Failed';
    } else {
      log.deliveryStatus = 'Pending'; // Eligible for retry sweep
    }

    await log.save();
    return log;
  }
};

// -----------------------------------------------------------------------------
// HIGH-LEVEL EVENT TRIGGERS (Strict Non-Breaking Error Boundaries)
// -----------------------------------------------------------------------------

/**
 * Event: Complaint Submitted
 * Sends submission confirmation with tracking link if citizen provided valid email and consent
 * @param {object} complaint
 * @returns {Promise<object | null>}
 */
export const notifyComplaintSubmitted = async (complaint) => {
  try {
    if (!complaint || !complaint.complaintId) return null;

    // Respect Consent: Verify recipient email and explicit notification opt-in
    const recipientEmail = complaint.citizenEmail;
    const isConsentGiven = complaint.emailNotificationsEnabled === true;

    if (!recipientEmail || !isConsentGiven) {
      return null; // Explicit opt-in not granted; zero unsolicited email sent
    }

    const trackingUrl = buildTrackingUrl(complaint.complaintId);

    const emailContent = renderComplaintSubmissionEmail({
      complaintId: complaint.complaintId,
      title: complaint.title,
      category: complaint.category,
      submissionDate: complaint.createdAt,
      trackingUrl
    });

    return await queueNotification({
      eventType: 'COMPLAINT_SUBMISSION',
      complaint,
      recipientEmail,
      recipientUser: complaint.reportedBy || null,
      recipientRole: 'citizen',
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      idempotencyKey: `SUBMISSION_${complaint.complaintId}`,
      metadata: {
        title: complaint.title,
        category: complaint.category
      }
    });
  } catch (err) {
    console.warn(`[Notification] Failed to queue submission notification for ${complaint?.complaintId}:`, err.message);
    return null; // Never throw: complaint creation must never fail due to notification
  }
};

/**
 * Event: Complaint Status Updated or Resolved
 * Sends progress or resolution update to citizen if opt-in consent exists
 * @param {object} complaint
 * @param {object} params
 * @param {string} params.previousStatus
 * @param {string} params.newStatus
 * @param {string} [params.note='']
 * @param {string} [params.changedByName='Municipal Operations']
 * @returns {Promise<object | null>}
 */
export const notifyStatusUpdated = async (
  complaint,
  { previousStatus, newStatus, note = '', changedByName = 'Municipal Operations' }
) => {
  try {
    if (!complaint || !complaint.complaintId) return null;

    // Suppress notification if status did not actually change
    if (previousStatus === newStatus) {
      return null;
    }

    // Verify recipient email and consent
    const recipientEmail = complaint.citizenEmail;
    const isConsentGiven = complaint.emailNotificationsEnabled === true;

    if (!recipientEmail || !isConsentGiven) {
      return null;
    }

    const trackingUrl = buildTrackingUrl(complaint.complaintId);
    const historyIndex = (complaint.statusHistory?.length || 1);

    if (newStatus === 'Resolved') {
      // Event: COMPLAINT_RESOLVED
      const emailContent = renderComplaintResolutionEmail({
        complaintId: complaint.complaintId,
        title: complaint.title,
        resolutionDate: new Date(),
        note,
        trackingUrl
      });

      return await queueNotification({
        eventType: 'COMPLAINT_RESOLVED',
        complaint,
        recipientEmail,
        recipientUser: complaint.reportedBy || null,
        recipientRole: 'citizen',
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        idempotencyKey: `RESOLVED_${complaint.complaintId}`, // Unique key ensures single resolution notice
        metadata: {
          title: complaint.title,
          previousStatus,
          newStatus: 'Resolved',
          note,
          changedByName
        }
      });
    }

    // Event: STATUS_UPDATE
    const emailContent = renderComplaintStatusUpdateEmail({
      complaintId: complaint.complaintId,
      title: complaint.title,
      previousStatus,
      newStatus,
      note,
      updateDate: new Date(),
      trackingUrl
    });

    return await queueNotification({
      eventType: 'STATUS_UPDATE',
      complaint,
      recipientEmail,
      recipientUser: complaint.reportedBy || null,
      recipientRole: 'citizen',
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      idempotencyKey: `STATUS_${complaint.complaintId}_${newStatus}_${historyIndex}`,
      metadata: {
        title: complaint.title,
        previousStatus,
        newStatus,
        note,
        changedByName
      }
    });
  } catch (err) {
    console.warn(`[Notification] Failed to queue status update notification for ${complaint?.complaintId}:`, err.message);
    return null;
  }
};

/**
 * Event: Department Assigned
 * Notifies the eligible citizen of departmental dispatch
 * @param {object} complaint
 * @param {object} params
 * @param {string} params.departmentName
 * @returns {Promise<object | null>}
 */
export const notifyDepartmentAssigned = async (complaint, { departmentName }) => {
  try {
    if (!complaint || !complaint.complaintId || !departmentName) return null;

    const recipientEmail = complaint.citizenEmail;
    const isConsentGiven = complaint.emailNotificationsEnabled === true;

    if (!recipientEmail || !isConsentGiven) {
      return null;
    }

    const trackingUrl = buildTrackingUrl(complaint.complaintId);
    const historyIndex = (complaint.assignmentHistory?.length || 1);

    const emailContent = renderDepartmentAssignmentEmail({
      complaintId: complaint.complaintId,
      title: complaint.title,
      departmentName,
      trackingUrl
    });

    return await queueNotification({
      eventType: 'DEPARTMENT_ASSIGNED',
      complaint,
      recipientEmail,
      recipientUser: complaint.reportedBy || null,
      recipientRole: 'citizen',
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      idempotencyKey: `DEPT_${complaint.complaintId}_${departmentName}_${historyIndex}`,
      metadata: {
        title: complaint.title,
        departmentName
      }
    });
  } catch (err) {
    console.warn(`[Notification] Failed to queue department assignment notification for ${complaint?.complaintId}:`, err.message);
    return null;
  }
};

/**
 * Event: Officer Assigned
 * Notifies the assigned field officer of a new field task
 * @param {object} complaint
 * @param {object} params
 * @param {object} params.officer - Assigned field officer document
 * @param {string} params.departmentName
 * @param {string} [params.note='']
 * @returns {Promise<object | null>}
 */
export const notifyOfficerAssigned = async (complaint, { officer, departmentName, note = '' }) => {
  try {
    if (!complaint || !complaint.complaintId || !officer || !officer.email) return null;

    const dashboardUrl = buildOfficerPortalUrl();
    const historyIndex = (complaint.assignmentHistory?.length || 1);

    const emailContent = renderOfficerAssignmentEmail({
      complaintId: complaint.complaintId,
      title: complaint.title,
      departmentName: departmentName || 'Municipal Operations',
      officerName: officer.name || 'Field Officer',
      note,
      dashboardUrl
    });

    return await queueNotification({
      eventType: 'OFFICER_ASSIGNED',
      complaint,
      recipientEmail: officer.email,
      recipientUser: officer._id || officer.id,
      recipientRole: 'officer',
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      idempotencyKey: `OFFICER_${complaint.complaintId}_${officer._id || officer.id}_${historyIndex}`,
      metadata: {
        title: complaint.title,
        departmentName,
        officerName: officer.name,
        note
      }
    });
  } catch (err) {
    console.warn(`[Notification] Failed to queue officer assignment notification for ${complaint?.complaintId}:`, err.message);
    return null;
  }
};

/**
 * Service: Retrieves paginated notification audit logs for municipal administrators
 * @param {object} options
 * @returns {Promise<object>}
 */
export const getAdminNotificationLogs = async ({
  status = '',
  eventType = '',
  complaintId = '',
  page = 1,
  limit = 20
} = {}) => {
  const filterQuery = {};

  if (status && status !== 'all') {
    filterQuery.deliveryStatus = status;
  }

  if (eventType && eventType !== 'all') {
    filterQuery.eventType = eventType;
  }

  if (complaintId && complaintId.trim() !== '') {
    filterQuery.complaintId = { $regex: complaintId.trim(), $options: 'i' };
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  const [logs, total] = await Promise.all([
    NotificationLog.find(filterQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    NotificationLog.countDocuments(filterQuery)
  ]);

  return {
    notifications: logs.map((l) => ({
      id: l._id.toString(),
      eventType: l.eventType,
      complaintId: l.complaintId,
      recipientEmail: l.recipientEmail,
      recipientRole: l.recipientRole,
      subject: l.subject,
      deliveryStatus: l.deliveryStatus,
      retryCount: l.retryCount,
      maxRetries: l.maxRetries,
      lastError: l.lastError,
      sentAt: l.sentAt,
      idempotencyKey: l.idempotencyKey,
      createdAt: l.createdAt
    })),
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
      hasNextPage: safePage < (Math.ceil(total / safeLimit) || 1),
      hasPrevPage: safePage > 1
    }
  };
};

export default {
  buildTrackingUrl,
  buildOfficerPortalUrl,
  queueNotification,
  processNotificationAsync,
  notifyComplaintSubmitted,
  notifyStatusUpdated,
  notifyDepartmentAssigned,
  notifyOfficerAssigned,
  getAdminNotificationLogs
};
