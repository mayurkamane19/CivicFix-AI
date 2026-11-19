/**
 * CivicFix AI - Mini Phase 16.2: Citizen Feedback REST API Test Suite
 * Tests feedback controller endpoints, route protection, input validations,
 * resolution status enforcement, IDOR access controls, and error sanitization.
 */

import mongoose from 'mongoose';
import { Feedback } from './src/models/Feedback.js';
import { Complaint } from './src/models/Complaint.js';
import { User } from './src/models/User.js';
import {
  submitComplaintFeedback,
  getComplaintFeedback,
  getMyFeedback
} from './src/controllers/feedbackController.js';
import { protect } from './src/middleware/authMiddleware.js';
import app from './src/app.js';

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
console.log('🌐 CivicFix AI: Mini Phase 16.2 Feedback REST API Tests');
console.log('==================================================\n');

// Mock ObjectIds
const citizenOneId = new mongoose.Types.ObjectId();
const citizenTwoId = new mongoose.Types.ObjectId();
const adminUserId = new mongoose.Types.ObjectId();
const complaintResolvedId = new mongoose.Types.ObjectId();
const complaintUnresolvedId = new mongoose.Types.ObjectId();
const complaintNoFeedbackId = new mongoose.Types.ObjectId();
const guestComplaintId = new mongoose.Types.ObjectId();

// Mock in-memory database store
const mockComplaints = {
  [complaintResolvedId.toString()]: {
    _id: complaintResolvedId,
    complaintId: 'CFX-20261119-7001',
    title: 'Severe pothole on 4th St',
    status: 'Resolved',
    reportedBy: citizenOneId
  },
  [complaintUnresolvedId.toString()]: {
    _id: complaintUnresolvedId,
    complaintId: 'CFX-20261119-7002',
    title: 'Garbage dump near school',
    status: 'In Progress',
    reportedBy: citizenOneId
  },
  [complaintNoFeedbackId.toString()]: {
    _id: complaintNoFeedbackId,
    complaintId: 'CFX-20261119-7003',
    title: 'Fixed street lamp',
    status: 'Resolved',
    reportedBy: citizenOneId
  },
  [guestComplaintId.toString()]: {
    _id: guestComplaintId,
    complaintId: 'CFX-20261119-7004',
    title: 'Water pipe leak',
    status: 'Resolved',
    reportedBy: null
  }
};

const mockFeedbacks = new Map();

// Mock Mongoose readiness & model queries
Object.defineProperty(mongoose.connection, 'readyState', {
  value: 1,
  writable: true,
  configurable: true
});

Complaint.findById = async (id) => mockComplaints[id.toString()] || null;
Complaint.findOne = async (query) => {
  if (query.complaintId) {
    return Object.values(mockComplaints).find((c) => c.complaintId === query.complaintId) || null;
  }
  return null;
};

Feedback.findOne = async (query) => {
  if (query.complaint) {
    return mockFeedbacks.get(query.complaint.toString()) || null;
  }
  return null;
};

Feedback.find = (query) => ({
  sort: () => ({
    populate: async () => {
      const results = [];
      for (const [_, fb] of mockFeedbacks) {
        if (fb.citizen && fb.citizen.toString() === query.citizen.toString()) {
          results.push({
            ...fb.toSafeObject(),
            complaint: mockComplaints[fb.complaint.toString()],
            toSafeObject: () => fb.toSafeObject()
          });
        }
      }
      return results;
    }
  })
});

Feedback.prototype.save = async function () {
  mockFeedbacks.set(this.complaint.toString(), this);
  return this;
};

/**
 * Helper to build mock Express response object
 */
const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
};

// -----------------------------------------------------------------------------
// 1. ROUTE REGISTRATION & AUTHENTICATION (JWT)
// -----------------------------------------------------------------------------
console.log('--- 1. Route Registration & Authentication Tests ---');

// 1.1 Express App Route Mounting Check
const routes = app._router.stack
  .filter((r) => r.route || (r.name === 'router' && r.regexp.test('/api/feedback')))
  .map((r) => r.regexp.toString());

assert(
  routes.some((r) => r.includes('api\\/feedback') || r.includes('feedback')),
  '1.1 /api/feedback router is cleanly mounted in Express application'
);

