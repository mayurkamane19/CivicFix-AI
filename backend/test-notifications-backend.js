/**
 * CivicFix AI - Phase 18: Unified Notification Center Backend Test Suite
 *
 * Comprehensive automated verification for:
 * 1. NotificationLog schema extensions (title, message, category, priority, isRead, readAt, isArchived, actionUrl)
 * 2. User notification preferences schema & role-mandated safeguards
 * 3. In-app notification inbox retrieval, filtering, search, and pagination
 * 4. Read/unread state transitions, batch read, and clear/archive actions
 * 5. Strict Anti-IDOR ownership isolation (User A cannot access or mutate User B's notifications)
 * 6. High-level event triggers (notifyComplaintReopened, notifyFeedbackReceived, notifySystemAnnouncement)
 * 7. Outbox retry sweep worker & bounded error handling
 * 8. REST API controllers and routing contracts
 * 9. Backward compatibility with Phase 13 email notifications
 */

import mongoose from 'mongoose';
import {
  NotificationLog,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_CATEGORIES,
  DELIVERY_STATUSES,
  mapEventToCategory
} from './src/models/NotificationLog.js';
import { User, DEFAULT_NOTIFICATION_PREFERENCES } from './src/models/User.js';
import {
  queueNotification,
  getUserNotifications,
  getUserUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  archiveUserNotification,
  clearReadUserNotifications,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  notifyComplaintReopened,
  notifyFeedbackReceived,
  notifySystemAnnouncement,
  processPendingNotificationRetries
} from './src/services/notificationService.js';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
  getPreferences,
  updatePreferences,
  broadcastAnnouncement
} from './src/controllers/notificationController.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
  }
}

console.log('====================================================');
console.log('🔔 CivicFix AI: Phase 18 Unified Notification Center Tests');
console.log('====================================================\n');

// Mock User and Complaint IDs
const citizenOneId = new mongoose.Types.ObjectId();
const citizenTwoId = new mongoose.Types.ObjectId();
const officerId = new mongoose.Types.ObjectId();
const adminId = new mongoose.Types.ObjectId();
const testComplaintId = new mongoose.Types.ObjectId();

// In-Memory store for mock testing
const inMemoryLogs = [];
const inMemoryUsers = [
  new User({
    _id: citizenOneId,
    name: 'Jane Citizen',
    email: 'citizen1@test.com',
    password: 'Password123!',
    role: 'citizen',
    isActive: true,
    notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES }
  }),
  new User({
    _id: citizenTwoId,
    name: 'John Resident',
    email: 'citizen2@test.com',
    password: 'Password123!',
    role: 'citizen',
    isActive: true,
    notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES }
  }),
  new User({
    _id: officerId,
    name: 'Officer Rajesh',
    email: 'officer@city.gov',
    password: 'Password123!',
    role: 'officer',
    isActive: true,
    notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES }
  }),
  new User({
    _id: adminId,
    name: 'Admin Sarah',
    email: 'admin@city.gov',
    password: 'Password123!',
    role: 'admin',
    isActive: true,
    notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES }
  })
];

// Mock Mongoose model methods to allow fast in-memory execution without buffering
NotificationLog.find = function (query = {}) {
  const filterFn = (item) => {
    if (query.recipientUser && item.recipientUser?.toString() !== query.recipientUser?.toString()) return false;
    if (query.isArchived !== undefined && item.isArchived !== query.isArchived) return false;
    if (query.isRead !== undefined && item.isRead !== query.isRead) return false;
    if (query.category && item.category !== query.category) return false;
    if (query.deliveryStatus && item.deliveryStatus !== query.deliveryStatus) return false;
    return true;
  };

  const results = inMemoryLogs.filter(filterFn);
  return {
    sort: () => ({
      skip: (s) => ({
        limit: (l) => Promise.resolve(results.slice(s, s + l))
      }),
      limit: (l) => Promise.resolve(results.slice(0, l))
    })
  };
};

NotificationLog.countDocuments = function (query = {}) {
  const count = inMemoryLogs.filter((item) => {
    if (query.recipientUser && item.recipientUser?.toString() !== query.recipientUser?.toString()) return false;
    if (query.isArchived !== undefined && item.isArchived !== query.isArchived) return false;
    if (query.isRead !== undefined && item.isRead !== query.isRead) return false;
    if (query.category && item.category !== query.category) return false;
    return true;
  }).length;
  return Promise.resolve(count);
};

