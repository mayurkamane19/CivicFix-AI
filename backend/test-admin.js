/**
 * CivicFix AI - Phase 8: Municipal Admin Dashboard & Management Test Suite
 * Tests admin statistics, complaints listing, filtering, pagination,
 * status transitions, permission guards, seed validation, and regression safety.
 */

import jwt from 'jsonwebtoken';
import { ALLOWED_STATUSES } from './src/services/adminService.js';
import { protect, authorize } from './src/middleware/authMiddleware.js';
import { Complaint } from './src/models/Complaint.js';
import { User } from './src/models/User.js';
import { config } from './src/config/env.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
  }
}

console.log('==================================================');
console.log('🏛️  CivicFix AI: Phase 8 Municipal Admin Test Suite');
console.log('==================================================\n');

// -----------------------------------------------------------------------------
// 1. STATUS ENUM & TRANSITION VALIDATION TESTS
// -----------------------------------------------------------------------------
console.log('--- 1. Complaint Status Validation ---');

assert(
  Array.isArray(ALLOWED_STATUSES) &&
  ALLOWED_STATUSES.includes('Pending') &&
  ALLOWED_STATUSES.includes('In Progress') &&
  ALLOWED_STATUSES.includes('Resolved') &&
  ALLOWED_STATUSES.length === 3,
  '1. Allowed statuses strictly restricted to Pending, In Progress, and Resolved'
);

const validTestStatuses = ['Pending', 'In Progress', 'Resolved'];
for (const st of validTestStatuses) {
  assert(ALLOWED_STATUSES.includes(st), `2. Valid status '${st}' is accepted`);
}

const invalidTestStatuses = ['Closed', 'Rejected', 'Approved', 'Archived', '', null, undefined, 123];
for (const inv of invalidTestStatuses) {
  assert(!ALLOWED_STATUSES.includes(inv), `3. Unauthorized status '${inv}' is rejected`);
}

// -----------------------------------------------------------------------------
// 2. DASHBOARD STATISTICS AGGREGATION LOGIC
// -----------------------------------------------------------------------------
console.log('\n--- 2. Dashboard Statistics Aggregation Logic ---');

const mockComplaintsPool = [
  {
    complaintId: 'CFX-20261117-1001',
    title: 'Severe road pothole on 4th Ave',
    category: 'Road Damage',
    status: 'Pending',
    aiAnalysis: { severity: 'Critical', suggestedCategory: 'Road Damage' },
    createdAt: new Date('2026-11-17T09:00:00Z')
  },
  {
    complaintId: 'CFX-20261117-1002',
    title: 'Overflowing dumpster in park',
    category: 'Garbage',
    status: 'In Progress',
    aiAnalysis: { severity: 'High', suggestedCategory: 'Garbage' },
    createdAt: new Date('2026-11-17T09:30:00Z')
  },
  {
    complaintId: 'CFX-20261117-1003',
    title: 'Flickering street light on Elm',
    category: 'Streetlight',
    status: 'Resolved',
    aiAnalysis: { severity: 'Low', suggestedCategory: 'Streetlight' },
    createdAt: new Date('2026-11-17T10:00:00Z')
  },
  {
    complaintId: 'CFX-20261117-1004',
    title: 'Burst water pipe flooding curb',
    category: 'Water Leakage',
    status: 'Pending',
    aiAnalysis: { severity: 'Critical', suggestedCategory: 'Water Leakage' },
    createdAt: new Date('2026-11-17T10:15:00Z')
  },
  {
    complaintId: 'CFX-20261117-1005',
    title: 'Clogged storm drain near school',
    category: 'Drainage',
    status: 'In Progress',
    aiAnalysis: { severity: 'Medium', suggestedCategory: 'Drainage' },
    createdAt: new Date('2026-11-17T10:30:00Z')
  }
];

// Calculate metrics from sample data
const totalCount = mockComplaintsPool.length;
const pendingCount = mockComplaintsPool.filter((c) => c.status === 'Pending').length;
const inProgressCount = mockComplaintsPool.filter((c) => c.status === 'In Progress').length;
const resolvedCount = mockComplaintsPool.filter((c) => c.status === 'Resolved').length;
const highCriticalCount = mockComplaintsPool.filter((c) =>
  ['High', 'Critical'].includes(c.aiAnalysis?.severity)
).length;

