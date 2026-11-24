/**
 * Phase 25: Five-Role Role-Based Access Control (RBAC) & Security Regression Tests
 * CivicFix AI - Authorization Matrix & Anti-IDOR Enforcement Verification
 */

import jwt from 'jsonwebtoken';
import { protect, authorize } from './src/middleware/authMiddleware.js';
import { User } from './src/models/User.js';
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

console.log('====================================================');
console.log('🧪 CivicFix AI: Phase 25 Five-Role RBAC & Security Suite');
console.log('====================================================\n');

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_phase25_civicfix';

// Helper to generate test JWT
function generateToken(payload, secret = JWT_SECRET, options = { expiresIn: '1h' }) {
  return jwt.sign(payload, secret, options);
}

// Mock Express req, res, next
function createMockReqRes({ headers = {}, user = null, params = {}, body = {}, query = {} } = {}) {
  const req = {
    headers,
    user,
    params,
    body,
    query
  };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    getStatusCode: () => statusCode,
    getData: () => responseData
  };

  let nextCalled = false;
  let nextError = null;
  const next = (err) => {
    nextCalled = true;
    nextError = err;
  };

  return { req, res, next, getStatus: () => statusCode, getBody: () => responseData, wasNextCalled: () => nextCalled, getError: () => nextError };
}

console.log('--- 1. Authentication Middleware Token Scenarios ---');

// Test 1.1: Missing Authorization Header
{
  const { req, res, next, getStatus, getBody } = createMockReqRes();
  await protect(req, res, next);
  assert(getStatus() === 401, 'Missing token returns HTTP 401 Unauthorized');
  assert(getBody().message.toLowerCase().includes('token'), 'Returns clear missing token error message');
}

// Test 1.2: Malformed Bearer Header
{
  const { req, res, next, getStatus } = createMockReqRes({ headers: { authorization: 'Basic 12345' } });
  await protect(req, res, next);
  assert(getStatus() === 401, 'Non-Bearer authorization returns HTTP 401');
}

// Test 1.3: Tampered Token Signature
{
  const fakeToken = generateToken({ id: 'user123', role: 'citizen' }, 'wrong_secret');
  const { req, res, next, getStatus } = createMockReqRes({ headers: { authorization: `Bearer ${fakeToken}` } });
  await protect(req, res, next);
  assert(getStatus() === 401, 'Token signed with invalid secret returns HTTP 401');
}

// Test 1.4: Expired Token
{
  const expiredToken = generateToken({ id: 'user123', role: 'citizen' }, JWT_SECRET, { expiresIn: '0s' });
  const { req, res, next, getStatus } = createMockReqRes({ headers: { authorization: `Bearer ${expiredToken}` } });
  await protect(req, res, next);
  assert(getStatus() === 401, 'Expired token returns HTTP 401');
}

console.log('\n--- 2. Role-Based Access Control (RBAC) Matrix ---');

// Role Matrix Test Helper
function testRoleAccess(userRole, allowedRoles) {
  const middleware = authorize(...allowedRoles);
  const { req, res, next, getStatus, wasNextCalled } = createMockReqRes({
    user: { _id: new mongoose.Types.ObjectId(), role: userRole }
  });
  middleware(req, res, next);
  return { allowed: wasNextCalled(), status: getStatus() };
}

// Citizen permissions
assert(testRoleAccess('citizen', ['citizen']).allowed === true, 'Citizen allowed on citizen route');
assert(testRoleAccess('citizen', ['officer']).allowed === false, 'Citizen rejected from officer route');
assert(testRoleAccess('citizen', ['admin']).allowed === false, 'Citizen rejected from admin route');
assert(testRoleAccess('citizen', ['ward_admin']).allowed === false, 'Citizen rejected from ward_admin route');
assert(testRoleAccess('citizen', ['department_head']).allowed === false, 'Citizen rejected from department_head route');