// 1.2 Missing JWT Token in protect middleware returns HTTP 401
const unauthReq = { headers: {} };
const unauthRes = createMockRes();
let protectCalledNext = false;
await protect(unauthReq, unauthRes, () => {
  protectCalledNext = true;
});

assert(
  unauthRes.statusCode === 401 && unauthRes.body.success === false,
  '1.2 Missing Authorization header is rejected with HTTP 401 Unauthorized'
);
assert(
  protectCalledNext === false,
  '1.3 next() is never invoked when JWT authentication fails'
);

// -----------------------------------------------------------------------------
// 2. SUBMIT FEEDBACK API (POST /api/feedback/:complaintId)
// -----------------------------------------------------------------------------
console.log('\n--- 2. Submit Feedback Endpoint (POST /api/feedback/:complaintId) ---');

// 2.1 Successful feedback submission by complaint owner
mockFeedbacks.clear();
const validReq = {
  params: { complaintId: complaintResolvedId.toString() },
  body: { rating: 5, comment: 'Pothole was patched very quickly. Excellent work!' },
  user: { _id: citizenOneId, role: 'citizen' }
};
const validRes = createMockRes();
let validNextCalled = false;
await submitComplaintFeedback(validReq, validRes, (err) => {
  validNextCalled = true;
});

assert(
  validRes.statusCode === 201 && validRes.body.success === true,
  '2.1 POST /api/feedback/:complaintId returns HTTP 201 Created on valid submission'
);
assert(
  validRes.body.feedback && validRes.body.feedback.rating === 5,
  '2.2 Response payload includes safe feedback object with rating 5'
);
assert(
  validRes.body.feedback.comment.includes('Excellent work'),
  '2.3 Response payload includes citizen comment'
);

// 2.2 Invalid rating: 0 rejected
const rating0Req = {
  params: { complaintId: complaintResolvedId.toString() },
  body: { rating: 0 },
  user: { _id: citizenOneId, role: 'citizen' }
};
const rating0Res = createMockRes();
await submitComplaintFeedback(rating0Req, rating0Res, () => {});
assert(
  rating0Res.statusCode === 400 && rating0Res.body.message.includes('Rating must be an integer between 1 and 5'),
  '2.4 Rating 0 returns HTTP 400 Bad Request'
);

// 2.3 Invalid rating: 6 rejected
const rating6Req = {
  params: { complaintId: complaintResolvedId.toString() },
  body: { rating: 6 },
  user: { _id: citizenOneId, role: 'citizen' }
};
const rating6Res = createMockRes();
await submitComplaintFeedback(rating6Req, rating6Res, () => {});
assert(
  rating6Res.statusCode === 400 && rating6Res.body.message.includes('Rating must be an integer between 1 and 5'),
  '2.5 Rating 6 returns HTTP 400 Bad Request'
);

// 2.4 Non-integer rating: float rejected
const floatRatingReq = {
  params: { complaintId: complaintResolvedId.toString() },
  body: { rating: 4.5 },
  user: { _id: citizenOneId, role: 'citizen' }
};
const floatRatingRes = createMockRes();
await submitComplaintFeedback(floatRatingReq, floatRatingRes, () => {});
assert(
  floatRatingRes.statusCode === 400 && floatRatingRes.body.message.includes('Rating must be an integer'),
  '2.6 Non-integer float rating (4.5) returns HTTP 400 Bad Request'
);

// 2.5 Non-integer rating: string rejected
const stringRatingReq = {
  params: { complaintId: complaintResolvedId.toString() },
  body: { rating: 'five' },
  user: { _id: citizenOneId, role: 'citizen' }
};
const stringRatingRes = createMockRes();
await submitComplaintFeedback(stringRatingReq, stringRatingRes, () => {});
assert(
  stringRatingRes.statusCode === 400 && stringRatingRes.body.message.includes('Rating must be an integer'),
  '2.7 String rating ("five") returns HTTP 400 Bad Request'
);

