/**
 * CivicFix AI - Mini Phase 16.1: Citizen Feedback Backend Foundation Test Suite
 * Tests Feedback model validation, rating boundaries, complaint ownership checks,
 * resolution status enforcement, duplicate feedback prevention, and retrieval controls.
 */

import mongoose from 'mongoose';
import { Feedback } from './src/models/Feedback.js';
import { Complaint } from './src/models/Complaint.js';
import {
  submitFeedback,
  getFeedbackByComplaint,
  getCitizenFeedback
} from './src/services/feedbackService.js';

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
console.log('🌟 CivicFix AI: Mini Phase 16.1 Citizen Feedback Tests');
console.log('==================================================\n');

// Mock ObjectIds
const citizenOneId = new mongoose.Types.ObjectId();
const citizenTwoId = new mongoose.Types.ObjectId();
const complaintResolvedId = new mongoose.Types.ObjectId();
const complaintPendingId = new mongoose.Types.ObjectId();
const complaintInProgressId = new mongoose.Types.ObjectId();
const guestComplaintId = new mongoose.Types.ObjectId();

// -----------------------------------------------------------------------------
// 1. FEEDBACK DATA MODEL SCHEMA VALIDATION
// -----------------------------------------------------------------------------
console.log('--- 1. Feedback Model Validation & Schema Constraints ---');

const validDoc = new Feedback({
  complaint: complaintResolvedId,
  citizen: citizenOneId,
  rating: 5,
  comment: 'Great work! The pothole was repaired within 2 days.'
});

let schemaError = null;
try {
  await validDoc.validate();
} catch (err) {
  schemaError = err;
}
assert(schemaError === null, '1.1 Valid feedback document passes schema validation');

// 1.2 Rating boundaries (1 and 5 accepted)
const rating1Doc = new Feedback({
  complaint: complaintResolvedId,
  citizen: citizenOneId,
  rating: 1
});
let rating1Err = null;
try {
  await rating1Doc.validate();
} catch (err) {
  rating1Err = err;
}
assert(rating1Err === null, '1.2 Rating of 1 is valid in model schema');

const rating5Doc = new Feedback({
  complaint: complaintResolvedId,
  citizen: citizenOneId,
  rating: 5
});
let rating5Err = null;
try {
  await rating5Doc.validate();
} catch (err) {
  rating5Err = err;
}
assert(rating5Err === null, '1.3 Rating of 5 is valid in model schema');

// 1.3 Rating 0 rejected
const rating0Doc = new Feedback({
  complaint: complaintResolvedId,
  citizen: citizenOneId,
  rating: 0
});
let rating0Err = null;
try {
  await rating0Doc.validate();
} catch (err) {
  rating0Err = err;
}
assert(
  rating0Err && rating0Err.errors.rating,
  '1.4 Rating of 0 is rejected by schema validator (minimum 1)'
);

// 1.4 Rating 6 rejected
const rating6Doc = new Feedback({
  complaint: complaintResolvedId,
  citizen: citizenOneId,
  rating: 6
});
let rating6Err = null;
try {
  await rating6Doc.validate();
} catch (err) {
  rating6Err = err;
}
assert(
  rating6Err && rating6Err.errors.rating,
  '1.5 Rating of 6 is rejected by schema validator (maximum 5)'
);

// 1.5 Non-integer rating rejected
const floatRatingDoc = new Feedback({
  complaint: complaintResolvedId,
  citizen: citizenOneId,
  rating: 3.5
});
let floatErr = null;
try {
  await floatRatingDoc.validate();
} catch (err) {
  floatErr = err;
}
assert(
  floatErr && floatErr.errors.rating,
  '1.6 Float rating (3.5) is rejected by integer validator'
);

// 1.6 Missing required fields
const missingComplaintDoc = new Feedback({
  citizen: citizenOneId,
  rating: 4
});
let missingComplaintErr = null;
try {
  await missingComplaintDoc.validate();
} catch (err) {
  missingComplaintErr = err;
}
assert(
  missingComplaintErr && missingComplaintErr.errors.complaint,
  '1.7 Missing complaint reference is rejected'
);

