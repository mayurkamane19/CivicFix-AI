/**
 * CivicFix AI — Phase 23 Technical Audit & Verification Suite
 * Comprehensive automated testing for Phase 1–22 full codebase inspection:
 * - Authentication, JWT, and RBAC (Citizen, Officer, Admin, Ward Admin, Department Head)
 * - Ward-Level Data Isolation (Ward A vs Ward B access denial & transfer security)
 * - Department Head Scoping & Assignment Controls
 * - Inter-Ward Complaint Transfer with SLA Preservation
 * - Security Defenses: Anti-IDOR, Formula Injection, PII Stripping
 */

import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { User } from './src/models/User.js';
import { Ward } from './src/models/Ward.js';
import { Department } from './src/models/Department.js';
import { Complaint } from './src/models/Complaint.js';
import { PushSubscription } from './src/models/PushSubscription.js';
import {
  createWard,
  getWardById,
  getWardAnalytics,
  transferComplaintBetweenWards
} from './src/services/wardService.js';
import {
  getWardDetailsController,
  getWardOfficersController,
  getWardAnalyticsController,
  transferComplaintController
} from './src/controllers/wardController.js';
import {
  getComplaints,
  getComplaintById,
  assignComplaintController
} from './src/controllers/adminController.js';
import { exportMunicipalWardCsv } from './src/services/wardService.js';
import { protect, authorize } from './src/middleware/authMiddleware.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${message}`);
  }
}

console.log('===============================================================');
console.log('🔍 CivicFix AI: Phase 23 Complete A to Z Audit Test Suite');
console.log('===============================================================\n');

// Mock active DB connection for service layer
mongoose.connection.readyState = 1;

// --- SECTION 1: Authentication & Token Security ---
console.log('--- 1. Authentication, JWT & Token Security ---');

const JWT_SECRET = 'civicfix_test_secret_for_audit_2026_safe_key_at_least_32_chars';
process.env.JWT_SECRET = JWT_SECRET;

// 1.1 Valid JWT generation & decode
const testUser = {
  id: new mongoose.Types.ObjectId().toString(),
  name: 'Test Citizen',
  email: 'citizen@civicfix.test',
  role: 'citizen'
};
const validToken = jwt.sign(testUser, JWT_SECRET, { expiresIn: '1h' });
const decoded = jwt.verify(validToken, JWT_SECRET);
assert(decoded.email === testUser.email, '1.1 Valid JWT decodes correctly with original payload');

// 1.2 Tampered token rejected
let tamperedError = false;
try {
  jwt.verify(validToken + 'tampered', JWT_SECRET);
} catch (e) {
  tamperedError = true;
}
assert(tamperedError, '1.2 Tampered JWT token is strictly rejected');

// 1.3 Expired token rejected
const expiredToken = jwt.sign(testUser, JWT_SECRET, { expiresIn: '-1s' });
let expiredError = false;
try {
  jwt.verify(expiredToken, JWT_SECRET);
} catch (e) {
  expiredError = e.name === 'TokenExpiredError';
}
assert(expiredError, '1.3 Expired token triggers TokenExpiredError');

// 1.4 Missing Authorization header rejected by protect
let protectCalledNext = false;
let protectStatus = null;
let protectMessage = null;
const reqNoAuth = { headers: {} };
const resNoAuth = {
  status: (code) => {
    protectStatus = code;
    return {
      json: (data) => { protectMessage = data.message; }
    };
  }
};
protect(reqNoAuth, resNoAuth, () => { protectCalledNext = true; });
assert(!protectCalledNext && protectStatus === 401, '1.4 Missing Authorization header returns HTTP 401');

// 1.5 Role authorization guards
let authAdminNext = false;
let authAdminStatus = null;
const reqCitizen = { user: { role: 'citizen' } };
const resCitizen = {
  status: (code) => {
    authAdminStatus = code;
    return { json: () => {} };
  }
};
authorize('admin')(reqCitizen, resCitizen, () => { authAdminNext = true; });
assert(!authAdminNext && authAdminStatus === 403, '1.5 Citizen role is strictly blocked by authorize("admin") with HTTP 403');

let authWardAdminNext = false;
const reqWardAdmin = { user: { role: 'ward_admin' } };
authorize('admin', 'ward_admin')(reqWardAdmin, {}, () => { authWardAdminNext = true; });
assert(authWardAdminNext, '1.6 Ward Administrator role is permitted by authorize("admin", "ward_admin")');

let authDeptHeadNext = false;
const reqDeptHead = { user: { role: 'department_head' } };
authorize('admin', 'department_head')(reqDeptHead, {}, () => { authDeptHeadNext = true; });
assert(authDeptHeadNext, '1.7 Department Head role is permitted by authorize("admin", "department_head")');


