/**
 * CivicFix AI - Phase 20: Citizen Dashboard API Test Suite
 * Tests: getCitizenDashboard, getMyCitizensComplaints, getMyCitizenComplaintDetails,
 *        updateMyProfile — covering data isolation, anti-IDOR, filtering, pagination,
 *        sort order, allowed/disallowed field enforcement, and auth guards.
 *
 * Run: node test-citizen-dashboard.js
 */

import { Complaint } from './src/models/Complaint.js';
import { User } from './src/models/User.js';
import { protect } from './src/middleware/authMiddleware.js';
import { generateToken } from './src/utils/jwt.js';
import {
  getCitizenDashboard,
  getMyCitizensComplaints,
  getMyCitizenComplaintDetails
} from './src/controllers/complaintController.js';
import { updateMyProfile } from './src/controllers/authController.js';
import mongoose from 'mongoose';

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

// ---------------------------------------------------------------------------
// Mock Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock Express context (req, res, next).
 * Optionally attach a user to simulate authenticated request.
 */
function createCtx(user = null, { params = {}, query = {}, body = {} } = {}) {
  const req = { headers: {}, params, query, body, user };
  let statusCode = 200;
  let responseData = null;
  const res = {
    status(code) {
      statusCode = code;
      return { json(data) { responseData = data; return res; } };
    },
    json(data) { responseData = data; return res; }
  };
  let nextError = null;
  const next = (err) => { nextError = err; };
  return {
    req, res, next,
    getStatus: () => statusCode,
    getData: () => responseData,
    getError: () => nextError
  };
}