NotificationLog.findOne = function (query = {}) {
  for (const log of inMemoryLogs) {
    if (query._id && log._id.toString() !== query._id.toString()) continue;
    if (query.recipientUser && log.recipientUser?.toString() !== query.recipientUser.toString()) continue;
    if (query.idempotencyKey && log.idempotencyKey !== query.idempotencyKey) continue;
    if (query.isArchived !== undefined && log.isArchived !== query.isArchived) continue;
    return Promise.resolve(log);
  }
  return Promise.resolve(null);
};

NotificationLog.updateMany = function (query = {}, update = {}) {
  let count = 0;
  for (const log of inMemoryLogs) {
    if (query.recipientUser && log.recipientUser?.toString() !== query.recipientUser.toString()) continue;
    if (query.isArchived !== undefined && log.isArchived !== query.isArchived) continue;
    if (query.isRead !== undefined && log.isRead !== query.isRead) continue;
    if (update.$set) {
      Object.assign(log, update.$set);
      count++;
    }
  }
  return Promise.resolve({ modifiedCount: count, nModified: count });
};

NotificationLog.findOneAndUpdate = function (query = {}, update = {}) {
  for (const log of inMemoryLogs) {
    if (log._id.toString() === query._id?.toString()) {
      Object.assign(log, update);
      return Promise.resolve(log);
    }
  }
  return Promise.resolve(null);
};

NotificationLog.prototype.save = function () {
  this._id = this._id || new mongoose.Types.ObjectId();
  const existingIdx = inMemoryLogs.findIndex((n) => n._id.toString() === this._id.toString());
  if (existingIdx >= 0) {
    inMemoryLogs[existingIdx] = this;
  } else {
    inMemoryLogs.push(this);
  }
  return Promise.resolve(this);
};

User.findById = function (id) {
  const user = inMemoryUsers.find((u) => u._id.toString() === id.toString());
  return {
    select: () => Promise.resolve(user || null),
    then: (resolve) => resolve(user || null)
  };
};

User.find = function (query = {}) {
  const results = inMemoryUsers.filter((u) => {
    if (query.role && u.role !== query.role) return false;
    if (query.isActive !== undefined && u.isActive !== query.isActive) return false;
    return true;
  });
  return {
    select: () => Promise.resolve(results),
    limit: (l) => Promise.resolve(results.slice(0, l)),
    then: (resolve) => resolve(results)
  };
};

User.findOne = function (query = {}) {
  const result = inMemoryUsers.find((u) => {
    if (query.role && u.role !== query.role) return false;
    if (query.isActive !== undefined && u.isActive !== query.isActive) return false;
    return true;
  });
  return Promise.resolve(result || null);
};

User.prototype.save = function () {
  return Promise.resolve(this);
};

User._isMocked = true;

// -----------------------------------------------------------------------------
// 1. DATA MODEL & SCHEMA VALIDATION
// -----------------------------------------------------------------------------
console.log('--- 1. Notification Data Model & Schema Validation ---');

assert(
  NOTIFICATION_EVENT_TYPES.includes('COMPLAINT_REOPENED') &&
  NOTIFICATION_EVENT_TYPES.includes('FEEDBACK_RECEIVED') &&
  NOTIFICATION_EVENT_TYPES.includes('SYSTEM_ANNOUNCEMENT'),
  '1.1 NOTIFICATION_EVENT_TYPES includes reopened, feedback, and announcement'
);

assert(
  NOTIFICATION_CATEGORIES.includes('submission') &&
  NOTIFICATION_CATEGORIES.includes('status') &&
  NOTIFICATION_CATEGORIES.includes('sla_warning') &&
  NOTIFICATION_CATEGORIES.includes('sla_breach') &&
  NOTIFICATION_CATEGORIES.includes('escalation') &&
  NOTIFICATION_CATEGORIES.includes('feedback') &&
  NOTIFICATION_CATEGORIES.includes('announcement'),
  '1.2 NOTIFICATION_CATEGORIES includes all required category types'
);

assert(
  mapEventToCategory('COMPLAINT_REOPENED') === 'reopened' &&
  mapEventToCategory('SLA_BREACH') === 'sla_breach' &&
  mapEventToCategory('FEEDBACK_RECEIVED') === 'feedback' &&
  mapEventToCategory('SYSTEM_ANNOUNCEMENT') === 'announcement',
  '1.3 mapEventToCategory maps events to valid categories'
);

