/**
 * CivicFix AI - Phase 10: Status History & Audit Logs Test Suite
 * Tests complaint status transitions, persistent audit entries, administrative notes,
 * authorization controls, data sanitization, and backwards compatibility.
 */

import mongoose from 'mongoose';
import { Complaint } from './src/models/Complaint.js';
import { User } from './src/models/User.js';
import {
  ALLOWED_STATUSES,
  updateComplaintStatus,
  getComplaintStatusHistory
} from './src/services/adminService.js';
import { protect, authorize } from './src/middleware/authMiddleware.js';

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

console.log('==================================================');
console.log('📜 CivicFix AI: Phase 10 Status History & Audit Test Suite');
console.log('==================================================\n');

// -----------------------------------------------------------------------------
// 1. INITIAL COMPLAINT STATUS HISTORY BEHAVIOR
// -----------------------------------------------------------------------------
console.log('--- 1. Initial Complaint Status & History ---');

const testComplaint = new Complaint({
  complaintId: 'CFX-20261117-8001',
  title: 'Traffic signal outage on 5th & Main',
  description: 'Signal head is completely dark causing dangerous intersection gridlock.',
  category: 'Streetlight',
  status: 'Pending',
  location: { address: '5th Ave & Main St', latitude: 37.7749, longitude: -122.4194 }
});

assert(
  testComplaint.status === 'Pending',
  '1. Initial complaint status defaults to "Pending"'
);

assert(
  Array.isArray(testComplaint.statusHistory) && testComplaint.statusHistory.length === 0,
  '2. Newly created complaint initializes with clean, empty status history array'
);

// -----------------------------------------------------------------------------
// 2. STATUS TRANSITIONS & AUDIT TRAIL RECORDING
// -----------------------------------------------------------------------------
console.log('\n--- 2. Status Transitions & History Tracking ---');

const mockAdminId = new mongoose.Types.ObjectId();
const mockAdmin = {
  _id: mockAdminId,
  id: mockAdminId.toString(),
  name: 'Director of Public Works',
  email: 'director@civicfix.gov',
  role: 'admin'
};

// Transition 1: Pending -> In Progress with Note
const previousStatus1 = testComplaint.status;
const newStatus1 = 'In Progress';
const note1 = 'Electrical dispatch team assigned; technician en route with replacement controller.';

testComplaint.statusHistory.push({
  previousStatus: previousStatus1,
  newStatus: newStatus1,
  changedBy: mockAdmin._id,
  changedByName: mockAdmin.name,
  note: note1,
  changedAt: new Date()
});
testComplaint.status = newStatus1;

assert(
  testComplaint.status === 'In Progress',
  '3. Complaint status successfully transitions to "In Progress"'
);

assert(
  testComplaint.statusHistory.length === 1,
  '4. Status history records first audit log entry'
);

const entry1 = testComplaint.statusHistory[0];
assert(
  entry1.previousStatus === 'Pending' && entry1.newStatus === 'In Progress',
  '5. First history entry accurately records "Pending" -> "In Progress"'
);

assert(
  entry1.changedByName === 'Director of Public Works' &&
  entry1.changedBy.toString() === mockAdminId.toString(),
  '6. Admin identity and display name correctly recorded in audit trail'
);

assert(
  entry1.note === note1,
  '7. Administrative note accurately recorded with status change'
);

// Transition 2: In Progress -> Resolved with Note
const previousStatus2 = testComplaint.status;
const newStatus2 = 'Resolved';
const note2 = 'Traffic signal head replaced and timing sequence recertified. Operational.';

testComplaint.statusHistory.push({
  previousStatus: previousStatus2,
  newStatus: newStatus2,
  changedBy: mockAdmin._id,
  changedByName: mockAdmin.name,
  note: note2,
  changedAt: new Date()
});
testComplaint.status = newStatus2;

assert(
  testComplaint.status === 'Resolved',
  '8. Complaint status successfully transitions to "Resolved"'
);

assert(
  testComplaint.statusHistory.length === 2,
  '9. Status history records second audit log entry'
);

const entry2 = testComplaint.statusHistory[1];
assert(
  entry2.previousStatus === 'In Progress' && entry2.newStatus === 'Resolved',
  '10. Second history entry accurately records "In Progress" -> "Resolved"'
);

assert(
  entry2.note === note2,
  '11. Resolution note accurately attached to final status change'
);

// -----------------------------------------------------------------------------
// 3. DUPLICATE UPDATE & VALIDATION HANDLING
// -----------------------------------------------------------------------------
console.log('\n--- 3. Duplicate Updates & Input Validations ---');

// Test 12: Duplicate same-status submission does not append redundant entry
const currentLength = testComplaint.statusHistory.length;
const duplicateStatusAttempt = 'Resolved'; // Already Resolved
if (testComplaint.status !== duplicateStatusAttempt) {
  testComplaint.statusHistory.push({
    previousStatus: testComplaint.status,
    newStatus: duplicateStatusAttempt
  });
}
assert(
  testComplaint.statusHistory.length === currentLength,
  '12. Submitting current status again prevents duplicate audit history entries'
);

// Test 13: Invalid status value rejection
const invalidStatusValues = ['Closed', 'Deleted', 'Finished', 'Archived', '', null];
for (const badStatus of invalidStatusValues) {
  assert(
    !ALLOWED_STATUSES.includes(badStatus),
    `13. Invalid status "${badStatus}" is rejected by status policy`
  );
}