const missingCitizenDoc = new Feedback({
  complaint: complaintResolvedId,
  rating: 4
});
let missingCitizenErr = null;
try {
  await missingCitizenDoc.validate();
} catch (err) {
  missingCitizenErr = err;
}
assert(
  missingCitizenErr && missingCitizenErr.errors.citizen,
  '1.8 Missing citizen reference is rejected'
);

// 1.7 Oversized comment rejected
const longCommentDoc = new Feedback({
  complaint: complaintResolvedId,
  citizen: citizenOneId,
  rating: 4,
  comment: 'A'.repeat(501)
});
let longCommentErr = null;
try {
  await longCommentDoc.validate();
} catch (err) {
  longCommentErr = err;
}
assert(
  longCommentErr && longCommentErr.errors.comment,
  '1.9 Feedback comment exceeding 500 characters is rejected'
);

// 1.8 toSafeObject() sanitization
const safeOutput = validDoc.toSafeObject();
assert(
  safeOutput.rating === 5 &&
  safeOutput.comment.includes('Great work') &&
  safeOutput.complaint === complaintResolvedId.toString() &&
  safeOutput.citizen === citizenOneId.toString() &&
  safeOutput.__v === undefined,
  '1.10 toSafeObject() exposes clean attributes and strips internal driver fields'
);

// -----------------------------------------------------------------------------
// 2. FEEDBACK SERVICE: SUBMISSION & BUSINESS RULES
// -----------------------------------------------------------------------------
console.log('\n--- 2. Feedback Service: Submission Business Rules ---');

// Mock data store for Service tests
const mockComplaints = {
  [complaintResolvedId.toString()]: {
    _id: complaintResolvedId,
    complaintId: 'CFX-20261119-9001',
    title: 'Pothole on Maple Ave',
    status: 'Resolved',
    reportedBy: citizenOneId
  },
  [complaintPendingId.toString()]: {
    _id: complaintPendingId,
    complaintId: 'CFX-20261119-9002',
    title: 'Trash on 3rd St',
    status: 'Pending',
    reportedBy: citizenOneId
  },
  [complaintInProgressId.toString()]: {
    _id: complaintInProgressId,
    complaintId: 'CFX-20261119-9003',
    title: 'Broken streetlight on 7th',
    status: 'In Progress',
    reportedBy: citizenOneId
  },
  [guestComplaintId.toString()]: {
    _id: guestComplaintId,
    complaintId: 'CFX-20261119-9004',
    title: 'Water leak',
    status: 'Resolved',
    reportedBy: null
  }
};

const mockFeedbacks = new Map();

// Standalone offline mock for Mongoose connection and models
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

Feedback.prototype.save = async function () {
  mockFeedbacks.set(this.complaint.toString(), this);
  return this;
};

// 2.1 Valid submission on resolved complaint by owner
const feedbackResult = await submitFeedback(citizenOneId, complaintResolvedId.toString(), {
  rating: 5,
  comment: 'Quick and professional resolution by road crew!'
});

assert(
  feedbackResult && feedbackResult.rating === 5 && feedbackResult.comment.includes('Quick and professional'),
  '2.1 Valid feedback submission by complaint owner succeeds'
);

// 2.2 Ratings 1 and 5 accepted in service
mockFeedbacks.clear();
const resultRating1 = await submitFeedback(citizenOneId, complaintResolvedId.toString(), {
  rating: 1,
  comment: 'Took too long'
});
assert(resultRating1.rating === 1, '2.2 Rating of 1 is accepted by feedback service');

mockFeedbacks.clear();
const resultRating5 = await submitFeedback(citizenOneId, complaintResolvedId.toString(), {
  rating: 5,
  comment: 'Outstanding'
});
assert(resultRating5.rating === 5, '2.3 Rating of 5 is accepted by feedback service');

// 2.3 Ratings 0 and 6 rejected in service
let caughtRating0 = false;
try {
  await submitFeedback(citizenOneId, complaintResolvedId.toString(), { rating: 0 });
} catch (err) {
  caughtRating0 = true;
  assert(err.statusCode === 400 && err.message.includes('Rating must be an integer between 1 and 5'), '2.4 Rating 0 rejected with HTTP 400');
}
assert(caughtRating0, '2.5 Service threw error on rating 0');