// --- SECTION 2: Ward-Level Data Isolation (Ward A vs Ward B) ---
console.log('\n--- 2. Ward-Level Data Isolation & Access Controls ---');

const wardAId = new mongoose.Types.ObjectId();
const wardBId = new mongoose.Types.ObjectId();

const wardAdminA = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Ward A Admin',
  role: 'ward_admin',
  ward: wardAId
};

const wardAdminB = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Ward B Admin',
  role: 'ward_admin',
  ward: wardBId
};

const municipalAdmin = {
  _id: new mongoose.Types.ObjectId(),
  name: 'City Municipal Director',
  role: 'admin',
  ward: null
};

// 2.1 Ward A admin denied access to Ward B details
let wardBDetailsDenied = false;
const reqWardADetailsB = {
  params: { id: wardBId.toString() },
  user: wardAdminA
};
const resWardADetailsB = {
  status: (code) => {
    if (code === 403) wardBDetailsDenied = true;
    return { json: () => {} };
  }
};
await getWardDetailsController(reqWardADetailsB, resWardADetailsB, () => {});
assert(wardBDetailsDenied, '2.1 Ward A administrator is denied access to Ward B details (HTTP 403)');

// 2.2 Ward A admin denied access to Ward B officers
let wardBOfficersDenied = false;
const reqWardAOfficersB = {
  params: { id: wardBId.toString() },
  user: wardAdminA
};
const resWardAOfficersB = {
  status: (code) => {
    if (code === 403) wardBOfficersDenied = true;
    return { json: () => {} };
  }
};
await getWardOfficersController(reqWardAOfficersB, resWardAOfficersB, () => {});
assert(wardBOfficersDenied, '2.2 Ward A administrator is denied access to Ward B officers roster (HTTP 403)');

// 2.3 Ward A admin denied access to Ward B analytics
let wardBAnalyticsDenied = false;
const reqWardAAnalyticsB = {
  params: { id: wardBId.toString() },
  query: {},
  user: wardAdminA
};
const resWardAAnalyticsB = {
  status: (code) => {
    if (code === 403) wardBAnalyticsDenied = true;
    return { json: () => {} };
  }
};
await getWardAnalyticsController(reqWardAAnalyticsB, resWardAAnalyticsB, () => {});
assert(wardBAnalyticsDenied, '2.3 Ward A administrator is denied access to Ward B analytics (HTTP 403)');


// --- SECTION 3: Inter-Ward Complaint Transfer & Authorization ---
console.log('\n--- 3. Inter-Ward Complaint Transfer Scoping & SLA Preservation ---');

// Mock Complaint & Ward documents for transfer test
const mockComplaintWardB = {
  complaintId: 'CFX-20261121-0001',
  title: 'Pothole in Ward B',
  ward: wardBId,
  sla: {
    status: 'Within SLA',
    deadline: new Date(Date.now() + 72 * 3600 * 1000),
    targetResolutionHours: 72,
    priority: 'High'
  },
  wardTransferHistory: []
};

Complaint.findOne = async ({ complaintId }) => {
  if (complaintId === 'CFX-20261121-0001') return { ...mockComplaintWardB, save: async () => {} };
  return null;
};

// 3.1 Ward A admin cannot transfer Ward B complaints
let crossWardTransferError = false;
try {
  await transferComplaintBetweenWards('CFX-20261121-0001', {
    destinationWardId: wardAId.toString(),
    reason: 'Trying to transfer a ticket that does not belong to my ward',
    adminUser: wardAdminA
  });
} catch (err) {
  if (err.statusCode === 403) crossWardTransferError = true;
}
assert(crossWardTransferError, '3.1 Ward A administrator cannot transfer Ward B complaints (HTTP 403)');

// 3.2 Transfer reason < 10 characters rejected
let shortReasonError = false;
try {
  await transferComplaintBetweenWards('CFX-20261121-0001', {
    destinationWardId: wardAId.toString(),
    reason: 'Too short',
    adminUser: municipalAdmin
  });
} catch (err) {
  if (err.statusCode === 400) shortReasonError = true;
}
assert(shortReasonError, '3.2 Transfer reason under 10 characters is rejected with HTTP 400');

// 3.3 SLA deadline is strictly preserved during authorized transfer
const complaintToTransfer = {
  complaintId: 'CFX-20261121-0002',
  title: 'Water logging near market',
  ward: wardAId,
  wardName: 'Ward A',
  wardCode: 'WARD-A',
  sla: {
    status: 'Within SLA',
    deadline: new Date(Date.now() + 48 * 3600 * 1000),
    targetResolutionHours: 48,
    priority: 'High'
  },
  wardTransferHistory: [],
  save: async function () { return this; }
};