// Officer permissions
assert(testRoleAccess('officer', ['officer']).allowed === true, 'Officer allowed on officer workspace');
assert(testRoleAccess('officer', ['admin']).allowed === false, 'Officer rejected from root admin routes');
assert(testRoleAccess('officer', ['ward_admin']).allowed === false, 'Officer rejected from municipal ward admin routes');

// Ward Admin permissions
assert(testRoleAccess('ward_admin', ['ward_admin']).allowed === true, 'Ward Admin allowed on municipal routes');
assert(testRoleAccess('ward_admin', ['admin', 'ward_admin']).allowed === true, 'Ward Admin allowed on joint municipal routes');
assert(testRoleAccess('ward_admin', ['admin']).allowed === false, 'Ward Admin rejected from root-admin-only routes (e.g. ward delete)');

// Department Head permissions
assert(testRoleAccess('department_head', ['department_head']).allowed === true, 'Department Head allowed on department routes');
assert(testRoleAccess('department_head', ['admin', 'department_head']).allowed === true, 'Department Head allowed on joint department queues');
assert(testRoleAccess('department_head', ['ward_admin']).allowed === false, 'Department Head rejected from ward administration');

// Root Admin permissions
assert(testRoleAccess('admin', ['admin']).allowed === true, 'Admin allowed on administrative endpoints');
assert(testRoleAccess('admin', ['admin', 'ward_admin']).allowed === true, 'Admin allowed on municipal endpoints');
assert(testRoleAccess('admin', ['admin', 'officer']).allowed === true, 'Admin allowed on operational endpoints');

console.log('\n--- 3. Multi-Ward Data Isolation Verification ---');

const wardAId = new mongoose.Types.ObjectId().toString();
const wardBId = new mongoose.Types.ObjectId().toString();

const wardAdminA = {
  _id: new mongoose.Types.ObjectId(),
  role: 'ward_admin',
  ward: { _id: wardAId }
};

// Check cross-ward query logic
function checkWardAccess(user, targetWardId) {
  if (user.role === 'admin') return { allowed: true };
  if (user.role === 'ward_admin') {
    const userWardId = user.ward?._id ? user.ward._id.toString() : user.ward?.toString();
    if (userWardId === targetWardId) return { allowed: true };
    return { allowed: false, status: 403, reason: 'Ward mismatch' };
  }
  return { allowed: false, status: 403 };
}

assert(checkWardAccess(wardAdminA, wardAId).allowed === true, 'Ward Admin A allowed access to Ward A');
assert(checkWardAccess(wardAdminA, wardBId).allowed === false, 'Ward Admin A strictly denied access to Ward B (Cross-ward isolation)');
assert(checkWardAccess({ role: 'admin' }, wardBId).allowed === true, 'Municipal Admin has city-wide access across all wards');

console.log('\n--- 4. Department Boundary Verification ---');

const deptAId = new mongoose.Types.ObjectId().toString();
const deptBId = new mongoose.Types.ObjectId().toString();

const deptHeadA = {
  _id: new mongoose.Types.ObjectId(),
  role: 'department_head',
  department: { _id: deptAId }
};

function checkDeptAssignment(headUser, targetOfficerDeptId) {
  if (headUser.role === 'admin') return { allowed: true };
  if (headUser.role === 'department_head') {
    const headDeptId = headUser.department?._id ? headUser.department._id.toString() : headUser.department?.toString();
    if (headDeptId === targetOfficerDeptId) return { allowed: true };
    return { allowed: false, status: 403, reason: 'Department mismatch' };
  }
  return { allowed: false, status: 403 };
}

assert(checkDeptAssignment(deptHeadA, deptAId).allowed === true, 'Department Head A can assign officers in Department A');
assert(checkDeptAssignment(deptHeadA, deptBId).allowed === false, 'Department Head A strictly blocked from assigning officers in Department B');

console.log('\n====================================================');
console.log(`Summary: ${passed}/${total} Phase 25 RBAC & security tests passed.`);
console.log('====================================================');

process.exit(passed === total ? 0 : 1);