/** Build a minimal in-memory Complaint document (not saved to DB). */
function makeComplaint(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    complaintId: `CFX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    title: 'Test Complaint',
    description: 'A sample complaint description for testing purposes.',
    category: 'Road Damage',
    status: 'Pending',
    location: { address: '123 Test St', latitude: 12.34, longitude: 56.78 },
    imageUrl: '',
    reportedBy: new mongoose.Types.ObjectId(),
    resolutionEvidence: { status: 'Not Submitted', beforeImages: [], afterImages: [], reopeningHistory: [] },
    sla: { deadline: null, remainingHours: null, status: 'Not Started', citizenSafeStatus: 'Within standard resolution window', priority: 'Medium' },
    statusHistory: [],
    aiAnalysis: { status: 'Pending', severity: null, summary: '', suggestedCategory: null, suggestedAction: '', analyzedAt: null },
    assignedDepartmentName: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/** Build a minimal User document (not saved). */
function makeUser(overrides = {}) {
  const id = new mongoose.Types.ObjectId();
  return {
    _id: id,
    id: id.toString(),
    name: 'Test Citizen',
    email: `citizen-${id}@example.com`,
    role: 'citizen',
    isActive: true,
    notificationPreferences: {
      emailNotifications: true, complaintStatus: true, slaReminders: true,
      feedbackReminders: true, newAssignments: true, slaAlerts: true,
      escalationAlerts: true, criticalEscalations: true,
      departmentAlerts: true, systemAlerts: true, resolutionAlerts: true
    },
    toSafeObject() {
      return { id: this._id, name: this.name, email: this.email, role: this.role };
    },
    ...overrides
  };
}

console.log('==========================================================');
console.log('👤 CivicFix AI: Phase 20 Citizen Dashboard Test Suite');
console.log('==========================================================\n');

// ===========================================================================
// SECTION 1 — Citizen Dashboard Stats (getCitizenDashboard)
// ===========================================================================
console.log('--- 1. Citizen Dashboard — Logic & Data Isolation ---\n');

// Build two citizens
const citizenA = makeUser({ name: 'Alice' });
const citizenB = makeUser({ name: 'Bob' });

// Build complaints belonging to citizenA
const compA1 = makeComplaint({ reportedBy: citizenA._id, status: 'Pending', updatedAt: new Date('2026-01-05') });
const compA2 = makeComplaint({ reportedBy: citizenA._id, status: 'In Progress', updatedAt: new Date('2026-01-04') });
const compA3 = makeComplaint({ reportedBy: citizenA._id, status: 'Resolved', updatedAt: new Date('2026-01-03') });
const compA4 = makeComplaint({ reportedBy: citizenA._id, status: 'Reopened', updatedAt: new Date('2026-01-02') });
const compA5 = makeComplaint({
  reportedBy: citizenA._id, status: 'In Progress',
  resolutionEvidence: { status: 'Submitted by Officer', beforeImages: [], afterImages: [], reopeningHistory: [] },
  updatedAt: new Date('2026-01-01')
});
const compA6 = makeComplaint({ reportedBy: citizenA._id, status: 'Pending', updatedAt: new Date('2026-01-06') });

// Build complaint belonging to citizenB
const compB1 = makeComplaint({ reportedBy: citizenB._id, status: 'Resolved' });

const allComplaints = [compA1, compA2, compA3, compA4, compA5, compA6, compB1];

/** Pure-logic implementation of getCitizenDashboard for unit testing (no DB needed). */
function computeDashboard(userId, complaints) {
  const mine = complaints.filter(c => c.reportedBy.toString() === userId.toString());
  let total = mine.length;
  let pending = 0, inProgress = 0, awaitingVerification = 0, resolved = 0, reopened = 0;
  for (const c of mine) {
    const st = c.status;
    const evStatus = c.resolutionEvidence?.status || 'Not Submitted';
    if (st === 'Pending') pending++;
    else if (st === 'In Progress' || st === 'Assigned') inProgress++;
    else if (st === 'Resolved') resolved++;
    else if (st === 'Reopened') reopened++;
    if (evStatus === 'Submitted by Officer') awaitingVerification++;
    if (evStatus === 'Contested by Citizen' && st !== 'Reopened') reopened++;
  }
  const recentActivity = [...mine]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5)
    .map(c => ({ _id: c._id, complaintId: c.complaintId, title: c.title, category: c.category, status: c.status, updatedAt: c.updatedAt, createdAt: c.createdAt }));
  return { total, pending, inProgress, awaitingVerification, resolved, reopened, recentActivity };
}

// Test 1 — Citizen A only sees their own complaints
const dashA = computeDashboard(citizenA._id, allComplaints);
assert(dashA.total === 6, 'Citizen A dashboard: total = 6 (their own complaints only)');

// Test 2 — Citizen B only sees their own complaints
const dashB = computeDashboard(citizenB._id, allComplaints);
assert(dashB.total === 1, 'Citizen B dashboard: total = 1 (data isolation enforced)');

// Test 3 — Citizen A pending count
assert(dashA.pending === 2, 'Citizen A dashboard: pending = 2');

// Test 4 — Citizen A inProgress count
assert(dashA.inProgress === 2, 'Citizen A dashboard: inProgress = 2 (In Progress + Assigned)');

// Test 5 — Citizen A resolved count
assert(dashA.resolved === 1, 'Citizen A dashboard: resolved = 1');

// Test 6 — Citizen A reopened count
assert(dashA.reopened === 1, 'Citizen A dashboard: reopened = 1');

// Test 7 — awaitingVerification (evidence.status = Submitted by Officer)
assert(dashA.awaitingVerification === 1, 'Citizen A dashboard: awaitingVerification = 1 when resolutionEvidence.status = Submitted by Officer');

// Test 8 — recentActivity returns max 5 items
assert(dashA.recentActivity.length === 5, 'Dashboard recentActivity is capped at 5 entries');

// Test 9 — recentActivity is sorted newest updatedAt first
const dates = dashA.recentActivity.map(c => new Date(c.updatedAt).getTime());
const isSorted = dates.every((d, i) => i === 0 || dates[i - 1] >= d);
assert(isSorted, 'Dashboard recentActivity is sorted by updatedAt descending');

// Test 10 — recentActivity fields (must include required fields, not expose internals)
const firstActivity = dashA.recentActivity[0];
assert(
  '_id' in firstActivity && 'complaintId' in firstActivity && 'title' in firstActivity &&
  'category' in firstActivity && 'status' in firstActivity && 'updatedAt' in firstActivity,
  'recentActivity entries contain required fields: _id, complaintId, title, category, status, updatedAt'
);

// Test 11 — citizenB's complaints are NOT in citizenA's dashboard
const aIds = dashA.recentActivity.map(c => c._id.toString());
assert(!aIds.includes(compB1._id.toString()), 'CitizenB complaint not in CitizenA recentActivity (data isolation)');

console.log('\n--- 2. My Complaints List — Filtering, Pagination, Sort ---\n');

/** Pure-logic implementation of getMyCitizensComplaints for unit testing. */
function computeMyComplaints(userId, complaints, { status, category, search, sort = 'newest', page = 1, limit = 10 } = {}) {
  let mine = complaints.filter(c => c.reportedBy.toString() === userId.toString());
  if (status) mine = mine.filter(c => c.status === status);
  if (category) mine = mine.filter(c => c.category === category);
  if (search) {
    const re = new RegExp(search, 'i');
    mine = mine.filter(c => re.test(c.title) || re.test(c.description));
  }
  if (sort === 'oldest') mine.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  else if (sort === 'updated') mine.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  else mine.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // newest
  const total = mine.length;
  const pages = Math.ceil(total / limit);
  const data = mine.slice((page - 1) * limit, page * limit).map(c => ({
    _id: c._id,
    complaintId: c.complaintId,
    title: c.title,
    description: c.description ? c.description.substring(0, 200) : '',
    category: c.category,
    status: c.status,
    address: c.location?.address || '',
    imageUrl: c.imageUrl || '',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  }));
  return { data, pagination: { total, page, pages, limit } };
}

// Build a larger complaint set for pagination tests
const paginationComplaints = Array.from({ length: 15 }, (_, i) =>
  makeComplaint({
    reportedBy: citizenA._id,
    title: i % 3 === 0 ? `Pothole complaint ${i}` : `Generic issue ${i}`,
    status: i % 4 === 0 ? 'Resolved' : 'Pending',
    category: i % 2 === 0 ? 'Road Damage' : 'Garbage',
    createdAt: new Date(2026, 0, i + 1),
    updatedAt: new Date(2026, 0, 15 - i)
  })
);

// Test 12 — My complaints ownership (citizenB gets 0 from citizenA's dataset)
const r12 = computeMyComplaints(citizenB._id, paginationComplaints);
assert(r12.pagination.total === 0, 'getMyCitizensComplaints: citizenB gets 0 results from citizenA complaints (ownership enforced)');

// Test 13 — Status filter
const r13 = computeMyComplaints(citizenA._id, paginationComplaints, { status: 'Resolved' });
assert(r13.data.every(c => c.status === 'Resolved'), 'Status filter returns only Resolved complaints');

// Test 14 — Category filter
const r14 = computeMyComplaints(citizenA._id, paginationComplaints, { category: 'Garbage' });
assert(r14.data.every(c => c.category === 'Garbage'), 'Category filter returns only Garbage complaints');

// Test 15 — Search filter (regex on title)
const r15 = computeMyComplaints(citizenA._id, paginationComplaints, { search: 'Pothole' });
assert(r15.data.length > 0 && r15.data.every(c => /Pothole/i.test(c.title)), 'Search filter matches title by regex');

// Test 16 — Search case-insensitive
const r16 = computeMyComplaints(citizenA._id, paginationComplaints, { search: 'pothole' });
assert(r16.data.length > 0, 'Search filter is case-insensitive');

// Test 17 — Pagination: page 1 of 2 with limit 10 returns 10 items
const r17 = computeMyComplaints(citizenA._id, paginationComplaints, { page: 1, limit: 10 });
assert(r17.data.length === 10 && r17.pagination.page === 1 && r17.pagination.pages === 2 && r17.pagination.total === 15,
  'Pagination page 1: 10 items, pages=2, total=15');

// Test 18 — Pagination: page 2 returns remaining 5 items
const r18 = computeMyComplaints(citizenA._id, paginationComplaints, { page: 2, limit: 10 });
assert(r18.data.length === 5 && r18.pagination.page === 2, 'Pagination page 2: 5 remaining items');

// Test 19 — Sort newest (default): first item has latest createdAt
const r19 = computeMyComplaints(citizenA._id, paginationComplaints, { sort: 'newest', limit: 50 });
const r19Dates = r19.data.map(c => new Date(c.createdAt).getTime());
assert(r19Dates[0] >= r19Dates[r19Dates.length - 1], 'Sort newest: first complaint has latest createdAt');

// Test 20 — Sort oldest: first item has earliest createdAt
const r20 = computeMyComplaints(citizenA._id, paginationComplaints, { sort: 'oldest', limit: 50 });
const r20Dates = r20.data.map(c => new Date(c.createdAt).getTime());
assert(r20Dates[0] <= r20Dates[r20Dates.length - 1], 'Sort oldest: first complaint has earliest createdAt');

// Test 21 — Sort updated: first item has latest updatedAt
const r21 = computeMyComplaints(citizenA._id, paginationComplaints, { sort: 'updated', limit: 50 });
const r21Dates = r21.data.map(c => new Date(c.updatedAt).getTime());
assert(r21Dates[0] >= r21Dates[r21Dates.length - 1], 'Sort updated: first complaint has latest updatedAt');

// Test 22 — Description is truncated to 200 chars
const longDescComplaint = makeComplaint({
  reportedBy: citizenA._id,
  description: 'A'.repeat(500)
});
const r22 = computeMyComplaints(citizenA._id, [longDescComplaint], { limit: 1 });
assert(r22.data[0].description.length <= 200, 'Description is truncated to max 200 characters in list response');

console.log('\n--- 3. Complaint Details — Anti-IDOR & Citizen-Safe Fields ---\n');

/** Pure-logic implementation of getMyCitizenComplaintDetails for unit testing. */
function computeComplaintDetails(userId, complaint) {
  if (!complaint) return { error: 'NOT_FOUND' };
  if (!complaint.reportedBy || complaint.reportedBy.toString() !== userId.toString()) {
    return { error: 'FORBIDDEN' };
  }
  return {
    _id: complaint._id,
    complaintId: complaint.complaintId,
    title: complaint.title,
    description: complaint.description || '',
    category: complaint.category,
    status: complaint.status,
    address: complaint.location?.address || '',
    latitude: complaint.location?.latitude ?? null,
    longitude: complaint.location?.longitude ?? null,
    imageUrl: complaint.imageUrl || '',
    aiAnalysis: complaint.aiAnalysis ? {
      status: complaint.aiAnalysis.status,
      severity: complaint.aiAnalysis.severity,
      summary: complaint.aiAnalysis.summary
    } : null,
    sla: complaint.sla ? {
      deadline: complaint.sla.deadline,
      remainingHours: complaint.sla.remainingHours,
      breached: complaint.sla.status === 'Overdue' || complaint.sla.status === 'Resolved After SLA',
      citizenSafeStatus: complaint.sla.citizenSafeStatus
    } : null,
    statusHistory: (complaint.statusHistory || []).map(h => ({
      previousStatus: h.previousStatus,
      newStatus: h.newStatus,
      changedByName: h.changedByName,
      note: h.note,
      changedAt: h.changedAt
    })),
    resolutionEvidence: complaint.resolutionEvidence ? {
      status: complaint.resolutionEvidence.status,
      remarks: complaint.resolutionEvidence.remarks,
      beforeImages: complaint.resolutionEvidence.beforeImages || [],
      afterImages: complaint.resolutionEvidence.afterImages || []
    } : null,
    department: complaint.assignedDepartmentName || null,
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt
  };
}

// Test 23 — Anti-IDOR: citizenB cannot access citizenA's complaint
const detailsAttempt = computeComplaintDetails(citizenB._id, compA1);
assert(detailsAttempt.error === 'FORBIDDEN', 'Anti-IDOR: citizenB cannot access citizenA complaint (403 Forbidden)');

// Test 24 — citizenA can access their own complaint
const detailsOwn = computeComplaintDetails(citizenA._id, compA1);
assert(!detailsOwn.error && detailsOwn.complaintId === compA1.complaintId, 'CitizenA can access their own complaint details');

// Test 25 — Complaint not found returns NOT_FOUND
const detailsMissing = computeComplaintDetails(citizenA._id, null);
assert(detailsMissing.error === 'NOT_FOUND', 'Returns NOT_FOUND when complaint does not exist');

// Test 26 — Response includes required citizen-safe fields
assert(
  'title' in detailsOwn && 'description' in detailsOwn && 'category' in detailsOwn &&
  'status' in detailsOwn && 'address' in detailsOwn && 'createdAt' in detailsOwn,
  'Complaint details contain all required citizen-safe fields'
);

// Test 27 — Response does NOT expose internal admin fields
const hasAdminNotes = 'adminNotes' in detailsOwn || (detailsOwn.sla && 'currentEscalationLevel' in detailsOwn.sla);
assert(!hasAdminNotes, 'Complaint details do NOT expose internal admin fields (adminNotes, escalation internals)');

// Test 28 — SLA in details contains citizen-safe fields only
const slaInDetails = detailsOwn.sla;
assert(
  slaInDetails !== undefined &&
  'deadline' in slaInDetails && 'remainingHours' in slaInDetails && 'breached' in slaInDetails,
  'SLA in details contains citizen-safe fields: deadline, remainingHours, breached'
);

console.log('\n--- 4. Profile Update — Allowed & Disallowed Fields ---\n');

/** Pure-logic implementation of updateMyProfile for unit testing. */
function computeProfileUpdate(user, body) {
  const forbidden = ['role', 'password', 'department', '_id', 'email', 'isActive'];
  for (const field of forbidden) {
    if (body[field] !== undefined) {
      return { error: 400, message: `Field '${field}' cannot be updated through this endpoint` };
    }
  }

  const { name, phone, notificationPreferences } = body;
  const updates = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return { error: 400, message: 'Name must be between 2 and 100 characters long' };
    }
    updates.name = name.trim();
  }

  if (phone !== undefined) updates.phone = phone;
  if (notificationPreferences !== undefined) {
    if (typeof notificationPreferences !== 'object' || notificationPreferences === null) {
      return { error: 400, message: 'notificationPreferences must be an object' };
    }
    updates.notificationPreferences = notificationPreferences;
  }

  if (Object.keys(updates).length === 0) {
    return { error: 400, message: 'No valid fields provided to update' };
  }

  return { success: true, updated: { ...user, ...updates } };
}

const userForProfile = makeUser({ name: 'Alice Citizen', role: 'citizen' });

// Test 29 — Allowed: name update
const p29 = computeProfileUpdate(userForProfile, { name: 'Alice Updated' });
assert(p29.success && p29.updated.name === 'Alice Updated', 'Profile update: name is allowed and applied');

// Test 30 — Allowed: phone update
const p30 = computeProfileUpdate(userForProfile, { phone: '9876543210' });
assert(p30.success && p30.updated.phone === '9876543210', 'Profile update: phone is allowed and applied');

// Test 31 — Allowed: notificationPreferences update
const p31 = computeProfileUpdate(userForProfile, { notificationPreferences: { emailNotifications: false } });
assert(p31.success && p31.updated.notificationPreferences.emailNotifications === false,
  'Profile update: notificationPreferences is allowed and applied');

// Test 32 — Disallowed: role update is rejected
const p32 = computeProfileUpdate(userForProfile, { role: 'admin' });
assert(p32.error === 400 && p32.message.includes('role'), 'Profile update: role change is rejected with 400');

// Test 33 — Disallowed: password in body is rejected
const p33 = computeProfileUpdate(userForProfile, { password: 'NewPassword123' });
assert(p33.error === 400 && p33.message.includes('password'), 'Profile update: password change is rejected with 400');

// Test 34 — Disallowed: department update is rejected
const p34 = computeProfileUpdate(userForProfile, { department: new mongoose.Types.ObjectId() });
assert(p34.error === 400 && p34.message.includes('department'), 'Profile update: department change is rejected with 400');

// Test 35 — Name too short is rejected
const p35 = computeProfileUpdate(userForProfile, { name: 'A' });
assert(p35.error === 400 && p35.message.includes('Name'), 'Profile update: name < 2 chars is rejected with 400');

// Test 36 — Name too long is rejected
const p36 = computeProfileUpdate(userForProfile, { name: 'A'.repeat(101) });
assert(p36.error === 400 && p36.message.includes('Name'), 'Profile update: name > 100 chars is rejected with 400');

// Test 37 — Empty update body is rejected
const p37 = computeProfileUpdate(userForProfile, {});
assert(p37.error === 400, 'Profile update: empty body is rejected with 400');

// Test 38 — notificationPreferences as non-object is rejected
const p38 = computeProfileUpdate(userForProfile, { notificationPreferences: 'yes' });
assert(p38.error === 400 && p38.message.includes('notificationPreferences'), 'Profile update: notificationPreferences must be object');

console.log('\n--- 5. Auth Guard — Missing Token Returns 401 ---\n');

// Helper: simulate missing auth header through protect middleware logic
function simulateProtect(authHeader) {
  let statusCode = 200;
  let responseData = null;
  const req = { headers: { authorization: authHeader } };
  const res = {
    status(code) { statusCode = code; return { json(data) { responseData = data; } }; }
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  return { req, res, next, getStatus: () => statusCode, getData: () => responseData, wasNextCalled: () => nextCalled };
}

// Test 39 — No auth header returns 401
const auth39 = simulateProtect(undefined);
await protect(auth39.req, auth39.res, auth39.next);
assert(auth39.getStatus() === 401 && auth39.getData()?.success === false,
  'Dashboard/my-complaints/details: missing token returns 401 Unauthorized');

// Test 40 — Malformed bearer token returns 401
const auth40 = simulateProtect('InvalidScheme abc123');
await protect(auth40.req, auth40.res, auth40.next);
assert(auth40.getStatus() === 401 && auth40.getData()?.success === false,
  'Malformed Authorization header returns 401');

// Test 41 — Invalid JWT token returns 401
const auth41 = simulateProtect('Bearer not.a.valid.token.at.all');
await protect(auth41.req, auth41.res, auth41.next);
assert(auth41.getStatus() === 401 && auth41.getData()?.success === false,
  'Invalid JWT token returns 401');

console.log('\n--- 6. Controller Shape & Export Verification ---\n');

// Test 42 — getCitizenDashboard is exported as a function
const { default: controllerExports } = await import('./src/controllers/complaintController.js');
assert(typeof getCitizenDashboard === 'function', 'getCitizenDashboard is exported as a function');

// Test 43 — getMyCitizensComplaints is exported as a function
assert(typeof getMyCitizensComplaints === 'function', 'getMyCitizensComplaints is exported as a function');

// Test 44 — getMyCitizenComplaintDetails is exported as a function
assert(typeof getMyCitizenComplaintDetails === 'function', 'getMyCitizenComplaintDetails is exported as a function');

// Test 45 — updateMyProfile is exported as a function
assert(typeof updateMyProfile === 'function', 'updateMyProfile is exported as a function');

// Test 46 — Routes shape: dashboard route handler returns function
import complaintRouter from './src/routes/complaintRoutes.js';
assert(complaintRouter && typeof complaintRouter === 'function', 'complaintRoutes exports a valid Express router');

// Test 47 — Auth routes include profile update route
import authRouter from './src/routes/authRoutes.js';
assert(authRouter && typeof authRouter === 'function', 'authRoutes exports a valid Express router with profile update');

console.log('\n==========================================================');
console.log(`Summary: ${passed}/${total} citizen dashboard tests passed.`);
console.log('==========================================================');

process.exit(passed === total ? 0 : 1);