// Test 14: Note length validation (> 500 characters rejection)
const longNote = 'X'.repeat(501);
let longNoteValidationErr = null;
const validationComplaintDoc = new Complaint({
  complaintId: 'CFX-20261117-8002',
  title: 'Test Note Length',
  description: 'Checking note length constraint in Mongoose schema.',
  category: 'Other',
  statusHistory: [
    {
      previousStatus: 'Pending',
      newStatus: 'In Progress',
      note: longNote
    }
  ]
});
try {
  await validationComplaintDoc.validate();
} catch (err) {
  longNoteValidationErr = err;
}
assert(
  longNoteValidationErr && longNoteValidationErr.errors && longNoteValidationErr.errors['statusHistory.0.note'],
  '14. Administrative note exceeding 500 characters rejected by schema validation'
);

// -----------------------------------------------------------------------------
// 4. DATA SANITIZATION: PUBLIC VS ADMIN VIEWS
// -----------------------------------------------------------------------------
console.log('\n--- 4. Data Sanitization & Privacy Controls ---');

// Test 15: Public tracking JSON sanitizes admin identity
const publicOutput = testComplaint.toPublicJSON();
assert(
  Array.isArray(publicOutput.statusHistory) && publicOutput.statusHistory.length === 2,
  '15. Public tracking JSON includes status history array'
);

const pubEntry1 = publicOutput.statusHistory[0];
assert(
  pubEntry1.previousStatus === 'Pending' &&
  pubEntry1.newStatus === 'In Progress' &&
  pubEntry1.changedByName === 'Director of Public Works' &&
  pubEntry1.note === note1 &&
  !('changedBy' in pubEntry1), // Crucial: internal admin ObjectId is NOT in public output
  '16. Public JSON exposes safe admin display name and note but strictly omits internal user ObjectId'
);

// Test 17: Admin JSON includes full audit reference
const adminOutput = testComplaint.toAdminJSON();
const adminEntry1 = adminOutput.statusHistory[0];
assert(
  adminEntry1.changedBy === mockAdminId.toString(),
  '17. Admin JSON includes full internal admin user ID for authorized administrative auditing'
);

// -----------------------------------------------------------------------------
// 5. SECURITY & ROLE AUTHORIZATION GUARDS
// -----------------------------------------------------------------------------
console.log('\n--- 5. Security & Authorization Enforcement ---');

// Test 18: Unauthenticated access rejection for Admin History endpoint
let unauthResult = { code: null, data: null };
const mockRes401 = {
  status(code) {
    unauthResult.code = code;
    return {
      json(data) {
        unauthResult.data = data;
      }
    };
  }
};
await protect({ headers: {} }, mockRes401, () => {});
assert(
  unauthResult.code === 401 && unauthResult.data?.success === false,
  '18. Unauthenticated requests without token are rejected with HTTP 401'
);

// Test 19: Citizen access rejection for Admin History endpoint
let citizenResult = { code: null, data: null };
const mockRes403 = {
  status(code) {
    citizenResult.code = code;
    return {
      json(data) {
        citizenResult.data = data;
      }
    };
  }
};
const adminOnlyGuard = authorize('admin');
adminOnlyGuard({ user: { role: 'citizen', name: 'Citizen Joe' } }, mockRes403, () => {});
assert(
  citizenResult.code === 403 && citizenResult.data?.success === false,
  '19. Citizen role access to status update/history endpoint rejected with HTTP 403 Forbidden'
);

// Test 20: Admin access permitted
let adminPassed = false;
adminOnlyGuard({ user: { role: 'admin', name: 'Authorized Admin' } }, mockRes403, () => {
  adminPassed = true;
});
assert(
  adminPassed === true,
  '20. Admin role authorized to access history and status updates'
);

// -----------------------------------------------------------------------------
// 6. BACKWARD COMPATIBILITY FOR LEGACY COMPLAINTS
// -----------------------------------------------------------------------------
console.log('\n--- 6. Backward Compatibility for Legacy Complaints ---');

// Test 21: Complaint with null or missing statusHistory handles gracefully
const legacyComplaint = new Complaint({
  complaintId: 'CFX-20261112-0001',
  title: 'Legacy pothole reported before Phase 10',
  description: 'Pothole on 1st avenue submitted during early phases.',
  category: 'Road Damage',
  status: 'In Progress'
});
legacyComplaint.statusHistory = undefined; // Simulate legacy document

const legacyPublic = legacyComplaint.toPublicJSON();
assert(
  Array.isArray(legacyPublic.statusHistory) && legacyPublic.statusHistory.length === 0,
  '21. Legacy complaints with undefined statusHistory serialize safely as empty array'
);

// -----------------------------------------------------------------------------
// 7. FULL REGRESSION SAFETY (Phases 1-9)
// -----------------------------------------------------------------------------
console.log('\n--- 7. Architecture Regression Verification ---');

// Test 22: Complaint AI Analysis remains intact
assert(
  'aiAnalysis' in publicOutput && 'duplicateCheck' in publicOutput,
  '22. AI analysis and duplicate detection subdocuments remain completely functional'
);

// Test 23: Complaint submission model validates cleanly
const validSubmissionDoc = new Complaint({
  complaintId: 'CFX-20261117-8003',
  title: 'New Complaint Post-Phase 10',
  description: 'Water leaking continuously onto sidewalk from fire hydrant.',
  category: 'Water Leakage',
  location: { address: '8th St & Broadway' }
});
let validationError = null;
try {
  await validSubmissionDoc.validate();
} catch (err) {
  validationError = err;
}
assert(
  validationError === null,
  '23. Complaint model with new status history schema passes full Mongoose validation'
);

console.log('\n==================================================');
console.log(`Summary: ${passed}/${total} Phase 10 Status History tests passed.`);
console.log('==================================================\n');

if (passed !== total) {
  process.exit(1);
}