Complaint.findOne = async ({ complaintId }) => {
  if (complaintId === 'CFX-20261121-0002') return complaintToTransfer;
  return null;
};

Ward.findById = async (id) => {
  if (id.toString() === wardBId.toString()) {
    return {
      _id: wardBId,
      name: 'Ward B',
      code: 'WARD-B',
      isActive: true,
      assignedOfficers: []
    };
  }
  return null;
};

const originalDeadline = new Date(complaintToTransfer.sla.deadline).getTime();
await transferComplaintBetweenWards('CFX-20261121-0002', {
  destinationWardId: wardBId.toString(),
  reason: 'Transferred to Ward B for jurisdictional maintenance',
  adminUser: wardAdminA
});

assert(
  new Date(complaintToTransfer.sla.deadline).getTime() === originalDeadline,
  '3.3 SLA deadline is strictly preserved without reset or extension after ward transfer'
);
assert(
  complaintToTransfer.ward.toString() === wardBId.toString(),
  '3.4 Complaint ward reference is correctly updated to destination ward'
);
assert(
  complaintToTransfer.wardTransferHistory.length === 1,
  '3.5 Inter-ward transfer audit entry is recorded in complaint history'
);


// --- SECTION 4: Department Head Scoping & Assignment ---
console.log('\n--- 4. Department Head Scoping & Assignment Controls ---');

const deptWaterId = new mongoose.Types.ObjectId();
const deptRoadId = new mongoose.Types.ObjectId();

const deptHeadWater = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Water Works Supervisor',
  role: 'department_head',
  department: deptWaterId
};

// 4.1 Department Head cannot assign to a different department
let crossDeptAssignBlocked = false;
const reqCrossDeptAssign = {
  params: { complaintId: 'CFX-20261121-0002' },
  body: { departmentId: deptRoadId.toString(), note: 'Assign to Road department' },
  user: deptHeadWater
};
const resCrossDeptAssign = {
  status: (code) => {
    if (code === 403) crossDeptAssignBlocked = true;
    return { json: () => {} };
  }
};
await assignComplaintController(reqCrossDeptAssign, resCrossDeptAssign, () => {});
assert(crossDeptAssignBlocked, '4.1 Department Head is blocked from assigning complaints to another department (HTTP 403)');


// --- SECTION 5: Security Defenses & Anti-IDOR ---
console.log('\n--- 5. Defensive Security & Anti-IDOR Protections ---');

// 5.1 PushSubscription model validation
const invalidPush = new PushSubscription({});
const pushValidationError = invalidPush.validateSync();
assert(pushValidationError !== null && pushValidationError.errors.user, '5.1 PushSubscription rejects missing user reference');
assert(pushValidationError !== null && pushValidationError.errors.endpoint, '5.2 PushSubscription rejects missing endpoint URL');

// 5.2 CSV Formula Injection Defense
Ward.find = () => Promise.resolve([
  {
    _id: wardAId,
    name: 'Ward A',
    code: 'WARD-A',
    number: 1,
    zone: 'Central Zone',
    municipality: 'City Corp',
    population: 50000,
    areaKm2: 12.5,
    isActive: true,
    assignedDepartments: []
  }
]);

Complaint.find = () => ({
  populate: () => ({
    sort: () => ({
      limit: () => Promise.resolve([
        {
          complaintId: 'CFX-20261121-0003',
          title: '=cmd|"/C calc"!A0',
          category: 'Road Damage',
          status: 'Resolved',
          ward: wardAId,
          wardName: 'Ward A',
          wardCode: 'WARD-A',
          location: { address: '+123 Danger Street' },
          createdAt: new Date(),
          sla: { status: 'Resolved Within SLA', deadline: new Date() }
        }
      ])
    })
  })
});

const safeCsv = await exportMunicipalWardCsv();
assert(!safeCsv.includes('\n=cmd') && !safeCsv.includes('\n+123'), '5.3 CSV export neutralizes formula injection characters (=, +, -, @)');

// 5.3 User.toSafeObject() never exposes password hash
const safeUserObj = new User({
  name: 'Audit Citizen',
  email: 'citizen_audit@civicfix.test',
  password: 'Password123#Secure',
  role: 'citizen'
}).toSafeObject();
assert(safeUserObj.password === undefined, '5.4 User.toSafeObject() strictly excludes password hash');


// --- SUMMARY ---
console.log('\n===============================================================');
console.log(`Phase 23 Audit Suite: ${passedTests}/${totalTests} passed (${failedTests} failed)`);
console.log('===============================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