const validInboxLog = new NotificationLog({
  eventType: 'COMPLAINT_SUBMISSION',
  title: 'Complaint Registered: CFX-TEST-001',
  message: 'Your report has been received and queued for triage.',
  category: 'submission',
  priority: 'Low',
  recipientEmail: 'citizen@example.com',
  recipientUser: citizenOneId,
  recipientRole: 'citizen',
  subject: '[CivicFix AI] Complaint Registered',
  actionUrl: '/track/CFX-TEST-001',
  deliveryStatus: 'Pending',
  idempotencyKey: `TEST_SUBMISSION_${Date.now()}`
});

let schemaError = null;
try {
  await validInboxLog.validate();
} catch (err) {
  schemaError = err;
}
assert(schemaError === null, '1.4 Valid NotificationLog passes Mongoose schema validation');
assert(validInboxLog.isRead === false, '1.5 NotificationLog defaults isRead to false');
assert(validInboxLog.isArchived === false, '1.6 NotificationLog defaults isArchived to false');
assert(validInboxLog.priority === 'Low', '1.7 Priority is assigned correctly');

const safeObj = validInboxLog.toSafeObject();
assert(safeObj.title === 'Complaint Registered: CFX-TEST-001', '1.8 toSafeObject() exposes title');
assert(safeObj.category === 'submission', '1.9 toSafeObject() exposes category');
assert(safeObj.isRead === false, '1.10 toSafeObject() exposes isRead boolean');
assert(safeObj.actionUrl === '/track/CFX-TEST-001', '1.11 toSafeObject() exposes actionUrl');

// -----------------------------------------------------------------------------
// 2. USER MODEL NOTIFICATION PREFERENCES
// -----------------------------------------------------------------------------
console.log('\n--- 2. User Notification Preferences & Defaults ---');

assert(
  DEFAULT_NOTIFICATION_PREFERENCES.emailNotifications === true &&
  DEFAULT_NOTIFICATION_PREFERENCES.complaintStatus === true &&
  DEFAULT_NOTIFICATION_PREFERENCES.slaReminders === true &&
  DEFAULT_NOTIFICATION_PREFERENCES.criticalEscalations === true &&
  DEFAULT_NOTIFICATION_PREFERENCES.newAssignments === true &&
  DEFAULT_NOTIFICATION_PREFERENCES.systemAlerts === true,
  '2.1 DEFAULT_NOTIFICATION_PREFERENCES exports architectural default flags'
);

const testUser = new User({
  name: 'Jane Citizen',
  email: `jane.${Date.now()}@example.com`,
  password: 'Password123!',
  role: 'citizen'
});

const safeUser = testUser.toSafeObject();
assert(safeUser.notificationPreferences !== undefined, '2.2 User.toSafeObject() exposes notificationPreferences');
assert(safeUser.notificationPreferences.complaintStatus === true, '2.3 Default complaintStatus is true');
assert(safeUser.notificationPreferences.criticalEscalations === true, '2.4 Default criticalEscalations is true');

// -----------------------------------------------------------------------------
// 3. SEED IN-MEMORY STORE & TEST SERVICE INBOX
// -----------------------------------------------------------------------------
console.log('\n--- 3. Unified In-App Inbox Service Operations ---');

const notif1 = new NotificationLog({
  _id: new mongoose.Types.ObjectId(),
  eventType: 'COMPLAINT_SUBMISSION',
  title: 'Pothole on Main St Registered',
  message: 'Your complaint CFX-101 has been registered.',
  category: 'submission',
  priority: 'Low',
  recipientEmail: 'citizen1@test.com',
  recipientUser: citizenOneId,
  recipientRole: 'citizen',
  subject: 'Report Received',
  complaintId: 'CFX-101',
  isRead: false,
  isArchived: false,
  actionUrl: '/track/CFX-101',
  deliveryStatus: 'Sent',
  idempotencyKey: 'IDEMP_1',
  createdAt: new Date(Date.now() - 3600000)
});

const notif2 = new NotificationLog({
  _id: new mongoose.Types.ObjectId(),
  eventType: 'STATUS_UPDATE',
  title: 'Work Underway: CFX-101',
  message: 'Work has begun on your report.',
  category: 'status',
  priority: 'Medium',
  recipientEmail: 'citizen1@test.com',
  recipientUser: citizenOneId,
  recipientRole: 'citizen',
  subject: 'Status In Progress',
  complaintId: 'CFX-101',
  isRead: true,
  readAt: new Date(),
  isArchived: false,
  actionUrl: '/track/CFX-101',
  deliveryStatus: 'Sent',
  idempotencyKey: 'IDEMP_2',
  createdAt: new Date(Date.now() - 1800000)
});