let caughtRating6 = false;
try {
  await submitFeedback(citizenOneId, complaintResolvedId.toString(), { rating: 6 });
} catch (err) {
  caughtRating6 = true;
  assert(err.statusCode === 400 && err.message.includes('Rating must be an integer between 1 and 5'), '2.6 Rating 6 rejected with HTTP 400');
}
assert(caughtRating6, '2.7 Service threw error on rating 6');

// 2.4 Non-integer rating rejected in service
let caughtFloat = false;
try {
  await submitFeedback(citizenOneId, complaintResolvedId.toString(), { rating: 4.2 });
} catch (err) {
  caughtFloat = true;
  assert(err.statusCode === 400 && err.message.includes('Rating must be an integer between 1 and 5'), '2.8 Float rating 4.2 rejected with HTTP 400');
}
assert(caughtFloat, '2.9 Service threw error on non-integer rating');

let caughtStringRating = false;
try {
  await submitFeedback(citizenOneId, complaintResolvedId.toString(), { rating: '5' });
} catch (err) {
  caughtStringRating = true;
  assert(err.statusCode === 400, '2.10 String rating "5" rejected with HTTP 400');
}
assert(caughtStringRating, '2.11 Service threw error on string rating');

// 2.5 Feedback on unresolved complaint rejected
let caughtPending = false;
try {
  await submitFeedback(citizenOneId, complaintPendingId.toString(), { rating: 4 });
} catch (err) {
  caughtPending = true;
  assert(
    err.statusCode === 400 && err.message.includes('Feedback can only be submitted for resolved complaints'),
    '2.12 Feedback on Pending complaint rejected with HTTP 400'
  );
}
assert(caughtPending, '2.13 Unresolved Pending status guard confirmed');

let caughtInProgress = false;
try {
  await submitFeedback(citizenOneId, complaintInProgressId.toString(), { rating: 3 });
} catch (err) {
  caughtInProgress = true;
  assert(
    err.statusCode === 400 && err.message.includes('Feedback can only be submitted for resolved complaints'),
    '2.14 Feedback on In Progress complaint rejected with HTTP 400'
  );
}
assert(caughtInProgress, '2.15 Unresolved In Progress status guard confirmed');

// 2.6 Non-owner citizen cannot submit feedback
let caughtNonOwner = false;
try {
  await submitFeedback(citizenTwoId, complaintResolvedId.toString(), { rating: 5 });
} catch (err) {
  caughtNonOwner = true;
  assert(
    err.statusCode === 403 && err.message.includes('You are not authorized to submit feedback'),
    '2.16 Non-owner citizen receives HTTP 403 Forbidden'
  );
}
assert(caughtNonOwner, '2.17 Ownership authorization guard confirmed');

// 2.7 Guest complaint without registered owner cannot submit feedback
let caughtGuest = false;
try {
  await submitFeedback(citizenOneId, guestComplaintId.toString(), { rating: 4 });
} catch (err) {
  caughtGuest = true;
  assert(
    err.statusCode === 403 && err.message.includes('guest complaints'),
    '2.18 Guest complaint without registered owner rejected with HTTP 403'
  );
}
assert(caughtGuest, '2.19 Guest complaint ownership guard confirmed');

// 2.8 Duplicate feedback rejected
mockFeedbacks.clear();
await submitFeedback(citizenOneId, complaintResolvedId.toString(), { rating: 4, comment: 'Initial review' });

let caughtDuplicate = false;
try {
  await submitFeedback(citizenOneId, complaintResolvedId.toString(), { rating: 5, comment: 'Second review' });
} catch (err) {
  caughtDuplicate = true;
  assert(
    err.statusCode === 400 && err.message.includes('Feedback has already been submitted'),
    '2.20 Duplicate feedback on same complaint rejected with HTTP 400'
  );
}
assert(caughtDuplicate, '2.21 Duplicate feedback prevention confirmed');

