import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Complaint, RESOLUTION_VERIFICATION_STATUSES, ADMIN_REVIEW_STATUSES } from './src/models/Complaint.js';
import { NotificationLog } from './src/models/NotificationLog.js';
import { User } from './src/models/User.js';
import { validateImageBuffer, uploadMultipleImagesToCloudinary } from './src/services/uploadService.js';
import {
  computeOfficerComplaintMetrics,
  getResolutionEvidence,
  submitOfficerResolution,
  verifyResolutionByCitizen,
  rejectResolutionByCitizen,
  reviewResolutionByAdmin
} from './src/services/resolutionService.js';
import notificationService, {
  notifyResolutionSubmitted,
  notifyResolutionVerified,
  notifyResolutionRejected,
  notifyAdminReviewRequired
} from './src/services/notificationService.js';

let passed = 0;
let failed = 0;

const runTest = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}:`, err.message);
    failed++;
  }
};

console.log('\n=== CivicFix AI – Phase 19: Backend Resolution & Officer Workspace Tests ===\n');

// 1. Complaint Model Schema Verification
await runTest('Complaint Model exports RESOLUTION_VERIFICATION_STATUSES correctly', () => {
  assert.ok(Array.isArray(RESOLUTION_VERIFICATION_STATUSES));
  assert.ok(RESOLUTION_VERIFICATION_STATUSES.includes('Not Submitted'));
  assert.ok(RESOLUTION_VERIFICATION_STATUSES.includes('Awaiting Citizen Verification'));
  assert.ok(RESOLUTION_VERIFICATION_STATUSES.includes('Verified by Citizen'));
  assert.ok(RESOLUTION_VERIFICATION_STATUSES.includes('Rejected by Citizen'));
  assert.ok(RESOLUTION_VERIFICATION_STATUSES.includes('Reopened'));
  assert.ok(RESOLUTION_VERIFICATION_STATUSES.includes('Under Administrative Review'));
});

await runTest('Complaint Model exports ADMIN_REVIEW_STATUSES correctly', () => {
  assert.ok(Array.isArray(ADMIN_REVIEW_STATUSES));
  assert.ok(ADMIN_REVIEW_STATUSES.includes('Not Required'));
  assert.ok(ADMIN_REVIEW_STATUSES.includes('Pending'));
  assert.ok(ADMIN_REVIEW_STATUSES.includes('Approved'));
  assert.ok(ADMIN_REVIEW_STATUSES.includes('Rejected'));
  assert.ok(ADMIN_REVIEW_STATUSES.includes('Overridden'));
});

await runTest('Complaint Model status enum includes "Reopened"', () => {
  const statusValues = Complaint.schema.path('status').enumValues;
  assert.ok(statusValues.includes('Reopened'), 'status enum should contain Reopened');
  assert.ok(statusValues.includes('Resolved'), 'status enum should contain Resolved');
  assert.ok(statusValues.includes('In Progress'), 'status enum should contain In Progress');
  assert.ok(statusValues.includes('Pending'), 'status enum should contain Pending');
});

await runTest('Complaint Model contains resolutionEvidence subdocument schema', () => {
  const schema = Complaint.schema;
  const statusPath = schema.path('resolutionEvidence.status');
  assert.ok(statusPath, 'resolutionEvidence.status should exist in schema');
  const remarksPath = schema.path('resolutionEvidence.remarks');
  assert.ok(remarksPath, 'resolutionEvidence.remarks should exist in schema');
  const reopenCountPath = schema.path('resolutionEvidence.reopenCount');
  assert.ok(reopenCountPath, 'resolutionEvidence.reopenCount should exist in schema');
  const maxLimitPath = schema.path('resolutionEvidence.maxReopenLimit');
  assert.ok(maxLimitPath, 'resolutionEvidence.maxReopenLimit should exist in schema');
});

await runTest('NotificationLog model contains resolution and admin review event types', () => {
  const eventTypes = NotificationLog.schema.path('eventType').enumValues;
  assert.ok(eventTypes.includes('RESOLUTION_SUBMITTED'), 'should contain RESOLUTION_SUBMITTED');
  assert.ok(eventTypes.includes('RESOLUTION_VERIFIED'), 'should contain RESOLUTION_VERIFIED');
  assert.ok(eventTypes.includes('RESOLUTION_REJECTED'), 'should contain RESOLUTION_REJECTED');
  assert.ok(eventTypes.includes('ADMIN_REVIEW_REQUIRED'), 'should contain ADMIN_REVIEW_REQUIRED');
});

// 2. Magic Bytes Buffer Validation Test
await runTest('validateImageBuffer accepts valid JPEG magic bytes', () => {
  const validJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
  const res = validateImageBuffer(validJpeg);
  assert.equal(res.isValid, true);
  assert.equal(res.mimeType, 'image/jpeg');
});

await runTest('validateImageBuffer accepts valid PNG magic bytes', () => {
  const validPng = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const res = validateImageBuffer(validPng);
  assert.equal(res.isValid, true);
  assert.equal(res.mimeType, 'image/png');
});

await runTest('validateImageBuffer rejects executable or corrupted buffer', () => {
  const exeBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00]); // MZ DOS header
  const res = validateImageBuffer(exeBuffer);
  assert.equal(res.isValid, false);
});

// 3. Officer Urgency Score & Metrics Computation
await runTest('computeOfficerComplaintMetrics calculates urgency score based on priority and deadline', () => {
  const now = new Date();
  const criticalComplaint = {
    status: 'In Progress',
    priority: 'Critical',
    sla: {
      deadline: new Date(now.getTime() + 6 * 3600 * 1000), // 6h left
      isOverdue: false,
      remainingHours: 6
    }
  };

  const metrics = computeOfficerComplaintMetrics(criticalComplaint);
  assert.ok(metrics.urgencyScore >= 70, 'Critical + <12h deadline should yield high urgency score');
  assert.equal(metrics.isUrgent, true);
  assert.equal(metrics.isOverdue, false);
});

await runTest('computeOfficerComplaintMetrics marks overdue complaints as urgent with overdue penalty', () => {
  const now = new Date();
  const overdueComplaint = {
    status: 'Pending',
    priority: 'High',
    sla: {
      deadline: new Date(now.getTime() - 10 * 3600 * 1000), // 10h ago
      isOverdue: true,
      overdueHours: 10
    }
  };

  const metrics = computeOfficerComplaintMetrics(overdueComplaint);
  assert.equal(metrics.isOverdue, true);
  assert.ok(metrics.urgencyScore >= 80, 'High + Overdue should yield urgency score >= 80');
});

// 4. Notification Triggers Test
await runTest('notifyResolutionSubmitted triggers without throwing when DB is offline', async () => {
  const fakeComplaint = {
    complaintId: 'CFX-TEST-001',
    title: 'Pothole on Main St',
    contactEmail: 'citizen@example.com',
    resolutionEvidence: { remarks: 'Asphalt patched', submittedByName: 'Officer Dave' }
  };
  const logs = await notifyResolutionSubmitted({ complaint: fakeComplaint });
  assert.ok(Array.isArray(logs));
});

await runTest('notifyResolutionVerified triggers without throwing when DB is offline', async () => {
  const fakeComplaint = {
    complaintId: 'CFX-TEST-002',
    title: 'Water Pipe Burst',
    assignedOfficer: { email: 'officer@example.com' }
  };
  const logs = await notifyResolutionVerified({ complaint: fakeComplaint });
  assert.ok(Array.isArray(logs));
});

await runTest('notifyResolutionRejected triggers without throwing when DB is offline', async () => {
  const fakeComplaint = {
    complaintId: 'CFX-TEST-003',
    title: 'Streetlight Broken',
    assignedOfficer: { email: 'officer@example.com' }
  };
  const logs = await notifyResolutionRejected({
    complaint: fakeComplaint,
    reason: 'Streetlight still flickers constantly at night'
  });
  assert.ok(Array.isArray(logs));
});

await runTest('notifyAdminReviewRequired triggers without throwing when DB is offline', async () => {
  const fakeComplaint = {
    complaintId: 'CFX-TEST-004',
    title: 'Disputed Drainage Issue'
  };
  const logs = await notifyAdminReviewRequired({
    complaint: fakeComplaint,
    reason: 'Rejected 3 times',
    reopenCount: 3
  });
  assert.ok(Array.isArray(logs));
});

console.log(`\n======================================================`);
console.log(`Phase 19 Backend Tests Completed: ${passed} passed, ${failed} failed`);
console.log(`======================================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
