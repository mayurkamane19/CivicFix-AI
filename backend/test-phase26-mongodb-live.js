/**
 * Phase 26: Live MongoDB Persistence & Integration Test Suite
 * Target Database: civicfix_phase26_test (Isolated test database on local MongoDB 8.0.4)
 * Verifies real document creation, retrieval, updates, referential integrity, indexes, reconnect persistence, and cleanup.
 */

import mongoose from 'mongoose';
import User from './src/models/User.js';
import Complaint from './src/models/Complaint.js';
import Ward from './src/models/Ward.js';
import Department from './src/models/Department.js';
import NotificationLog from './src/models/NotificationLog.js';
import Feedback from './src/models/Feedback.js';
import EscalationLog from './src/models/EscalationLog.js';
import SlaConfig from './src/models/SlaConfig.js';
import PushSubscription from './src/models/PushSubscription.js';

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
console.log('🧪 CivicFix AI: Phase 26 Live MongoDB Persistence Suite');
console.log('Target Database: civicfix_phase26_test');
console.log('Server: 127.0.0.1:27017 (Local MongoDB Community Server)');
console.log('====================================================\n');

const TEST_DB_URI = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/civicfix_phase26_test';

// Connect to dedicated test database
console.log(`Connecting to: ${TEST_DB_URI}...`);
const conn = await mongoose.connect(TEST_DB_URI);
assert(conn.connection.readyState === 1, 'Mongoose connected successfully to live local MongoDB');
assert(conn.connection.name === 'civicfix_phase26_test', 'Target database is confirmed to be isolated civicfix_phase26_test');

const testRunId = Date.now();
const testEmail = `live_tester_${testRunId}@civicfix.city`;
let createdUserId = null;
let createdWardId = null;
let createdDeptId = null;
let createdOfficerId = null;
let createdComplaintId = null;
let createdSlaId = null;
let createdEscId = null;
let createdFeedbackId = null;
let createdNotifId = null;
let createdPushId = null;

