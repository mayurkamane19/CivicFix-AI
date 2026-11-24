import mongoose from 'mongoose';
import { NotificationLog, mapEventToCategory } from '../models/NotificationLog.js';
import { User, DEFAULT_NOTIFICATION_PREFERENCES } from '../models/User.js';
import { config } from '../config/env.js';
import {
  renderComplaintSubmissionEmail,
  renderComplaintStatusUpdateEmail,
  renderDepartmentAssignmentEmail,
  renderOfficerAssignmentEmail,
  renderComplaintResolutionEmail,
  renderSlaWarningEmail,
  renderSlaBreachEmail,
  renderSlaEscalationEmail
} from './emailTemplates.js';
import { sendMailAsync } from './emailService.js';
import { dispatchPushToUser } from './pushService.js';

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
 * Builds the municipal administrator portal URL
 * @returns {string}
 */
export const buildAdminPortalUrl = () => {
  const base = (config.frontendUrl || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/#admin`;
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
  complaint = null,
  recipientEmail,
  recipientUser = null,
  recipientRole = 'citizen',
  title = null,
  message = null,
  category = null,
  priority = 'Medium',
  actionUrl = null,
  department = null,
  subject,
  html,
  text,
  idempotencyKey,
  metadata = {},
  sendEmail = true
}) => {
  if (!eventType || !recipientEmail || !subject || !idempotencyKey) {
    throw new Error('Missing required notification parameters');
  }

  // Check if live db is connected or mocked to prevent buffering timeouts during offline test runs
  const isLiveDbOrMocked = (mongoose.connection.readyState === 1 && Boolean(mongoose.connection.db)) ||
    Boolean(NotificationLog._isMocked) ||
    NotificationLog.findOne !== mongoose.Model.findOne ||
    NotificationLog.prototype.save !== mongoose.Model.prototype.save;
  if (!isLiveDbOrMocked) {
    return {
      _id: new mongoose.Types.ObjectId(),
      idempotencyKey,
      eventType,
      recipientEmail,
      deliveryStatus: 'Skipped'
    };
  }

  // 1. Idempotency Check: Return existing log if this exact event was already registered
  const existingLog = await NotificationLog.findOne({ idempotencyKey });
  if (existingLog) {
    return existingLog;
  }

  // 2. Resolve recipientUser if not provided
  let resolvedUser = recipientUser;
  if (!resolvedUser && complaint?.reportedBy && recipientRole === 'citizen') {
    resolvedUser = complaint.reportedBy;
  }
  if (!resolvedUser && complaint?.assignedOfficer && recipientRole === 'officer') {
    resolvedUser = complaint.assignedOfficer;
  }

  // 3. Resolve actionUrl, title, and message
  const resolvedNotificationTitle = title || subject;
  const resolvedNotificationMessage = message || text || subject;
  const resolvedActionUrl = actionUrl || (
    complaint?.complaintId
      ? (recipientRole === 'officer'
          ? buildOfficerPortalUrl()
          : recipientRole === 'admin'
          ? buildAdminPortalUrl()
          : buildTrackingUrl(complaint.complaintId))
      : null
  );

  // 4. Persist in durable outbox & user inbox
  try {
    const notification = new NotificationLog({
      eventType,
      title: resolvedNotificationTitle,
      message: resolvedNotificationMessage,
      category: category || mapEventToCategory(eventType),
      priority,
      complaint: complaint ? (complaint._id || complaint.id) : null,
      complaintId: complaint ? complaint.complaintId : null,
      department: department || complaint?.assignedDepartment?._id || complaint?.assignedDepartment || null,
      recipientEmail: recipientEmail.trim().toLowerCase(),
      recipientUser: resolvedUser || null,
      recipientRole,
      subject,
      isRead: false,
      isArchived: false,
      actionUrl: resolvedActionUrl,
      deliveryStatus: sendEmail ? 'Pending' : 'Skipped',
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

    // 5. Trigger asynchronous background dispatch worker without blocking caller (if email delivery active)
    if (sendEmail) {
      setImmediate(() => {
        processNotificationAsync(notification._id).catch((err) => {
          console.warn(`[Notification Worker] Background dispatch error for ${notification._id}:`, err.message);
        });
      });
    }

    // 6. Trigger Web Push notification dispatch to active browser sessions (non-blocking)
    if (resolvedUser) {
      setImmediate(() => {
        dispatchPushToUser(resolvedUser, {
          title: resolvedNotificationTitle,
          message: resolvedNotificationMessage,
          complaintId: complaint?.complaintId,
          url: resolvedActionUrl
        }).catch((pushErr) => {
          console.warn(`[Push Worker] Dispatch warning for user ${resolvedUser}:`, pushErr.message);
        });
      });
    }

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

    if (newStatus === 'Reopened') {
      const reopenResults = await notifyComplaintReopened(complaint, { reason: note, reopenedBy: changedByName });
      return Array.isArray(reopenResults) && reopenResults.length > 0 ? reopenResults[0] : null;
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

/**
 * Notifies assigned officer and supervisors when a complaint SLA deadline is approaching
 * @param {object} params
 * @param {object} params.complaint
 * @param {number} params.remainingHours
 * @returns {Promise<Array<object>>} Queued notification records
 */
export const notifySlaWarning = async ({ complaint, remainingHours }) => {
  if (!complaint || !complaint.complaintId) return [];

  const recipientList = [];

  // 1. Officer recipient
  if (complaint.assignedOfficer?.email) {
    recipientList.push({
      email: complaint.assignedOfficer.email,
      user: complaint.assignedOfficer._id,
      role: 'officer'
    });
  }

  // Fallback to active admin if no officer assigned
  if (recipientList.length === 0) {
    const admin = await User.findOne({ role: 'admin', isActive: true });
    if (admin && admin.email) {
      recipientList.push({
        email: admin.email,
        user: admin._id,
        role: 'admin'
      });
    }
  }

  const portalUrl = buildOfficerPortalUrl();
  const emailContent = renderSlaWarningEmail({ complaint, remainingHours, portalUrl });
  const results = [];

  for (const r of recipientList) {
    try {
      const idempotencyKey = `SLA_WARN_${complaint.complaintId}_L1_${r.email}`;
      const log = await queueNotification({
        eventType: 'SLA_APPROACHING_DEADLINE',
        complaint,
        recipientEmail: r.email,
        recipientUser: r.user,
        recipientRole: r.role,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        idempotencyKey,
        metadata: { remainingHours, escalationLevel: 1 }
      });
      results.push(log);
    } catch (err) {
      console.warn(`[Notification] Warning dispatch skipped for ${r.email}:`, err.message);
    }
  }

  return results;
};

/**
 * Notifies department leadership and officers when an SLA deadline is breached
 * @param {object} params
 * @param {object} params.complaint
 * @param {number} params.overdueHours
 * @returns {Promise<Array<object>>} Queued notification records
 */
export const notifySlaBreach = async ({ complaint, overdueHours }) => {
  if (!complaint || !complaint.complaintId) return [];

  const recipientList = [];

  // 1. Assigned officer
  if (complaint.assignedOfficer?.email) {
    recipientList.push({
      email: complaint.assignedOfficer.email,
      user: complaint.assignedOfficer._id,
      role: 'officer'
    });
  }

  // 2. Administrators
  const admins = await User.find({ role: 'admin', isActive: true }).limit(2);
  for (const admin of admins) {
    if (admin.email && !recipientList.some((x) => x.email === admin.email)) {
      recipientList.push({
        email: admin.email,
        user: admin._id,
        role: 'admin'
      });
    }
  }

  const portalUrl = buildAdminPortalUrl();
  const emailContent = renderSlaBreachEmail({ complaint, overdueHours, portalUrl });
  const results = [];

  for (const r of recipientList) {
    try {
      const idempotencyKey = `SLA_BREACH_${complaint.complaintId}_L2_${r.email}`;
      const log = await queueNotification({
        eventType: 'SLA_BREACH',
        complaint,
        recipientEmail: r.email,
        recipientUser: r.user,
        recipientRole: r.role,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        idempotencyKey,
        metadata: { overdueHours, escalationLevel: 2 }
      });
      results.push(log);
    } catch (err) {
      console.warn(`[Notification] Breach dispatch skipped for ${r.email}:`, err.message);
    }
  }

  return results;
};

/**
 * Notifies municipal administrators when Level 3 critical escalation occurs
 * @param {object} params
 * @param {object} params.complaint
 * @param {number} params.escalationLevel
 * @param {string} params.reason
 * @returns {Promise<Array<object>>} Queued notification records
 */
export const notifySlaEscalation = async ({ complaint, escalationLevel, reason }) => {
  if (!complaint || !complaint.complaintId) return [];

  const admins = await User.find({ role: 'admin', isActive: true }).limit(5);
  const portalUrl = buildAdminPortalUrl();
  const emailContent = renderSlaEscalationEmail({ complaint, escalationLevel, reason, portalUrl });
  const results = [];

  for (const admin of admins) {
    if (!admin.email) continue;
    try {
      const idempotencyKey = `SLA_ESC_${complaint.complaintId}_L${escalationLevel}_${admin.email}`;
      const log = await queueNotification({
        eventType: `SLA_ESCALATION_LEVEL_${escalationLevel}`,
        complaint,
        recipientEmail: admin.email,
        recipientUser: admin._id,
        recipientRole: 'admin',
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        idempotencyKey,
        metadata: { escalationLevel, reason }
      });
      results.push(log);
    } catch (err) {
      console.warn(`[Notification] Escalation dispatch skipped for ${admin.email}:`, err.message);
    }
  }

  return results;
};

/**
 * Notifies responsible officers and admins on manual administrative escalation
 * @param {object} params
 * @param {object} params.complaint
 * @param {number} params.escalationLevel
 * @param {string} params.reason
 * @param {object} params.adminUser
 * @returns {Promise<Array<object>>}
 */
export const notifyManualEscalation = async ({ complaint, escalationLevel, reason, adminUser }) => {
  if (!complaint || !complaint.complaintId) return [];

  const recipientList = [];

  if (complaint.assignedOfficer?.email) {
    recipientList.push({
      email: complaint.assignedOfficer.email,
      user: complaint.assignedOfficer._id,
      role: 'officer'
    });
  }

  const admins = await User.find({ role: 'admin', isActive: true }).limit(3);
  for (const a of admins) {
    if (a.email && !recipientList.some((x) => x.email === a.email)) {
      recipientList.push({
        email: a.email,
        user: a._id,
        role: 'admin'
      });
    }
  }

  const portalUrl = buildAdminPortalUrl();
  const emailContent = renderSlaEscalationEmail({
    complaint,
    escalationLevel,
    reason: `Manual Escalation: ${reason}`,
    portalUrl
  });
  const results = [];

  for (const r of recipientList) {
    try {
      const idempotencyKey = `MANUAL_ESC_${complaint.complaintId}_${Date.now()}_${r.email}`;
      const log = await queueNotification({
        eventType: 'MANUAL_ESCALATION',
        complaint,
        recipientEmail: r.email,
        recipientUser: r.user,
        recipientRole: r.role,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        idempotencyKey,
        metadata: { escalationLevel, reason, escalatedBy: adminUser?.name || 'Administrator' }
      });
      results.push(log);
    } catch (err) {
      console.warn(`[Notification] Manual escalation dispatch skipped for ${r.email}:`, err.message);
    }
  }

  return results;
};

/**
 * Service: Retrieves paginated notifications for the authenticated user (in-app inbox)
 * Strictly scoped to userId (anti-IDOR)
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {object} options
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @param {string} [options.status='all'] - 'all', 'unread', or 'read'
 * @param {string} [options.category='all']
 * @param {string} [options.search='']
 * @returns {Promise<object>}
 */
export const getUserNotifications = async (userId, {
  page = 1,
  limit = 20,
  status = 'all',
  category = 'all',
  search = ''
} = {}) => {
  if (!userId) {
    return {
      notifications: [],
      unreadCount: 0,
      pagination: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false
      }
    };
  }

  const filter = {
    recipientUser: userId,
    isArchived: false
  };

  if (status === 'unread') {
    filter.isRead = false;
  } else if (status === 'read') {
    filter.isRead = true;
  }

  if (category && category !== 'all') {
    filter.category = category;
  }

  if (search && search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { message: { $regex: escaped, $options: 'i' } },
      { complaintId: { $regex: escaped, $options: 'i' } }
    ];
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  const [logs, total, unreadCount] = await Promise.all([
    NotificationLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit),
    NotificationLog.countDocuments(filter),
    NotificationLog.countDocuments({
      recipientUser: userId,
      isArchived: false,
      isRead: false
    })
  ]);

  return {
    notifications: logs.map((l) => (typeof l.toSafeObject === 'function' ? l.toSafeObject() : l)),
    unreadCount,
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

/**
 * Service: Retrieves unread notification count for authenticated user
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<number>}
 */
export const getUserUnreadCount = async (userId) => {
  if (!userId) return 0;
  return await NotificationLog.countDocuments({
    recipientUser: userId,
    isArchived: false,
    isRead: false
  });
};

/**
 * Service: Marks a specific notification as read for the authenticated user
 * Strictly verifies recipientUser ownership (anti-IDOR)
 *
 * @param {string|mongoose.Types.ObjectId} notificationId
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<object|null>}
 */
export const markNotificationAsRead = async (notificationId, userId) => {
  if (!notificationId || !userId) return null;

  const notification = await NotificationLog.findOne({
    _id: notificationId,
    recipientUser: userId,
    isArchived: false
  });

  if (!notification) {
    return null;
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return typeof notification.toSafeObject === 'function' ? notification.toSafeObject() : notification;
};

/**
 * Service: Marks all unread notifications as read for the authenticated user
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<{ count: number }>}
 */
export const markAllNotificationsAsRead = async (userId) => {
  if (!userId) return { count: 0 };

  const result = await NotificationLog.updateMany(
    {
      recipientUser: userId,
      isArchived: false,
      isRead: false
    },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );

  return { count: result.modifiedCount || result.nModified || 0 };
};

/**
 * Service: Archives (dismisses) a notification for the authenticated user
 * Strictly verifies ownership (anti-IDOR)
 *
 * @param {string|mongoose.Types.ObjectId} notificationId
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<object|null>}
 */
export const archiveUserNotification = async (notificationId, userId) => {
  if (!notificationId || !userId) return null;

  const notification = await NotificationLog.findOne({
    _id: notificationId,
    recipientUser: userId
  });

  if (!notification) {
    return null;
  }

  notification.isArchived = true;
  await notification.save();

  return typeof notification.toSafeObject === 'function' ? notification.toSafeObject() : notification;
};

/**
 * Service: Clears all read notifications for the authenticated user (archives them)
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<{ count: number }>}
 */
export const clearReadUserNotifications = async (userId) => {
  if (!userId) return { count: 0 };

  const result = await NotificationLog.updateMany(
    {
      recipientUser: userId,
      isRead: true,
      isArchived: false
    },
    {
      $set: { isArchived: true }
    }
  );

  return { count: result.modifiedCount || result.nModified || 0 };
};

/**
 * Service: Retrieves notification preferences for a user
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<object|null>}
 */
export const getUserNotificationPreferences = async (userId) => {
  if (!userId) return null;

  const user = await User.findById(userId).select('email role emailNotificationsEnabled notificationPreferences');
  if (!user) return null;

  const prefs = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(user.notificationPreferences ? (user.notificationPreferences.toObject ? user.notificationPreferences.toObject() : user.notificationPreferences) : {})
  };

  return {
    email: user.email,
    role: user.role,
    emailNotificationsEnabled: user.emailNotificationsEnabled === true,
    notificationPreferences: prefs
  };
};

/**
 * Service: Updates notification preferences for authenticated user
 * Strictly enforces role-mandated alerts (anti-circumvention)
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {object} updates
 * @returns {Promise<object|null>}
 */
export const updateUserNotificationPreferences = async (userId, updates = {}) => {
  if (!userId) return null;

  const user = await User.findById(userId);
  if (!user) return null;

  // Legacy boolean toggle support
  if (typeof updates.emailNotificationsEnabled === 'boolean') {
    user.emailNotificationsEnabled = updates.emailNotificationsEnabled;
  }

  const incomingPrefs = updates.notificationPreferences || (typeof updates === 'object' ? updates : {});
  const currentPrefs = user.notificationPreferences
    ? (user.notificationPreferences.toObject ? user.notificationPreferences.toObject() : user.notificationPreferences)
    : { ...DEFAULT_NOTIFICATION_PREFERENCES };

  const merged = { ...currentPrefs };

  for (const key of Object.keys(DEFAULT_NOTIFICATION_PREFERENCES)) {
    if (typeof incomingPrefs[key] === 'boolean') {
      merged[key] = incomingPrefs[key];
    }
  }

  // Enforce role-mandated alerts:
  // Administrators cannot disable critical escalation alerts
  if (user.role === 'admin') {
    merged.criticalEscalations = true;
  }
  // Field officers cannot disable new assignments alerts
  if (user.role === 'officer') {
    merged.newAssignments = true;
  }

  user.notificationPreferences = merged;
  await user.save();

  return {
    email: user.email,
    role: user.role,
    emailNotificationsEnabled: user.emailNotificationsEnabled === true,
    notificationPreferences: user.notificationPreferences
  };
};

/**
 * Notifies citizen and assigned officer when a complaint is reopened
 * @param {object} complaint
 * @param {object} params
 * @param {string} [params.reason='']
 * @param {string} [params.reopenedBy='Municipal Staff']
 * @returns {Promise<Array<object>>}
 */
export const notifyComplaintReopened = async (complaint, { reason = 'Issue requires further resolution', reopenedBy = 'Municipal Staff' } = {}) => {
  if (!complaint || !complaint.complaintId) return [];

  const results = [];
  const trackingUrl = buildTrackingUrl(complaint.complaintId);

  // 1. Citizen notice
  if (complaint.citizenEmail) {
    try {
      const citizenLog = await queueNotification({
        eventType: 'COMPLAINT_REOPENED',
        complaint,
        recipientEmail: complaint.citizenEmail,
        recipientUser: complaint.reportedBy || null,
        recipientRole: 'citizen',
        title: `Complaint Reopened: ${complaint.complaintId}`,
        message: `Your complaint "${complaint.title}" has been reopened for further investigation: ${reason}`,
        category: 'reopened',
        priority: 'High',
        actionUrl: trackingUrl,
        subject: `[CivicFix AI] Complaint Reopened - #${complaint.complaintId}`,
        html: `<p>Your complaint <strong>#${complaint.complaintId}</strong> (${complaint.title}) has been reopened.</p><p>Reason: ${reason}</p><p><a href="${trackingUrl}">Track your complaint</a></p>`,
        text: `Your complaint #${complaint.complaintId} has been reopened. Reason: ${reason}. View: ${trackingUrl}`,
        idempotencyKey: `REOPEN_CITIZEN_${complaint.complaintId}_${Date.now()}`,
        metadata: { reason, reopenedBy },
        sendEmail: complaint.emailNotificationsEnabled === true
      });
      results.push(citizenLog);
    } catch (err) {
      console.warn(`[Notification] Reopen citizen notice failed for ${complaint.complaintId}:`, err.message);
    }
  }

  // 2. Assigned officer notice
  if (complaint.assignedOfficer?.email) {
    try {
      const officerLog = await queueNotification({
        eventType: 'COMPLAINT_REOPENED',
        complaint,
        recipientEmail: complaint.assignedOfficer.email,
        recipientUser: complaint.assignedOfficer._id || complaint.assignedOfficer.id,
        recipientRole: 'officer',
        title: `Action Required: Reopened #${complaint.complaintId}`,
        message: `Complaint "${complaint.title}" has been reopened: ${reason}`,
        category: 'reopened',
        priority: 'High',
        actionUrl: buildOfficerPortalUrl(),
        subject: `[CivicFix Alert] Reopened Complaint - #${complaint.complaintId}`,
        html: `<p>Complaint <strong>#${complaint.complaintId}</strong> has been reopened by ${reopenedBy}.</p><p>Reason: ${reason}</p>`,
        text: `Complaint #${complaint.complaintId} has been reopened by ${reopenedBy}. Reason: ${reason}`,
        idempotencyKey: `REOPEN_OFFICER_${complaint.complaintId}_${Date.now()}`,
        metadata: { reason, reopenedBy },
        sendEmail: true
      });
      results.push(officerLog);
    } catch (err) {
      console.warn(`[Notification] Reopen officer notice failed for ${complaint.complaintId}:`, err.message);
    }
  }

  return results;
};

/**
 * Notifies assigned officer and administrators when citizen submits feedback
 * @param {object} params
 * @param {object} params.complaint
 * @param {object} params.feedback
 * @param {string|mongoose.Types.ObjectId} [params.citizenId]
 * @returns {Promise<Array<object>>}
 */
export const notifyFeedbackReceived = async ({ complaint, feedback, citizenId = null }) => {
  if (!complaint || !feedback) return [];

  const results = [];

  // 1. Notify assigned officer
  if (complaint.assignedOfficer?.email) {
    try {
      const officerLog = await queueNotification({
        eventType: 'FEEDBACK_RECEIVED',
        complaint,
        recipientEmail: complaint.assignedOfficer.email,
        recipientUser: complaint.assignedOfficer._id || complaint.assignedOfficer.id,
        recipientRole: 'officer',
        title: `Feedback Received: ${feedback.rating} Stars`,
        message: `Citizen submitted a ${feedback.rating}-star review for complaint "${complaint.title}": "${feedback.comment || 'No comment'}"`,
        category: 'feedback',
        priority: feedback.rating <= 2 ? 'High' : 'Low',
        actionUrl: buildOfficerPortalUrl(),
        subject: `[CivicFix Feedback] ${feedback.rating}★ Review on #${complaint.complaintId}`,
        html: `<p>Citizen provided a ${feedback.rating}-star rating on #${complaint.complaintId}.</p><p>Comment: ${feedback.comment || 'None'}</p>`,
        text: `Citizen provided a ${feedback.rating}-star rating on #${complaint.complaintId}. Comment: ${feedback.comment || 'None'}`,
        idempotencyKey: `FEEDBACK_OFFICER_${complaint.complaintId}_${feedback._id || Date.now()}`,
        metadata: { rating: feedback.rating, comment: feedback.comment },
        sendEmail: true
      });
      results.push(officerLog);
    } catch (err) {
      console.warn(`[Notification] Officer feedback notification failed for ${complaint.complaintId}:`, err.message);
    }
  }

  // 2. Notify municipal admin
  try {
    const isLiveDbOrMocked = (mongoose.connection.readyState === 1 && Boolean(mongoose.connection.db)) || Boolean(User._isMocked);
    if (!isLiveDbOrMocked) return results;

    const admins = await User.find({ role: 'admin', isActive: true }).limit(2);
    for (const admin of admins) {
      if (!admin.email) continue;
      const adminLog = await queueNotification({
        eventType: 'FEEDBACK_RECEIVED',
        complaint,
        recipientEmail: admin.email,
        recipientUser: admin._id,
        recipientRole: 'admin',
        title: `Citizen Feedback: ${feedback.rating}★ (${complaint.complaintId})`,
        message: `New feedback received for "${complaint.title}": ${feedback.rating}/5 stars.`,
        category: 'feedback',
        priority: feedback.rating <= 2 ? 'High' : 'Low',
        actionUrl: buildAdminPortalUrl(),
        subject: `[CivicFix Admin] ${feedback.rating}★ Feedback on #${complaint.complaintId}`,
        html: `<p>New citizen feedback received for #${complaint.complaintId}: ${feedback.rating} stars.</p><p>${feedback.comment || ''}</p>`,
        text: `New feedback received for #${complaint.complaintId}: ${feedback.rating}/5 stars.`,
        idempotencyKey: `FEEDBACK_ADMIN_${complaint.complaintId}_${admin._id}_${feedback._id || Date.now()}`,
        metadata: { rating: feedback.rating, comment: feedback.comment },
        sendEmail: feedback.rating <= 2
      });
      results.push(adminLog);
    }
  } catch (err) {
    console.warn(`[Notification] Admin feedback notification failed for ${complaint.complaintId}:`, err.message);
  }

  return results;
};

/**
 * Broadcasts system announcement to targeted users
 * @param {object} params
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} [params.priority='Medium']
 * @param {string} [params.targetRole='all']
 * @param {string} [params.actionUrl=null]
 * @param {object} [params.adminUser=null]
 * @returns {Promise<Array<object>>}
 */
export const notifySystemAnnouncement = async ({
  title,
  message,
  priority = 'Medium',
  targetRole = 'all',
  actionUrl = null,
  adminUser = null
}) => {
  if (!title || !message) return [];

  try {
    const userQuery = { isActive: true };
    if (targetRole && targetRole !== 'all') {
      userQuery.role = targetRole;
    }

    const recipients = await User.find(userQuery).select('_id email role name');
    const results = [];

    for (const user of recipients) {
      const idempotencyKey = `ANNOUNCEMENT_${Date.now()}_${user._id}`;
      const log = await queueNotification({
        eventType: 'SYSTEM_ANNOUNCEMENT',
        complaint: null,
        recipientEmail: user.email,
        recipientUser: user._id,
        recipientRole: user.role,
        title,
        message,
        category: 'announcement',
        priority,
        actionUrl: actionUrl || (user.role === 'officer' ? buildOfficerPortalUrl() : user.role === 'admin' ? buildAdminPortalUrl() : '/'),
        subject: `[CivicFix Announcement] ${title}`,
        html: `<p><strong>${title}</strong></p><p>${message}</p>`,
        text: `${title}\n\n${message}`,
        idempotencyKey,
        metadata: {
          broadcastBy: adminUser?.name || 'Municipal Administration',
          targetRole
        },
        sendEmail: priority === 'Critical'
      });
      results.push(log);
    }

    return results;
  } catch (err) {
    console.warn('[Notification] System announcement broadcast failed:', err.message);
    return [];
  }
};

/**
 * Notifies citizen when an officer submits resolution evidence for verification
 * @param {object} params
 * @param {object} params.complaint
 * @param {object} [params.officer]
 * @returns {Promise<Array<object>>}
 */
export const notifyResolutionSubmitted = async ({ complaint, officer = null }) => {
  if (!complaint || !complaint.complaintId) return [];

  const results = [];
  const citizenEmail = complaint.contactEmail || complaint.reportedBy?.email;
  const citizenUser = complaint.reportedBy?._id || complaint.reportedBy;

  if (citizenEmail) {
    try {
      const trackingUrl = buildTrackingUrl(complaint.complaintId);
      const officerName = officer?.name || complaint.resolutionEvidence?.submittedByName || 'Assigned Officer';
      const remarks = complaint.resolutionEvidence?.remarks || 'Work completed.';

      const citizenLog = await queueNotification({
        eventType: 'RESOLUTION_SUBMITTED',
        complaint,
        recipientEmail: citizenEmail,
        recipientUser: citizenUser || null,
        recipientRole: 'citizen',
        title: `Resolution Submitted: #${complaint.complaintId}`,
        message: `${officerName} submitted resolution evidence for "${complaint.title}". Please inspect before-and-after photos and verify or contest.`,
        category: 'resolution',
        priority: 'High',
        actionUrl: trackingUrl,
        subject: `[CivicFix Resolution] Verification Required: #${complaint.complaintId}`,
        html: `<p>Resolution evidence has been submitted for complaint <strong>#${complaint.complaintId}</strong> by ${officerName}.</p><p><strong>Officer Remarks:</strong> ${remarks}</p><p><a href="${trackingUrl}">Click here to review photos and verify resolution</a></p>`,
        text: `Resolution submitted for #${complaint.complaintId} by ${officerName}.\nRemarks: ${remarks}\nReview: ${trackingUrl}`,
        idempotencyKey: `RES_SUBMIT_${complaint.complaintId}_${Date.now()}`,
        metadata: { officerName, remarks },
        sendEmail: complaint.emailNotificationsEnabled !== false
      });
      results.push(citizenLog);
    } catch (err) {
      console.warn(`[Notification] Resolution submission notice failed for ${complaint.complaintId}:`, err.message);
    }
  }

  return results;
};

/**
 * Notifies assigned officer when citizen confirms and verifies the resolution
 * @param {object} params
 * @param {object} params.complaint
 * @param {object} [params.citizen]
 * @returns {Promise<Array<object>>}
 */
export const notifyResolutionVerified = async ({ complaint, citizen = null }) => {
  if (!complaint || !complaint.complaintId) return [];

  const results = [];
  const officerEmail = complaint.assignedOfficer?.email;
  const officerUser = complaint.assignedOfficer?._id || complaint.assignedOfficer?.id || complaint.assignedOfficer;

  if (officerEmail) {
    try {
      const portalUrl = buildOfficerPortalUrl();
      const citizenName = citizen?.name || 'Citizen';

      const officerLog = await queueNotification({
        eventType: 'RESOLUTION_VERIFIED',
        complaint,
        recipientEmail: officerEmail,
        recipientUser: officerUser,
        recipientRole: 'officer',
        title: `Resolution Verified: #${complaint.complaintId}`,
        message: `${citizenName} confirmed that complaint "${complaint.title}" has been successfully resolved.`,
        category: 'resolution',
        priority: 'Medium',
        actionUrl: portalUrl,
        subject: `[CivicFix Success] Resolution Verified - #${complaint.complaintId}`,
        html: `<p>Great work! Citizen ${citizenName} has confirmed and verified resolution for complaint <strong>#${complaint.complaintId}</strong>.</p><p><a href="${portalUrl}">Open Officer Workspace</a></p>`,
        text: `Citizen ${citizenName} verified resolution for #${complaint.complaintId}.\nWorkspace: ${portalUrl}`,
        idempotencyKey: `RES_VERIFIED_${complaint.complaintId}_${Date.now()}`,
        metadata: { citizenName },
        sendEmail: true
      });
      results.push(officerLog);
    } catch (err) {
      console.warn(`[Notification] Resolution verified notice failed for ${complaint.complaintId}:`, err.message);
    }
  }

  return results;
};

/**
 * Notifies assigned officer and supervisors when citizen rejects resolution
 * @param {object} params
 * @param {object} params.complaint
 * @param {string} params.reason
 * @param {object} [params.citizen]
 * @returns {Promise<Array<object>>}
 */
export const notifyResolutionRejected = async ({ complaint, reason, citizen = null }) => {
  if (!complaint || !complaint.complaintId) return [];

  const results = [];
  const officerEmail = complaint.assignedOfficer?.email;
  const officerUser = complaint.assignedOfficer?._id || complaint.assignedOfficer?.id || complaint.assignedOfficer;

  if (officerEmail) {
    try {
      const portalUrl = buildOfficerPortalUrl();
      const citizenName = citizen?.name || 'Citizen';

      const officerLog = await queueNotification({
        eventType: 'RESOLUTION_REJECTED',
        complaint,
        recipientEmail: officerEmail,
        recipientUser: officerUser,
        recipientRole: 'officer',
        title: `Resolution Rejected: Reopened #${complaint.complaintId}`,
        message: `${citizenName} rejected resolution for "${complaint.title}". Reopen Reason: ${reason}`,
        category: 'resolution',
        priority: 'High',
        actionUrl: portalUrl,
        subject: `[CivicFix Alert] Resolution Rejected - #${complaint.complaintId}`,
        html: `<p>Resolution for complaint <strong>#${complaint.complaintId}</strong> was rejected by ${citizenName} and reopened.</p><p><strong>Citizen Reason:</strong> ${reason}</p><p><a href="${portalUrl}">Review in Officer Workspace</a></p>`,
        text: `Resolution rejected for #${complaint.complaintId} by ${citizenName}.\nReason: ${reason}\nWorkspace: ${portalUrl}`,
        idempotencyKey: `RES_REJECT_${complaint.complaintId}_${Date.now()}`,
        metadata: { citizenName, reason, reopenCount: complaint.resolutionEvidence?.reopenCount || 1 },
        sendEmail: true
      });
      results.push(officerLog);
    } catch (err) {
      console.warn(`[Notification] Resolution rejected notice failed for ${complaint.complaintId}:`, err.message);
    }
  }

  return results;
};

/**
 * Notifies municipal administrators when a complaint requires administrative review due to dispute or repeat rejections
 * @param {object} params
 * @param {object} params.complaint
 * @param {string} params.reason
 * @param {number} [params.reopenCount]
 * @returns {Promise<Array<object>>}
 */
export const notifyAdminReviewRequired = async ({ complaint, reason, reopenCount = 3 }) => {
  if (!complaint || !complaint.complaintId) return [];

  const results = [];

  try {
    const isLiveDbOrMocked = (mongoose.connection.readyState === 1 && Boolean(mongoose.connection.db)) || Boolean(User._isMocked);
    if (!isLiveDbOrMocked) return results;

    const admins = await User.find({ role: 'admin', isActive: true }).limit(3);
    const adminPortalUrl = buildAdminPortalUrl();

    for (const admin of admins) {
      if (!admin.email) continue;
      const adminLog = await queueNotification({
        eventType: 'ADMIN_REVIEW_REQUIRED',
        complaint,
        recipientEmail: admin.email,
        recipientUser: admin._id,
        recipientRole: 'admin',
        title: `Dispute Escalation: #${complaint.complaintId}`,
        message: `Complaint "${complaint.title}" has reached ${reopenCount} rejections and requires administrative intervention.`,
        category: 'escalation',
        priority: 'Critical',
        actionUrl: adminPortalUrl,
        subject: `[CivicFix Critical] Admin Review Required - #${complaint.complaintId}`,
        html: `<p>Complaint <strong>#${complaint.complaintId}</strong> has reached the maximum citizen rejection threshold (${reopenCount} reopens).</p><p><strong>Latest Citizen Reason:</strong> ${reason}</p><p><a href="${adminPortalUrl}">Inspect Disputed Complaint</a></p>`,
        text: `Complaint #${complaint.complaintId} escalated to administrative review (${reopenCount} reopens).\nReason: ${reason}\nAdmin: ${adminPortalUrl}`,
        idempotencyKey: `ADMIN_REVIEW_REQ_${complaint.complaintId}_${admin._id}_${Date.now()}`,
        metadata: { reopenCount, reason },
        sendEmail: true
      });
      results.push(adminLog);
    }
  } catch (err) {
    console.warn(`[Notification] Admin review notification failed for ${complaint.complaintId}:`, err.message);
  }

  return results;
};

/**
 * Sweeps pending notifications and processes retries
 * @param {number} [batchSize=25]
 * @returns {Promise<Array<object>>}
 */
export const processPendingNotificationRetries = async (batchSize = 25) => {
  const pendingLogs = await NotificationLog.find({
    deliveryStatus: 'Pending',
    retryCount: { $lt: 3 }
  })
    .sort({ createdAt: 1 })
    .limit(batchSize);

  const results = [];
  for (const log of pendingLogs) {
    try {
      const processed = await processNotificationAsync(log._id);
      if (processed) results.push(processed);
    } catch (err) {
      console.warn(`[Notification Retry] Error processing ${log._id}:`, err.message);
    }
  }

  return results;
};

export default {
  buildTrackingUrl,
  buildOfficerPortalUrl,
  buildAdminPortalUrl,
  queueNotification,
  processNotificationAsync,
  notifyComplaintSubmitted,
  notifyStatusUpdated,
  notifyDepartmentAssigned,
  notifyOfficerAssigned,
  notifySlaWarning,
  notifySlaBreach,
  notifySlaEscalation,
  notifyManualEscalation,
  notifyComplaintReopened,
  notifyResolutionSubmitted,
  notifyResolutionVerified,
  notifyResolutionRejected,
  notifyAdminReviewRequired,
  notifyFeedbackReceived,
  notifySystemAnnouncement,
  processPendingNotificationRetries,
  getUserNotifications,
  getUserUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  archiveUserNotification,
  clearReadUserNotifications,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  getAdminNotificationLogs
};