// 2.9 Missing complaint handled safely
let caughtMissing = false;
try {
  const nonExistentId = new mongoose.Types.ObjectId().toString();
  await submitFeedback(citizenOneId, nonExistentId, { rating: 5 });
} catch (err) {
  caughtMissing = true;
  assert(
    err.statusCode === 404 && err.message.includes('Complaint not found'),
    '2.22 Missing complaint identifier safely returns HTTP 404 Not Found'
  );
}
assert(caughtMissing, '2.23 Missing complaint 404 handling confirmed');

// 2.10 Complaint lookup via public CFX ticket ID
mockFeedbacks.clear();
const cfxLookupResult = await submitFeedback(citizenOneId, 'CFX-20261119-9001', {
  rating: 4,
  comment: 'Submitted via public CFX ticket ID'
});
assert(
  cfxLookupResult && cfxLookupResult.rating === 4,
  '2.24 Feedback submission successfully resolves public CFX ticket ID'
);

// -----------------------------------------------------------------------------
// 3. FEEDBACK SERVICE: RETRIEVAL & ACCESS CONTROLS
// -----------------------------------------------------------------------------
console.log('\n--- 3. Feedback Service: Retrieval & Access Controls ---');

// 3.1 Citizen can retrieve their own feedback for a complaint
const ownerRetrieved = await getFeedbackByComplaint(
  complaintResolvedId.toString(),
  citizenOneId,
  'citizen'
);
assert(
  ownerRetrieved !== null && ownerRetrieved.rating === 4,
  '3.1 Citizen can retrieve feedback for their own complaint'
);

// 3.2 Non-owner citizen CANNOT retrieve another citizen's feedback
let caughtUnauthorizedRetrieve = false;
try {
  await getFeedbackByComplaint(
    complaintResolvedId.toString(),
    citizenTwoId,
    'citizen'
  );
} catch (err) {
  caughtUnauthorizedRetrieve = true;
  assert(
    err.statusCode === 403 && err.message.includes('You are not authorized to view feedback'),
    '3.2 Non-owner citizen is blocked from viewing another citizen\'s feedback with HTTP 403'
  );
}
assert(caughtUnauthorizedRetrieve, '3.3 Cross-citizen feedback retrieval blocked');

// 3.3 Admin can retrieve feedback for any complaint
const adminRetrieved = await getFeedbackByComplaint(
  complaintResolvedId.toString(),
  citizenTwoId,
  'admin'
);
assert(
  adminRetrieved !== null && adminRetrieved.rating === 4,
  '3.4 Municipal administrator can retrieve feedback for any complaint'
);

// 3.4 Retrieve all feedback for an authenticated citizen
Feedback.find = (query) => ({
  sort: () => ({
    populate: async () => [
      {
        ...cfxLookupResult,
        complaint: mockComplaints[complaintResolvedId.toString()],
        toSafeObject: () => cfxLookupResult
      }
    ]
  })
});

const citizenFeedbackList = await getCitizenFeedback(citizenOneId);
assert(
  Array.isArray(citizenFeedbackList) && citizenFeedbackList.length === 1,
  '3.5 Citizen can retrieve their full historical feedback list'
);
assert(
  citizenFeedbackList[0].complaintId === 'CFX-20261119-9001' && citizenFeedbackList[0].rating === 4,
  '3.6 Historical feedback list includes populated complaint ticket attributes'
);

// 3.5 Missing citizenId in getCitizenFeedback returns 401
let caughtUnauth = false;
try {
  await getCitizenFeedback(null);
} catch (err) {
  caughtUnauth = true;
  assert(err.statusCode === 401, '3.7 Missing citizenId in getCitizenFeedback returns HTTP 401');
}
assert(caughtUnauth, '3.8 getCitizenFeedback authentication guard confirmed');

// =============================================================================
// SUMMARY REPORT
// =============================================================================
console.log('\n==================================================');
console.log(`Summary: ${passed}/${total} Mini Phase 16.1 Citizen Feedback tests passed.`);
console.log('==================================================');

if (passed !== total) {
  process.exit(1);
}