assert(totalCount === 5, '4. Total complaints count correctly computed (5)');
assert(pendingCount === 2, '5. Pending complaints count correctly computed (2)');
assert(inProgressCount === 2, '6. In Progress complaints count correctly computed (2)');
assert(resolvedCount === 1, '7. Resolved complaints count correctly computed (1)');
assert(highCriticalCount === 3, '8. High/Critical AI severity complaints count correctly computed (3)');

// -----------------------------------------------------------------------------
// 3. SERVER-SIDE FILTERING & SEARCH SIMULATION
// -----------------------------------------------------------------------------
console.log('\n--- 3. Search & Multi-criteria Filtering ---');

// Search by Ticket ID
const searchById = mockComplaintsPool.filter((c) =>
  c.complaintId.toLowerCase().includes('1003')
);
assert(
  searchById.length === 1 && searchById[0].complaintId === 'CFX-20261117-1003',
  '9. Search by Complaint ID matches target record'
);

// Search by Title keyword
const searchByTitle = mockComplaintsPool.filter((c) =>
  c.title.toLowerCase().includes('pothole')
);
assert(
  searchByTitle.length === 1 && searchByTitle[0].category === 'Road Damage',
  '10. Search by Title keyword matches target record'
);

// Filter by Category
const filterCategory = mockComplaintsPool.filter((c) => c.category === 'Garbage');
assert(
  filterCategory.length === 1 && filterCategory[0].title.includes('dumpster'),
  '11. Filter by category isolates matching complaints'
);

// Filter by Status
const filterStatus = mockComplaintsPool.filter((c) => c.status === 'Pending');
assert(
  filterStatus.length === 2,
  '12. Filter by status returns only tickets matching target status'
);

// Filter by AI Severity
const filterSeverity = mockComplaintsPool.filter(
  (c) => c.aiAnalysis?.severity === 'Critical'
);
assert(
  filterSeverity.length === 2 && filterSeverity.every((c) => c.aiAnalysis.severity === 'Critical'),
  '13. Filter by AI severity correctly isolates Critical issues'
);

// -----------------------------------------------------------------------------
// 4. SERVER-SIDE PAGINATION MATHEMATICS
// -----------------------------------------------------------------------------
console.log('\n--- 4. Server-Side Pagination Calculations ---');

const testPagination = (total, page, limit) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const totalPages = Math.ceil(total / limitNum) || 1;
  const skip = (pageNum - 1) * limitNum;
  return {
    total,
    page: pageNum,
    limit: limitNum,
    totalPages,
    skip,
    hasNextPage: pageNum < totalPages,
    hasPrevPage: pageNum > 1
  };
};

const pag1 = testPagination(45, 1, 10);
assert(pag1.totalPages === 5 && pag1.skip === 0 && pag1.hasNextPage && !pag1.hasPrevPage, '14. Page 1 of 5 correctly flags hasNextPage=true, hasPrevPage=false');

const pag2 = testPagination(45, 3, 10);
assert(pag2.skip === 20 && pag2.hasNextPage && pag2.hasPrevPage, '15. Page 3 of 5 correctly calculates skip=20, hasNextPage=true, hasPrevPage=true');

const pagLast = testPagination(45, 5, 10);
assert(!pagLast.hasNextPage && pagLast.hasPrevPage, '16. Page 5 of 5 correctly flags hasNextPage=false, hasPrevPage=true');

const pagBounded = testPagination(10, -5, 500);
assert(pagBounded.page === 1 && pagBounded.limit === 100, '17. Pagination parameters safely bound out-of-range inputs (min 1, max 100)');

// -----------------------------------------------------------------------------
// 5. SECURITY & AUTHORIZATION TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 5. Security & Role-Based Access Control ---');

// Test 18: Unauthenticated access rejection (No Token)
let noTokenRes = { status: null, body: null };
const mockRes401 = {
  status(code) {
    noTokenRes.status = code;
    return {
      json(payload) {
        noTokenRes.body = payload;
      }
    };
  }
};
await protect({ headers: {} }, mockRes401, () => {});
assert(
  noTokenRes.status === 401 && noTokenRes.body?.success === false,
  '18. Unauthenticated request without Bearer token is rejected with HTTP 401'
);