// 2.6 Oversized comment rejected (> 500 chars)
const longCommentReq = {
  params: { complaintId: complaintResolvedId.toString() },
  body: { rating: 4, comment: 'C'.repeat(501) },
  user: { _id: citizenOneId, role: 'citizen' }
};
const longCommentRes = createMockRes();
await submitComplaintFeedback(longCommentReq, longCommentRes, () => {});
assert(
  longCommentRes.statusCode === 400 && longCommentRes.body.message.includes('cannot exceed 500 characters'),
  '2.8 Comment exceeding 500 characters returns HTTP 400 Bad Request'
);

// 2.7 Empty complaintId in params rejected
const emptyIdReq = {
  params: { complaintId: '   ' },
  body: { rating: 4 },
  user: { _id: citizenOneId, role: 'citizen' }
};
const emptyIdRes = createMockRes();
await submitComplaintFeedback(emptyIdReq, emptyIdRes, () => {});
assert(
  emptyIdRes.statusCode === 400 && emptyIdRes.body.message.includes('Complaint ID is required'),
  '2.9 Empty complaint ID parameter returns HTTP 400 Bad Request'
);

// 2.8 Unresolved complaint submission rejected (In Progress)
const unresolvedReq = {
  params: { complaintId: complaintUnresolvedId.toString() },
  body: { rating: 3 },
  user: { _id: citizenOneId, role: 'citizen' }
};
const unresolvedRes = createMockRes();
let unresolvedNextError = null;
await submitComplaintFeedback(unresolvedReq, unresolvedRes, (err) => {
  unresolvedNextError = err;
});
assert(
  unresolvedNextError && unresolvedNextError.statusCode === 400 && unresolvedNextError.message.includes('resolved complaints'),
  '2.10 Unresolved complaint returns HTTP 400 via centralized error handling'
);

// 2.9 Non-owner citizen cannot submit feedback (IDOR defense)
const nonOwnerReq = {
  params: { complaintId: complaintResolvedId.toString() },
  body: { rating: 4 },
  user: { _id: citizenTwoId, role: 'citizen' }
};
const nonOwnerRes = createMockRes();
let nonOwnerNextError = null;
await submitComplaintFeedback(nonOwnerReq, nonOwnerRes, (err) => {
  nonOwnerNextError = err;
});
assert(
  nonOwnerNextError && nonOwnerNextError.statusCode === 403 && nonOwnerNextError.message.includes('not authorized to submit feedback'),
  '2.11 Non-owner submission is rejected with HTTP 403 Forbidden'
);

// 2.10 Guest complaint submission rejected
const guestReq = {
  params: { complaintId: guestComplaintId.toString() },
  body: { rating: 4 },
  user: { _id: citizenOneId, role: 'citizen' }
};
const guestRes = createMockRes();
let guestNextError = null;
await submitComplaintFeedback(guestReq, guestRes, (err) => {
  guestNextError = err;
});
assert(
  guestNextError && guestNextError.statusCode === 403 && guestNextError.message.includes('guest complaints'),
  '2.12 Guest complaint without owner returns HTTP 403 Forbidden'
);

// 2.11 Duplicate feedback rejected
// Mock already has feedback for complaintResolvedId from test 2.1
const duplicateReq = {
  params: { complaintId: complaintResolvedId.toString() },
  body: { rating: 4, comment: 'Trying to submit a second time' },
  user: { _id: citizenOneId, role: 'citizen' }
};
const duplicateRes = createMockRes();
let duplicateNextError = null;
await submitComplaintFeedback(duplicateReq, duplicateRes, (err) => {
  duplicateNextError = err;
});
assert(
  duplicateNextError && duplicateNextError.statusCode === 400 && duplicateNextError.message.includes('already been submitted'),
  '2.13 Duplicate feedback on same complaint returns HTTP 400 Bad Request'
);

// 2.12 Missing complaint ID returns 404
const missingReq = {
  params: { complaintId: new mongoose.Types.ObjectId().toString() },
  body: { rating: 5 },
  user: { _id: citizenOneId, role: 'citizen' }
};
const missingRes = createMockRes();
let missingNextError = null;
await submitComplaintFeedback(missingReq, missingRes, (err) => {
  missingNextError = err;
});
assert(
  missingNextError && missingNextError.statusCode === 404 && missingNextError.message.includes('Complaint not found'),
  '2.14 Non-existent complaint identifier returns HTTP 404 Not Found'
);