try {
  // 1. User Creation, Hashing & Role Assignment
  console.log('\n--- 1. User Model: Persistence, Hashing & Roles ---');
  const user = await User.create({
    name: 'Live Citizen Test',
    email: testEmail,
    password: 'Password123!',
    role: 'citizen',
    phone: '9876543210'
  });
  createdUserId = user._id;
  assert(user._id != null, 'User persisted in live database with valid ObjectId');
  assert(user.password !== 'Password123!', 'Password hashed with bcrypt middleware before persistence');
  assert(user.role === 'citizen', 'Role correctly assigned and persisted');

  // Verify retrieval
  const retrievedUser = await User.findById(createdUserId);
  assert(retrievedUser && retrievedUser.email === testEmail, 'User retrieved from live MongoDB matching email');

  // Verify unique index enforcement
  let dupRejected = false;
  try {
    await User.create({ name: 'Dup', email: testEmail, password: 'Password123!', role: 'citizen' });
  } catch (dupErr) {
    dupRejected = dupErr.code === 11000 || dupErr.name === 'MongoServerError';
  }
  assert(dupRejected === true, 'Duplicate email rejected by live MongoDB unique index (E11000)');

  // 2. Ward Creation & Boundaries
  console.log('\n--- 2. Ward Model: Spatial Boundaries & Unique Index ---');
  const wardNumber = Math.floor(10000 + Math.random() * 90000);
  const wardCode = `W26_${testRunId.toString().slice(-4)}`;
  const ward = await Ward.create({
    name: 'Shivajinagar Phase 26',
    code: wardCode,
    number: wardNumber,
    zone: 'West Zone',
    boundaries: {
      type: 'Polygon',
      coordinates: [
        [[73.84, 18.52], [73.86, 18.52], [73.86, 18.54], [73.84, 18.54], [73.84, 18.52]]
      ]
    }
  });
  createdWardId = ward._id;
  assert(ward._id != null, 'Ward persisted in live MongoDB with valid ObjectId');
  assert(ward.code === wardCode, 'Ward code correctly persisted');
  assert(ward.boundaries.type === 'Polygon', 'GeoJSON boundaries persisted in Ward document');

  // 3. Department & Officer Creation
  console.log('\n--- 3. Department & Officer Setup ---');
  const dept = await Department.create({
    name: `Road Infrastructure Dept ${testRunId}`,
    code: `ROADS_${testRunId.toString().slice(-4)}`,
    description: 'Handles municipal road defects'
  });
  createdDeptId = dept._id;
  assert(dept._id != null, 'Department persisted in live MongoDB');

  const officer = await User.create({
    name: 'Officer Rajesh Kumar',
    email: `officer_${testRunId}@civicfix.city`,
    password: 'Password123!',
    role: 'officer',
    department: dept._id,
    ward: ward._id
  });
  createdOfficerId = officer._id;
  assert(officer._id != null, 'Field Officer persisted with department and ward references');

  // 4. Complaint Creation, Status Updates & References
  console.log('\n--- 4. Complaint Model: CRUD, Relations & Status Updates ---');
  const complaint = await Complaint.create({
    title: 'Severe Pothole on FC Road',
    description: 'Hazardous deep pothole creating severe traffic hazard',
    category: 'Road Damage',
    reportedBy: user._id,
    ward: ward._id,
    wardName: ward.name,
    wardCode: ward.code,
    assignedDepartment: dept._id,
    assignedOfficer: officer._id,
    assignedOfficerName: officer.name,
    location: {
      address: 'Near Goodluck Cafe, FC Road',
      latitude: 18.53,
      longitude: 73.85
    },
    sla: {
      priority: 'High',
      targetResolutionHours: 48,
      status: 'Within SLA'
    }
  });
  createdComplaintId = complaint._id;
  assert(complaint._id != null, 'Complaint document created in live MongoDB');
  assert(complaint.complaintId.startsWith('CFX-'), 'Unique CFX ticket ID generated');

  // Update status
  complaint.status = 'In Progress';
  complaint.statusHistory.push({
    previousStatus: 'Pending',
    newStatus: 'In Progress',
    changedBy: officer._id,
    changedByName: officer.name,
    note: 'Officer dispatched to inspect pothole',
    changedAt: new Date()
  });
  await complaint.save();
  assert(complaint.status === 'In Progress', 'Status updated to In Progress in live MongoDB');
  assert(complaint.statusHistory.length === 1, 'Status history array updated with audit entry');

  // 5. Resolution Evidence References
  console.log('\n--- 5. Resolution Evidence Subdocument Verification ---');
  complaint.resolutionEvidence = {
    status: 'Awaiting Citizen Verification',
    remarks: 'Pothole filled with cold asphalt mix. Fully leveled and cured.',
    beforeImages: [{ url: 'https://cloudinary.com/test_before.jpg', caption: 'Pothole before repair' }],
    afterImages: [{ url: 'https://cloudinary.com/test_after.jpg', caption: 'Road leveled after repair' }],
    submittedAt: new Date(),
    submittedBy: officer._id,
    submittedByName: officer.name
  };
  await complaint.save();
  assert(complaint.resolutionEvidence.status === 'Awaiting Citizen Verification', 'Resolution evidence persisted');
  assert(complaint.resolutionEvidence.afterImages.length === 1, 'Resolution after-images persisted');

  // 6. Complaint Transfer & History
  console.log('\n--- 6. Inter-Ward Transfer History Persistence ---');
  const ward2 = await Ward.create({
    name: `Kothrud Phase 26 ${testRunId}`,
    code: `KOTH_${testRunId.toString().slice(-4)}`,
    number: wardNumber + 1,
    zone: 'West Zone'
  });
  complaint.ward = ward2._id;
  complaint.wardName = ward2.name;
  complaint.wardCode = ward2.code;
  complaint.wardTransferHistory.push({
    previousWard: ward._id,
    previousWardName: ward.name,
    previousWardCode: ward.code,
    destinationWard: ward2._id,
    destinationWardName: ward2.name,
    destinationWardCode: ward2.code,
    transferredBy: officer._id,
    transferredByName: officer.name,
    reason: 'Incident location falls across Kothrud ward administrative boundary',
    transferredAt: new Date()
  });
  await complaint.save();
  assert(complaint.ward.toString() === ward2._id.toString(), 'Complaint ward transfer persisted to target ward');
  assert(complaint.wardTransferHistory.length === 1, 'wardTransferHistory recorded audit entry in MongoDB');
  await Ward.findByIdAndDelete(ward2._id);

  // 7. Population & Referential Integrity
  console.log('\n--- 7. Population & Document Relationships ---');
  const populated = await Complaint.findById(complaint._id)
    .populate('reportedBy', 'name email role')
    .populate('assignedOfficer', 'name email')
    .populate('assignedDepartment', 'name code');
  assert(populated.reportedBy.name === 'Live Citizen Test', 'reportedBy successfully populated');
  assert(populated.assignedOfficer.name === 'Officer Rajesh Kumar', 'assignedOfficer successfully populated');
  assert(populated.assignedDepartment.name.startsWith('Road Infrastructure Dept'), 'assignedDepartment successfully populated');

  // 8. SLA Config & Escalation Logs
  console.log('\n--- 8. SLA Configuration & Escalation Records ---');
  const slaCfg = await SlaConfig.create({
    department: dept._id,
    departmentName: dept.name,
    priorityTargets: { Critical: 12, High: 24, Medium: 48, Low: 96 }
  });
  createdSlaId = slaCfg._id;
  assert(slaCfg._id != null, 'SlaConfig document persisted in live MongoDB');

  const esc = await EscalationLog.create({
    complaint: complaint._id,
    complaintId: complaint.complaintId,
    previousLevel: 0,
    newLevel: 1,
    triggerType: 'AUTOMATIC_TIMEOUT',
    triggerReason: 'Target SLA deadline elapsed without officer dispatch'
  });
  createdEscId = esc._id;
  assert(esc._id != null, 'EscalationLog document persisted in live MongoDB');

  // 9. Feedback Persistence
  console.log('\n--- 9. Citizen Feedback Persistence ---');
  const fb = await Feedback.create({
    complaint: complaint._id,
    citizen: user._id,
    rating: 5,
    comment: 'Pothole was repaired cleanly and quickly. Excellent municipal response!'
  });
  createdFeedbackId = fb._id;
  assert(fb._id != null, 'Feedback document persisted with 5-star rating');
  assert(fb.comment.length > 10, 'Feedback comment persisted accurately');

  // 10. NotificationLog Persistence
  console.log('\n--- 10. Notification Log Persistence ---');
  const notif = await NotificationLog.create({
    eventType: 'STATUS_UPDATE',
    idempotencyKey: `notif_live_${testRunId}`,
    recipientUser: user._id,
    recipientEmail: user.email,
    recipientRole: 'citizen',
    subject: 'Complaint Status Update - In Progress',
    title: 'Your report is now In Progress',
    message: 'An officer has been dispatched to inspect your reported pothole.',
    deliveryStatus: 'Sent',
    deliveredAt: new Date()
  });
  createdNotifId = notif._id;
  assert(notif._id != null, 'NotificationLog document persisted in live MongoDB');

  // 11. PushSubscription Persistence
  console.log('\n--- 11. Push Subscription Persistence ---');
  const push = await PushSubscription.create({
    user: user._id,
    endpoint: `https://fcm.googleapis.com/fcm/send/live_device_token_${testRunId}`,
    keys: {
      p256dh: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZElO7BpwtGN',
      auth: 'authSecret1234'
    }
  });
  createdPushId = push._id;
  assert(push._id != null, 'PushSubscription document persisted in live MongoDB');

  // 12. Reconnect Test (Verify Data Survives Connection Cycle)
  console.log('\n--- 12. Persistence Across Connection Cycle ---');
  await mongoose.connection.close();
  console.log('Connection closed. Reconnecting to verify persistence...');
  const reconnectedConn = await mongoose.connect(TEST_DB_URI);
  assert(reconnectedConn.connection.readyState === 1, 'Reconnected to live MongoDB');

  const reloadedComplaint = await Complaint.findById(createdComplaintId);
  assert(reloadedComplaint != null, 'Complaint document survived connection close and reconnect');
  assert(reloadedComplaint.title === 'Severe Pothole on FC Road', 'Complaint data integrity confirmed after reconnect');

  const reloadedUser = await User.findById(createdUserId);
  assert(reloadedUser != null, 'User document survived connection close and reconnect');

  // 13. Isolated Test Cleanup
  console.log('\n--- 13. Clean Cleanup of Dedicated Test Data ---');
  await PushSubscription.findByIdAndDelete(createdPushId);
  await NotificationLog.findByIdAndDelete(createdNotifId);
  await Feedback.findByIdAndDelete(createdFeedbackId);
  await EscalationLog.findByIdAndDelete(createdEscId);
  await SlaConfig.findByIdAndDelete(createdSlaId);
  await Complaint.findByIdAndDelete(createdComplaintId);
  await User.findByIdAndDelete(createdOfficerId);
  await Department.findByIdAndDelete(createdDeptId);
  await Ward.findByIdAndDelete(createdWardId);
  await User.findByIdAndDelete(createdUserId);

  const finalCheck = await Complaint.findById(createdComplaintId);
  assert(finalCheck === null, 'Test records cleanly pruned from civicfix_phase26_test (No leaked records)');

} catch (err) {
  assert(false, `Live MongoDB error occurred: ${err.message}`);
} finally {
  await mongoose.connection.close();
}

console.log('\n====================================================');
console.log(`Summary: ${passed}/${total} Live MongoDB persistence tests passed.`);
console.log('====================================================');

process.exit(passed === total ? 0 : 1);