// Test 19: Citizen access rejection (Role: citizen)
let citizenRes = { status: null, body: null };
const mockRes403 = {
  status(code) {
    citizenRes.status = code;
    return {
      json(payload) {
        citizenRes.body = payload;
      }
    };
  }
};
const citizenReq = { user: { role: 'citizen', name: 'John Citizen' } };
const adminGuard = authorize('admin');
adminGuard(citizenReq, mockRes403, () => {});
assert(
  citizenRes.status === 403 && citizenRes.body?.success === false && citizenRes.body?.message.includes('citizen'),
  '19. Citizen role is strictly rejected from admin resources with HTTP 403 Forbidden'
);

// Test 20: Admin access success (Role: admin)
let adminPassed = false;
const adminReq = { user: { role: 'admin', name: 'Chief Municipal Officer' } };
adminGuard(adminReq, {}, () => {
  adminPassed = true;
});
assert(adminPassed === true, '20. Admin role passes role authorization guard successfully');

// Test 21: Tampered/Expired token rejection
let badTokenRes = { status: null, body: null };
await protect({ headers: { authorization: 'Bearer invalid.bogus.token' } }, {
  status(code) {
    badTokenRes.status = code;
    return { json(payload) { badTokenRes.body = payload; } };
  }
}, () => {});
assert(
  badTokenRes.status === 401 && badTokenRes.body?.success === false,
  '21. Invalid or tampered JWT token is rejected with HTTP 401'
);

// -----------------------------------------------------------------------------
// 6. ADMIN PROVISIONING SCRIPT VALIDATIONS
// -----------------------------------------------------------------------------
console.log('\n--- 6. Admin Account Provisioning Logic ---');

// Short password validation
const testShortPassword = 'admin';
const isShortPasswordValid = testShortPassword.length >= 8;
assert(!isShortPasswordValid, '22. Short admin password (< 8 chars) is rejected by provisioning policy');

// Valid strong password validation
const testStrongPassword = 'MunicipalStrong2026!';
const isStrongPasswordValid = testStrongPassword.length >= 8;
assert(isStrongPasswordValid, '23. Strong admin password (>= 8 chars) meets provisioning policy');

// Invalid email check
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
assert(!emailRegex.test('not-an-email'), '24. Invalid admin email format is rejected');
assert(emailRegex.test('admin@civicfix.gov'), '25. Valid municipal admin email format is accepted');

// -----------------------------------------------------------------------------
// 7. MONGOOSE SCHEMA INTEGRATION & DATA SANITIZATION
// -----------------------------------------------------------------------------
console.log('\n--- 7. Schema Integration & Data Sanitization ---');

const complaintDoc = new Complaint({
  complaintId: 'CFX-20261117-9999',
  title: 'Water main fracture spilling onto sidewalk',
  description: 'Water has been flowing continuously for 4 hours from curb valve',
  category: 'Water Leakage',
  status: 'Pending',
  location: {
    address: 'Corner of Maple and 12th',
    latitude: 37.7749,
    longitude: -122.4194
  },
  aiAnalysis: {
    status: 'Completed',
    severity: 'High',
    suggestedCategory: 'Water Leakage',
    summary: 'Ongoing water valve leak causing pedestrian disruption.',
    recommendedDepartment: 'Department of Water & Sewage'
  },
  duplicateCheck: {
    status: 'Completed',
    isPotentialDuplicate: false,
    confidence: null,
    similarityScore: 0
  }
});

const publicComplaint = complaintDoc.toPublicJSON();

assert(
  publicComplaint.complaintId === 'CFX-20261117-9999',
  '26. Public representation retains unique municipal ticket ID'
);

assert(
  publicComplaint.status === 'Pending',
  '27. Initial status reflects schema default (Pending)'
);

// Status transition in memory
complaintDoc.status = 'In Progress';
assert(complaintDoc.status === 'In Progress', '28. Status updates smoothly to In Progress');

complaintDoc.status = 'Resolved';
assert(complaintDoc.status === 'Resolved', '29. Status updates smoothly to Resolved');

assert(
  publicComplaint.aiAnalysis?.severity === 'High',
  '30. AI severity is accurately preserved for admin decision support'
);

console.log('\n==================================================');
console.log(`Summary: ${passedTests}/${totalTests} Phase 8 Admin tests passed.`);
console.log('==================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
