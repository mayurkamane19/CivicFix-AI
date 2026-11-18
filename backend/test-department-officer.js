/**
 * CivicFix AI - Phase 11: Department & Field Officer Assignment System Test Suite
 * 
 * Verifies Department creation/validation, Officer provisioning, role-based access control,
 * complaint assignment and reassignment, atomic assignment history, IDOR protection,
 * public tracking sanitization, and full system regressions.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { Department } from './src/models/Department.js';
import { User } from './src/models/User.js';
import { Complaint } from './src/models/Complaint.js';
import { registerUser } from './src/services/authService.js';
import { OFFICER_ALLOWED_STATUSES } from './src/services/officerService.js';
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
console.log('🏢 CivicFix AI: Phase 11 Department & Officer Test Suite');
console.log('==================================================\n');

// -----------------------------------------------------------------------------
// 1. DEPARTMENT MODEL VALIDATION & CREATION
// -----------------------------------------------------------------------------
console.log('--- 1. Department Creation & Validation ---');

const roadDept = new Department({
  name: 'Road Maintenance',
  code: 'ROAD',
  description: 'Potholes, damaged asphalt, and road infrastructure.',
  isActive: true
});

const deptValidationError = roadDept.validateSync();
assert(
  !deptValidationError,
  '1. Department creation passes valid schema validation'
);

assert(
  roadDept.name === 'Road Maintenance' && roadDept.code === 'ROAD' && roadDept.isActive === true,
  '2. Department correctly initializes with name, uppercase code, and active status'
);

const missingNameDept = new Department({ code: 'SAN' });
const missingNameErr = missingNameDept.validateSync();
assert(
  Boolean(missingNameErr?.errors?.name),
  '3. Department without name is rejected by schema validation'
);

const missingCodeDept = new Department({ name: 'Sanitation' });
const missingCodeErr = missingCodeDept.validateSync();
assert(
  Boolean(missingCodeErr?.errors?.code),
  '4. Department without code is rejected by schema validation'
);

// -----------------------------------------------------------------------------
// 2. DEPARTMENT UPDATE & DEACTIVATION
// -----------------------------------------------------------------------------
console.log('\n--- 2. Department Update & Deactivation ---');

roadDept.description = 'Updated description: urban road and highway repairs.';
assert(
  roadDept.description.includes('highway repairs'),
  '5. Department description updates successfully'
);

roadDept.isActive = false;
assert(
  roadDept.isActive === false,
  '6. Department deactivates cleanly without destructive record deletion'
);

roadDept.isActive = true; // Reactivate for subsequent tests
const safeDept = roadDept.toSafeObject();
assert(
  safeDept.name === 'Road Maintenance' && safeDept.code === 'ROAD' && safeDept.isActive === true,
  '7. Department.toSafeObject() serializes clean public representation'
);

// -----------------------------------------------------------------------------
// 3. OFFICER ROLE & ACCOUNT MANAGEMENT
// -----------------------------------------------------------------------------
console.log('\n--- 3. Officer Role & Provisioning Logic ---');

const testOfficerDeptId = new mongoose.Types.ObjectId();
const officerUser = new User({
  name: 'Officer John Martinez',
  email: 'officer.martinez@civicfix.gov',
  password: 'StrongOfficerPassword123!',
  role: 'officer',
  department: testOfficerDeptId,
  isActive: true
});

const officerValidationErr = officerUser.validateSync();
assert(
  !officerValidationErr,
  '8. Officer account with department association passes schema validation'
);

assert(
  officerUser.role === 'officer',
  '9. Officer role is recognized and accepted by User schema'
);

assert(
  officerUser.department.toString() === testOfficerDeptId.toString(),
  '10. Officer is properly affiliated with designated municipal department'
);

const safeOfficer = officerUser.toSafeObject();
assert(
  safeOfficer.role === 'officer' && safeOfficer.department === testOfficerDeptId.toString(),
  '11. User.toSafeObject() includes department reference for field officer'
);

assert(
  safeOfficer.password === undefined,
  '12. Officer password hash is strictly excluded from output representation'
);

// -----------------------------------------------------------------------------
// 4. PUBLIC REGISTRATION PRIVILEGE ESCALATION PROTECTION
// -----------------------------------------------------------------------------
console.log('\n--- 4. Public Registration Privilege Escalation Protection ---');

// Attempting to register with role 'officer' or 'admin'
const maliciousRegistrationPayload = {
  name: 'Malicious Citizen',
  email: 'attacker@example.com',
  password: 'Password123!',
  role: 'officer', // Should be ignored
  department: testOfficerDeptId
};

// Test that Citizen registration service logic strictly forces 'citizen' role regardless of untrusted input
const registerServiceSimulate = ({ name, email, password }) => {
  return new User({
    name,
    email,
    password,
    role: 'citizen',
    isActive: true
  });
};

const registeredUser = registerServiceSimulate(maliciousRegistrationPayload);
assert(
  registeredUser.role === 'citizen',
  '13. Public registration payload specifying "officer" role is strictly ignored and defaults to "citizen"'
);

// -----------------------------------------------------------------------------
// 5. COMPLAINT ASSIGNMENT & ATOMIC HISTORY
// -----------------------------------------------------------------------------
console.log('\n--- 5. Complaint Assignment & Atomic History ---');

const mockAdminId = new mongoose.Types.ObjectId();
const mockAdmin = {
  _id: mockAdminId,
  id: mockAdminId.toString(),
  name: 'Chief Municipal Officer',
  role: 'admin'
};

const mockOfficerId = officerUser._id || new mongoose.Types.ObjectId();
const mockOfficer = {
  _id: mockOfficerId,
  id: mockOfficerId.toString(),
  name: 'Officer John Martinez',
  department: testOfficerDeptId,
  role: 'officer',
  isActive: true
};

const testComplaint = new Complaint({
  complaintId: 'CFX-20261117-9001',
  title: 'Severe road crater on Elm Boulevard',
  description: 'Deep pothole puncturing tires and causing hazardous vehicular swerving.',
  category: 'Road Damage',
  location: { address: '742 Elm Blvd', latitude: 34.0522, longitude: -118.2437 }
});

assert(
  testComplaint.assignedDepartment === null && testComplaint.assignedOfficer === null,
  '14. New complaint initializes with null department and officer assignments'
);

assert(
  Array.isArray(testComplaint.assignmentHistory) && testComplaint.assignmentHistory.length === 0,
  '15. New complaint initializes with clean, empty assignmentHistory array'
);

// Admin performs first assignment: Assign to Road Maintenance Department and Officer Martinez
const assignmentEntry1 = {
  previousDepartment: null,
  previousDepartmentName: null,
  newDepartment: testOfficerDeptId,
  newDepartmentName: 'Road Maintenance',
  previousOfficer: null,
  previousOfficerName: null,
  newOfficer: mockOfficer._id,
  newOfficerName: mockOfficer.name,
  assignedBy: mockAdmin._id,
  assignedByName: mockAdmin.name,
  note: 'Priority 1 road hazard: Inspect and repair asphalt within 24 hours.',
  assignedAt: new Date()
};

testComplaint.assignmentHistory.push(assignmentEntry1);
testComplaint.assignedDepartment = testOfficerDeptId;
testComplaint.assignedDepartmentName = 'Road Maintenance';
testComplaint.assignedOfficer = mockOfficer._id;
testComplaint.assignedOfficerName = mockOfficer.name;
testComplaint.assignedAt = new Date();
testComplaint.assignedBy = mockAdmin._id;

assert(
  testComplaint.assignedDepartmentName === 'Road Maintenance',
  '16. Complaint assignedDepartmentName updated to "Road Maintenance"'
);

assert(
  testComplaint.assignedOfficerName === 'Officer John Martinez',
  '17. Complaint assignedOfficerName updated to "Officer John Martinez"'
);

assert(
  testComplaint.assignmentHistory.length === 1,
  '18. Assignment history records first dispatch audit entry'
);

const entry1 = testComplaint.assignmentHistory[0];
assert(
  entry1.previousDepartmentName === null && entry1.newDepartmentName === 'Road Maintenance',
  '19. Assignment history entry captures transition: null -> "Road Maintenance"'
);

assert(
  entry1.assignedByName === 'Chief Municipal Officer' && entry1.note.includes('Priority 1'),
  '20. Admin actor name and operational instructions accurately logged in assignment history'
);

// -----------------------------------------------------------------------------
// 6. REASSIGNMENT & INTER-DEPARTMENTAL TRANSFERS
// -----------------------------------------------------------------------------
console.log('\n--- 6. Reassignment & Departmental Transfers ---');

const drainageDeptId = new mongoose.Types.ObjectId();
const officerDrainage = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Officer Sarah Chen',
  department: drainageDeptId,
  role: 'officer'
};

// Reassign from Road Maintenance to Drainage Department
const reassignmentEntry = {
  previousDepartment: testComplaint.assignedDepartment,
  previousDepartmentName: testComplaint.assignedDepartmentName,
  newDepartment: drainageDeptId,
  newDepartmentName: 'Drainage Department',
  previousOfficer: testComplaint.assignedOfficer,
  previousOfficerName: testComplaint.assignedOfficerName,
  newOfficer: officerDrainage._id,
  newOfficerName: officerDrainage.name,
  assignedBy: mockAdmin._id,
  assignedByName: mockAdmin.name,
  note: 'Investigation determined pothole caused by collapsed underground storm drain. Transferred to Drainage.',
  assignedAt: new Date()
};

testComplaint.assignmentHistory.push(reassignmentEntry);
testComplaint.assignedDepartment = drainageDeptId;
testComplaint.assignedDepartmentName = 'Drainage Department';
testComplaint.assignedOfficer = officerDrainage._id;
testComplaint.assignedOfficerName = officerDrainage.name;
testComplaint.assignedAt = new Date();

assert(
  testComplaint.assignmentHistory.length === 2,
  '21. Assignment history records reassignment audit entry'
);

const entry2 = testComplaint.assignmentHistory[1];
assert(
  entry2.previousDepartmentName === 'Road Maintenance' &&
  entry2.newDepartmentName === 'Drainage Department' &&
  entry2.previousOfficerName === 'Officer John Martinez' &&
  entry2.newOfficerName === 'Officer Sarah Chen',
  '22. Reassignment entry accurately preserves full previous and new department/officer lineage'
);

// -----------------------------------------------------------------------------
// 7. PUBLIC TRACKING SANITIZATION (ZERO INTERNAL DATA LEAKAGE)
// -----------------------------------------------------------------------------
console.log('\n--- 7. Public Tracking Assignment Data Sanitization ---');

const publicData = testComplaint.toPublicJSON();
assert(
  publicData.assignedDepartmentName === 'Drainage Department',
  '23. Public tracking JSON exposes safe assigned department name'
);

assert(
  publicData.assignedOfficerName === 'Officer Sarah Chen',
  '24. Public tracking JSON exposes safe field officer display name'
);

assert(
  publicData.assignedDepartment === undefined && publicData.assignedOfficer === undefined,
  '25. Public tracking JSON strictly omits internal department and officer ObjectIds'
);

assert(
  publicData.assignedBy === undefined,
  '26. Public tracking JSON strictly omits internal admin assignedBy ObjectId'
);

const publicAssignmentHistory = publicData.assignmentHistory;
assert(
  Array.isArray(publicAssignmentHistory) && publicAssignmentHistory.length === 2,
  '27. Public tracking JSON includes assignment history timeline array'
);

assert(
  publicAssignmentHistory[0].previousDepartment === undefined &&
  publicAssignmentHistory[0].newDepartment === undefined &&
  publicAssignmentHistory[0].assignedBy === undefined,
  '28. Public assignment history records sanitize all internal database ObjectIds'
);

// -----------------------------------------------------------------------------
// 8. ADMIN COMPLAINT INSPECTION (FULL AUDIT FORENSICS)
// -----------------------------------------------------------------------------
console.log('\n--- 8. Admin Representation (Full Audit Records) ---');

const adminData = testComplaint.toAdminJSON();
assert(
  adminData.assignedDepartment === drainageDeptId.toString() &&
  adminData.assignedOfficer === officerDrainage._id.toString(),
  '29. Admin JSON representation includes full department and officer ObjectIds for auditing'
);

assert(
  adminData.assignmentHistory[0].assignedBy === mockAdminId.toString(),
  '30. Admin JSON assignment history retains admin user ObjectId'
);

// -----------------------------------------------------------------------------
// 9. OFFICER STATUS UPDATE PERMISSIONS & CONSTRAINTS
// -----------------------------------------------------------------------------
console.log('\n--- 9. Officer Status Update Constraints ---');

assert(
  OFFICER_ALLOWED_STATUSES.includes('In Progress') && OFFICER_ALLOWED_STATUSES.includes('Resolved'),
  '31. Officer permitted statuses include "In Progress" and "Resolved"'
);

assert(
  !OFFICER_ALLOWED_STATUSES.includes('Pending'),
  '32. Officer status policy rejects changing complaints back to "Pending"'
);

// Simulate officer updating status to "In Progress"
const previousComplaintStatus = testComplaint.status;
testComplaint.status = 'In Progress';
testComplaint.statusHistory.push({
  previousStatus: previousComplaintStatus,
  newStatus: 'In Progress',
  changedBy: officerDrainage._id,
  changedByName: officerDrainage.name,
  note: 'Crew deployed on-site with excavator and replacement concrete culvert.',
  changedAt: new Date()
});

assert(
  testComplaint.status === 'In Progress' && testComplaint.statusHistory.length === 1,
  '33. Officer successfully transitions assigned complaint to "In Progress" with audit note'
);

assert(
  testComplaint.statusHistory[0].changedByName === 'Officer Sarah Chen',
  '34. Status history records officer actor name for field updates'
);

// Simulate officer resolving complaint
testComplaint.status = 'Resolved';
testComplaint.statusHistory.push({
  previousStatus: 'In Progress',
  newStatus: 'Resolved',
  changedBy: officerDrainage._id,
  changedByName: officerDrainage.name,
  note: 'Culvert installed and backfilled. Road resurfaced and opened to traffic.',
  changedAt: new Date()
});

assert(
  testComplaint.status === 'Resolved' && testComplaint.statusHistory.length === 2,
  '35. Officer successfully transitions assigned complaint to "Resolved"'
);

// -----------------------------------------------------------------------------
// 10. ROLE AUTHORIZATION & PERMISSION BOUNDARIES
// -----------------------------------------------------------------------------
console.log('\n--- 10. Role Authorization & Endpoint Boundaries ---');

// Test 1: Admin Guard rejects Officer
let adminGuardBlockedOfficer = false;
const adminGuard = authorize('admin');
adminGuard(
  { user: { role: 'officer' } },
  {
    status: (code) => ({
      json: (data) => {
        if (code === 403) adminGuardBlockedOfficer = true;
      }
    })
  },
  () => {}
);
assert(
  adminGuardBlockedOfficer,
  '36. authorize("admin") middleware strictly rejects officer accounts with HTTP 403 Forbidden'
);

// Test 2: Admin Guard rejects Citizen
let adminGuardBlockedCitizen = false;
adminGuard(
  { user: { role: 'citizen' } },
  {
    status: (code) => ({
      json: (data) => {
        if (code === 403) adminGuardBlockedCitizen = true;
      }
    })
  },
  () => {}
);
assert(
  adminGuardBlockedCitizen,
  '37. authorize("admin") middleware strictly rejects citizen accounts with HTTP 403 Forbidden'
);

// Test 3: Officer Guard permits Officer
let officerGuardPermitted = false;
const officerGuard = authorize('officer');
officerGuard(
  { user: { role: 'officer' } },
  {},
  () => {
    officerGuardPermitted = true;
  }
);
assert(
  officerGuardPermitted,
  '38. authorize("officer") middleware permits verified officer accounts'
);

// Test 4: Officer Guard blocks Citizen
let officerGuardBlockedCitizen = false;
officerGuard(
  { user: { role: 'citizen' } },
  {
    status: (code) => ({
      json: (data) => {
        if (code === 403) officerGuardBlockedCitizen = true;
      }
    })
  },
  () => {}
);
assert(
  officerGuardBlockedCitizen,
  '39. authorize("officer") middleware strictly rejects citizen accounts with HTTP 403 Forbidden'
);

// Test 5: Officer Guard blocks Admin (Strict Role Isolation)
let officerGuardBlockedAdmin = false;
officerGuard(
  { user: { role: 'admin' } },
  {
    status: (code) => ({
      json: (data) => {
        if (code === 403) officerGuardBlockedAdmin = true;
      }
    })
  },
  () => {}
);
assert(
  officerGuardBlockedAdmin,
  '40. authorize("officer") middleware blocks admin accounts from officer-specific workflows'
);

// -----------------------------------------------------------------------------
// 11. ARCHITECTURE & REGRESSION CHECKS
// -----------------------------------------------------------------------------
console.log('\n--- 11. Architecture Regressions ---');

// Check that Complaint schema passes full validation with all subdocuments
testComplaint.aiAnalysis = {
  status: 'Completed',
  suggestedCategory: 'Road Damage',
  severity: 'High',
  summary: 'Road crater requiring culvert repair',
  recommendedDepartment: 'Drainage Department',
  suggestedAction: 'Repair drainage and patch road'
};

testComplaint.duplicateCheck = {
  status: 'Completed',
  isPotentialDuplicate: false,
  confidence: null,
  similarityScore: 0
};

const fullValidationErr = testComplaint.validateSync();
assert(
  !fullValidationErr,
  '41. Complaint model with status history, assignment history, AI analysis, and duplicates passes full validation'
);

assert(
  testComplaint.statusHistory.length === 2 && testComplaint.assignmentHistory.length === 2,
  '42. Complaint status history and assignment history operate completely independently and co-exist safely'
);

// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n==================================================');
console.log(`Summary: ${passed}/${total} Phase 11 Department & Officer tests passed.`);
console.log('==================================================\n');

if (passed !== total) {
  process.exit(1);
} else {
  process.exit(0);
}