// -----------------------------------------------------------------------------
// 3. GET COMPLAINT FEEDBACK (GET /api/feedback/complaint/:complaintId)
// -----------------------------------------------------------------------------
console.log('\n--- 3. Get Complaint Feedback (GET /api/feedback/complaint/:complaintId) ---');

// 3.1 Owner retrieves feedback for their complaint
const ownerReq = {
  params: { complaintId: complaintResolvedId.toString() },
  user: { _id: citizenOneId, role: 'citizen' }
};
const ownerRes = createMockRes();
await getComplaintFeedback(ownerReq, ownerRes, () => {});

assert(
  ownerRes.statusCode === 200 && ownerRes.body.success === true,
  '3.1 Complaint owner receives HTTP 200 OK'
);
assert(
  ownerRes.body.feedback && ownerRes.body.feedback.rating === 5,
  '3.2 Retrieved feedback matches submitted rating'
);

// 3.2 Non-owner citizen receives HTTP 403 Forbidden
const unauthGetReq = {
  params: { complaintId: complaintResolvedId.toString() },
  user: { _id: citizenTwoId, role: 'citizen' }
};
const unauthGetRes = createMockRes();
let unauthGetError = null;
await getComplaintFeedback(unauthGetReq, unauthGetRes, (err) => {
  unauthGetError = err;
});

assert(
  unauthGetError && unauthGetError.statusCode === 403 && unauthGetError.message.includes('not authorized to view feedback'),
  '3.3 Non-owner citizen is denied access with HTTP 403 Forbidden'
);

// 3.3 Authorized administrator can retrieve complaint feedback
const adminReq = {
  params: { complaintId: complaintResolvedId.toString() },
  user: { _id: adminUserId, role: 'admin' }
};
const adminRes = createMockRes();
let adminNextCalled = false;
await getComplaintFeedback(adminReq, adminRes, (err) => {
  adminNextCalled = true;
});

assert(
  adminRes.statusCode === 200 && adminRes.body.success === true,
  '3.4 Authorized administrator receives HTTP 200 OK'
);
assert(
  adminRes.body.feedback && adminRes.body.feedback.rating === 5,
  '3.5 Administrator successfully retrieves citizen feedback payload'
);

// 3.4 Missing feedback response (complaint exists, but no feedback submitted yet)
const noFeedbackReq = {
  params: { complaintId: complaintNoFeedbackId.toString() },
  user: { _id: citizenOneId, role: 'citizen' }
};
const noFeedbackRes = createMockRes();
await getComplaintFeedback(noFeedbackReq, noFeedbackRes, () => {});

assert(
  noFeedbackRes.statusCode === 200 && noFeedbackRes.body.success === true,
  '3.6 Complaint without feedback returns HTTP 200 OK'
);
assert(
  noFeedbackRes.body.feedback === null,
  '3.7 Complaint without feedback returns feedback: null cleanly'
);

// -----------------------------------------------------------------------------
// 4. GET CITIZEN FEEDBACK HISTORY (GET /api/feedback/my)
// -----------------------------------------------------------------------------
console.log('\n--- 4. Citizen Feedback History (GET /api/feedback/my) ---');

const myFeedbackReq = {
  user: { _id: citizenOneId, role: 'citizen' }
};
const myFeedbackRes = createMockRes();
await getMyFeedback(myFeedbackReq, myFeedbackRes, () => {});

assert(
  myFeedbackRes.statusCode === 200 && myFeedbackRes.body.success === true,
  '4.1 GET /api/feedback/my returns HTTP 200 OK'
);
assert(
  Array.isArray(myFeedbackRes.body.feedbacks) && myFeedbackRes.body.count >= 1,
  '4.2 Response contains feedbacks array and count attribute'
);
assert(
  myFeedbackRes.body.feedbacks[0].rating === 5,
  '4.3 History record accurately reflects citizen rating'
);

// =============================================================================
// SUMMARY REPORT
// =============================================================================
console.log('\n==================================================');
console.log(`Summary: ${passed}/${total} Mini Phase 16.2 Feedback REST API tests passed.`);
console.log('==================================================');

if (passed !== total) {
  process.exit(1);
}