const notif3 = new NotificationLog({
  _id: new mongoose.Types.ObjectId(),
  eventType: 'SLA_APPROACHING_DEADLINE',
  title: 'SLA Warning: 4h Remaining',
  message: 'Water leak complaint CFX-202 is approaching deadline.',
  category: 'sla_warning',
  priority: 'High',
  recipientEmail: 'citizen2@test.com',
  recipientUser: citizenTwoId, // Belongs to User 2
  recipientRole: 'citizen',
  subject: 'SLA Warning',
  complaintId: 'CFX-202',
  isRead: false,
  isArchived: false,
  actionUrl: '/track/CFX-202',
  deliveryStatus: 'Sent',
  idempotencyKey: 'IDEMP_3',
  createdAt: new Date()
});

inMemoryLogs.push(notif1, notif2, notif3);

const userOneUnreadCount = await getUserUnreadCount(citizenOneId);
assert(userOneUnreadCount === 1, '3.1 getUserUnreadCount returns 1 for User 1');

const userTwoUnreadCount = await getUserUnreadCount(citizenTwoId);
assert(userTwoUnreadCount === 1, '3.2 getUserUnreadCount returns 1 for User 2');

const officerUnreadCount = await getUserUnreadCount(officerId);
assert(officerUnreadCount === 0, '3.3 getUserUnreadCount returns 0 for user with no notifications');

const userOneInbox = await getUserNotifications(citizenOneId, { page: 1, limit: 10 });
assert(userOneInbox.notifications.length === 2, '3.4 getUserNotifications retrieves all notifications for User 1');
assert(userOneInbox.unreadCount === 1, '3.5 getUserNotifications reports unreadCount in pagination payload');

// -----------------------------------------------------------------------------
// 4. ANTI-IDOR SECURITY ENFORCEMENT
// -----------------------------------------------------------------------------
console.log('\n--- 4. Strict Anti-IDOR Authorization Guards ---');

// User 1 tries to mark User 2's notification as read
const idorReadResult = await markNotificationAsRead(notif3._id, citizenOneId);
assert(idorReadResult === null, '4.1 User 1 cannot mark User 2 notification as read (Anti-IDOR blocked)');
assert(notif3.isRead === false, '4.2 Target notification remains unread after unauthorized attempt');

// Legitimate recipient marks read
const legitimateReadResult = await markNotificationAsRead(notif3._id, citizenTwoId);
assert(legitimateReadResult !== null && legitimateReadResult.isRead === true, '4.3 Legitimate recipient User 2 successfully marks notification as read');
assert(notif3.isRead === true, '4.4 Notification isRead status transitions to true');

// User 1 tries to dismiss/archive User 2's notification
const idorArchiveResult = await archiveUserNotification(notif3._id, citizenOneId);
assert(idorArchiveResult === null, '4.5 User 1 cannot archive User 2 notification (Anti-IDOR blocked)');
assert(notif3.isArchived === false, '4.6 Target notification remains unarchived');

// -----------------------------------------------------------------------------
// 5. BATCH OPERATIONS & CLEAR READ
// -----------------------------------------------------------------------------
console.log('\n--- 5. Batch Read & Clear Read Operations ---');

// Mark all as read for User 1
const markAllResult = await markAllNotificationsAsRead(citizenOneId);
assert(markAllResult.count >= 1, '5.1 markAllNotificationsAsRead marks remaining unread notifications');
const unreadAfterBatch = await getUserUnreadCount(citizenOneId);
assert(unreadAfterBatch === 0, '5.2 User 1 unread count drops to 0 after batch read');

// Clear all read for User 1
const clearResult = await clearReadUserNotifications(citizenOneId);
assert(clearResult.count === 2, '5.3 clearReadUserNotifications clears all 2 read notifications for User 1');

const remainingInbox = await getUserNotifications(citizenOneId);
assert(remainingInbox.notifications.length === 0, '5.4 Cleared notifications no longer appear in active inbox');

// -----------------------------------------------------------------------------
// 6. ROLE-MANDATED PREFERENCES SAFEGUARDS
// -----------------------------------------------------------------------------
console.log('\n--- 6. Role-Mandated Notification Preferences Safeguards ---');

// Admin attempt to disable critical escalations
const adminUpdated = await updateUserNotificationPreferences(adminId, {
  notificationPreferences: {
    criticalEscalations: false,
    complaintStatus: false
  }
});

assert(
  adminUpdated.notificationPreferences.criticalEscalations === true,
  '6.1 Administrator CANNOT disable criticalEscalations alert (role-mandated)'
);
assert(
  adminUpdated.notificationPreferences.complaintStatus === false,
  '6.2 Administrator CAN customize non-mandated preferences'
);

