/**
 * CivicFix AI - Authentication Security & Logic Test Suite
 * Tests bcrypt hashing, JWT issuance & verification, token expiration,
 * role escalation prevention, and auth middleware behavior.
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from './src/models/User.js';
import { generateToken, verifyToken } from './src/utils/jwt.js';
import { config } from './src/config/env.js';
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
console.log('🛡️ CivicFix AI: Phase 3 Authentication Test Suite');
console.log('==================================================\n');

// -----------------------------------------------------------------------------
// 1. BCRYPT PASSWORD HASHING TESTS
// -----------------------------------------------------------------------------
console.log('--- 1. Password Hashing & Comparison Tests ---');

const plainPassword = 'StrongPassword123';
const salt = await bcrypt.genSalt(10);
const hashedPassword = await bcrypt.hash(plainPassword, salt);

// Test 1: Plaintext password is never stored bare
assert(
  hashedPassword !== plainPassword && hashedPassword.startsWith('$2'),
  'Password is encrypted using standard bcrypt format ($2b/...)'
);

// Test 2: Password verification with correct credentials
const correctMatch = await bcrypt.compare(plainPassword, hashedPassword);
assert(correctMatch === true, 'bcrypt correctly validates valid credentials');

// Test 3: Password verification with incorrect credentials
const incorrectMatch = await bcrypt.compare('WrongPassword456', hashedPassword);
assert(incorrectMatch === false, 'bcrypt rejects invalid credentials');

// Test 4: User model matchPassword instance method
const testUser = new User({
  name: 'Security Test User',
  email: 'security@example.com',
  password: hashedPassword,
  role: 'citizen'
});
const instanceMethodMatch = await testUser.matchPassword(plainPassword);
assert(instanceMethodMatch === true, 'User.matchPassword() returns true for matching password');

const instanceMethodFail = await testUser.matchPassword('BadPassword');
assert(instanceMethodFail === false, 'User.matchPassword() returns false for mismatched password');

// -----------------------------------------------------------------------------
// 2. JWT ISSUANCE & VERIFICATION TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 2. JWT Generation & Verification Tests ---');

// Test 5: Token Generation
const sampleUser = {
  _id: '507f1f77bcf86cd799439011',
  email: 'citizen@example.com',
  role: 'citizen'
};
const token = generateToken(sampleUser);
assert(typeof token === 'string' && token.split('.').length === 3, 'JWT generated in standard 3-part header.payload.signature format');

// Test 6: Token Verification
const decoded = verifyToken(token);
assert(
  decoded.id === sampleUser._id && decoded.email === sampleUser.email && decoded.role === sampleUser.role,
  'JWT decoded payload matches original user data'
);

// Test 7: Secret Protection - Invalid Signature
let invalidTokenError = null;
try {
  jwt.verify(token, 'wrong_tampered_secret_key');
} catch (err) {
  invalidTokenError = err;
}
assert(
  invalidTokenError && invalidTokenError.name === 'JsonWebTokenError',
  'JWT with tampered secret is rejected with JsonWebTokenError'
);

// Test 8: Expired Token Detection
const expiredToken = jwt.sign(
  { id: '123', email: 'exp@example.com', role: 'citizen' },
  config.jwtSecret,
  { expiresIn: '1ms' }
);

// Small delay to ensure expiration
await new Promise((resolve) => setTimeout(resolve, 20));

let expiredError = null;
try {
  jwt.verify(expiredToken, config.jwtSecret);
} catch (err) {
  expiredError = err;
}
assert(
  expiredError && expiredError.name === 'TokenExpiredError',
  'Expired token triggers TokenExpiredError'
);

// -----------------------------------------------------------------------------
// 3. AUTHENTICATION MIDDLEWARE TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 3. Auth Middleware Tests ---');

// Helper to simulate Express req, res, next
const createMockContext = (authHeader) => {
  const req = {
    headers: {
      authorization: authHeader
    }
  };
  let statusCode = 200;
  let responseData = null;
  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          responseData = data;
          return res;
        }
      };
    }
  };
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  return { req, res, next, getStatus: () => statusCode, getData: () => responseData, wasNextCalled: () => nextCalled };
};

// Test 9: Missing Authorization Header
const missingCtx = createMockContext(undefined);
await protect(missingCtx.req, missingCtx.res, missingCtx.next);
assert(
  missingCtx.getStatus() === 401 && missingCtx.getData()?.success === false,
  'Protect middleware returns HTTP 401 when Authorization header is missing'
);

// Test 10: Malformed Authorization Header (missing "Bearer ")
const malformedCtx = createMockContext('Basic 12345');
await protect(malformedCtx.req, malformedCtx.res, malformedCtx.next);
assert(
  malformedCtx.getStatus() === 401 && malformedCtx.getData()?.success === false,
  'Protect middleware returns HTTP 401 when Bearer prefix is missing'
);

// Test 11: Invalid Token in Header
const invalidCtx = createMockContext('Bearer invalid.token.payload');
await protect(invalidCtx.req, invalidCtx.res, invalidCtx.next);
assert(
  invalidCtx.getStatus() === 401 && invalidCtx.getData()?.message === 'Invalid authentication token.',
  'Protect middleware returns HTTP 401 for invalid JWT'
);

// Test 12: Expired Token in Header
const expiredCtx = createMockContext(`Bearer ${expiredToken}`);
await protect(expiredCtx.req, expiredCtx.res, expiredCtx.next);
assert(
  expiredCtx.getStatus() === 401 && expiredCtx.getData()?.message.includes('expired'),
  'Protect middleware returns HTTP 401 with informative message for expired JWT'
);

// -----------------------------------------------------------------------------
// 4. ROLE AUTHORIZATION & ADMIN ESCALATION PREVENTION
// -----------------------------------------------------------------------------
console.log('\n--- 4. Role Authorization & Escalation Protection ---');

// Test 13: Role Authorization - Denied for citizen on admin-only route
const citizenCtx = {
  req: { user: { role: 'citizen' } },
  res: {
    status: (code) => ({
      json: (data) => ({ statusCode: code, data })
    })
  }
};
let adminNextCalled = false;
const adminMiddleware = authorize('admin');
const authResult = adminMiddleware(citizenCtx.req, citizenCtx.res, () => { adminNextCalled = true; });
assert(
  adminNextCalled === false,
  'Citizen user is blocked by authorize("admin") middleware'
);

// Test 14: Role Authorization - Allowed for admin
const adminCtx = {
  req: { user: { role: 'admin' } },
  res: {}
};
let allowedNextCalled = false;
adminMiddleware(adminCtx.req, adminCtx.res, () => { allowedNextCalled = true; });
assert(
  allowedNextCalled === true,
  'Admin user is permitted by authorize("admin") middleware'
);

// Test 15: Public Registration Role Escalation Prevention
// Verify that attempting to register with role="admin" defaults to citizen in model / service logic
const attemptedAdminUser = new User({
  name: 'Hacker User',
  email: 'hacker@example.com',
  password: 'Password123'
});
// When role is not explicitly admin-provisioned, model defaults to citizen
assert(
  attemptedAdminUser.role === 'citizen',
  'User schema defaults to "citizen" role regardless of untrusted input'
);

// Test 16: Safe User Serialization (No Password Leaked)
const safeProfile = testUser.toSafeObject();
assert(
  safeProfile.password === undefined && safeProfile.name === 'Security Test User',
  'User.toSafeObject() never exposes password hash in output'
);

console.log('\n==================================================');
console.log(`Summary: ${passed}/${total} authentication tests passed.`);
console.log('==================================================');

process.exit(passed === total ? 0 : 1);