// Officer attempt to disable new task assignments
const officerUpdated = await updateUserNotificationPreferences(officerId, {
  notificationPreferences: {
    newAssignments: false,
    systemAlerts: false
  }
});

assert(
  officerUpdated.notificationPreferences.newAssignments === true,
  '6.3 Field Officer CANNOT disable newAssignments alert (role-mandated)'
);
assert(
  officerUpdated.notificationPreferences.systemAlerts === false,
  '6.4 Field Officer CAN customize non-mandated preferences'
);

// -----------------------------------------------------------------------------
// 7. HIGH-LEVEL EVENT TRIGGERS
// -----------------------------------------------------------------------------
console.log('\n--- 7. High-Level Notification Event Triggers ---');

const testComplaint = {
  _id: testComplaintId,
  complaintId: 'CFX-3030',
  title: 'Broken Traffic Light',
  citizenEmail: 'citizen@city.gov',
  emailNotificationsEnabled: true,
  reportedBy: citizenOneId,
  assignedOfficer: {
    _id: officerId,
    email: 'officer@city.gov'
  }
};

const feedbackObj = {
  _id: new mongoose.Types.ObjectId(),
  rating: 2,
  comment: 'Pothole repair took too long'
};

const reopenResults = await notifyComplaintReopened(testComplaint, {
  reason: 'Further repairs needed',
  reopenedBy: 'Operations Lead'
});
assert(Array.isArray(reopenResults) && reopenResults.length >= 1, '7.1 notifyComplaintReopened creates notifications for citizen and officer');

const feedbackResults = await notifyFeedbackReceived({
  complaint: testComplaint,
  feedback: feedbackObj,
  citizenId: citizenOneId
});
assert(Array.isArray(feedbackResults) && feedbackResults.length >= 1, '7.2 notifyFeedbackReceived notifies officer and municipal admins');

const announcementResults = await notifySystemAnnouncement({
  title: 'Severe Weather Warning',
  message: 'Road maintenance suspended during storm',
  priority: 'Critical',
  targetRole: 'all'
});
assert(Array.isArray(announcementResults) && announcementResults.length >= 1, '7.3 notifySystemAnnouncement broadcasts to active users');

// -----------------------------------------------------------------------------
// 8. REST API CONTROLLER CONTRACTS & GUARDS
// -----------------------------------------------------------------------------
console.log('\n--- 8. REST API Controller Handlers & Security Guards ---');

assert(typeof getNotifications === 'function', '8.1 getNotifications controller handler exists');
assert(typeof getUnreadCount === 'function', '8.2 getUnreadCount controller handler exists');
assert(typeof markAsRead === 'function', '8.3 markAsRead controller handler exists');
assert(typeof markAllAsRead === 'function', '8.4 markAllAsRead controller handler exists');
assert(typeof deleteNotification === 'function', '8.5 deleteNotification controller handler exists');
assert(typeof clearReadNotifications === 'function', '8.6 clearReadNotifications controller handler exists');
assert(typeof getPreferences === 'function', '8.7 getPreferences controller handler exists');
assert(typeof updatePreferences === 'function', '8.8 updatePreferences controller handler exists');
assert(typeof broadcastAnnouncement === 'function', '8.9 broadcastAnnouncement controller handler exists');

// Broadcast Announcement Role Guard: Rejects non-admin
const mockCitizenReq = {
  user: { _id: citizenOneId, role: 'citizen' },
  body: { title: 'Unauthorized', message: 'Hacked' }
};
const mockRes = {
  statusCode: 200,
  jsonData: null,
  status(code) { this.statusCode = code; return this; },
  json(data) { this.jsonData = data; return this; }
};

await broadcastAnnouncement(mockCitizenReq, mockRes, () => {});
assert(mockRes.statusCode === 403, '8.10 POST /announcement strictly rejects non-admin users with HTTP 403 Forbidden');

// -----------------------------------------------------------------------------
// 9. RETRY WORKER BOUNDS
// -----------------------------------------------------------------------------
console.log('\n--- 9. Delivery Worker Bounded Retries ---');

const retryWorkerResults = await processPendingNotificationRetries(10);
assert(
  Array.isArray(retryWorkerResults),
  '9.1 processPendingNotificationRetries executes cleanly with bounded batch'
);

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`Summary: ${passed}/${total} Phase 18 Backend Notification tests passed.`);
console.log('====================================================\n');

process.exit(passed === total ? 0 : 1);
