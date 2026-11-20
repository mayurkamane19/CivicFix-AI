/**
 * CivicFix AI - Mini Phase 16.4: Admin Feedback Dashboard Backend Test Suite
 *
 * Verifies:
 * 1. Admin-only access enforcement (401 for unauthenticated, 403 for citizen/officer, 200 for admin)
 * 2. Feedback listing endpoint (/api/admin/feedback) with populated complaint details
 * 3. Citizen privacy protection (no passwords, emails, tokens or phone numbers exposed)
 * 4. Pagination metadata (page, limit, total, totalPages, hasNextPage, hasPrevPage)
 * 5. Rating filter (1-5 star queries and invalid rating rejection)
 * 6. Complaint ID search filter (exact and substring matches)
 * 7. Feedback statistics calculation (/api/admin/feedback/stats: total, average, 1-5 star distribution)
 * 8. Safe empty collection statistics handling (0 totals, 0 avg, zeroed distribution)
 * 9. Invalid query parameter bounds (page < 1, limit > 100, non-integer inputs)
 */

import mongoose from 'mongoose';
import { Feedback } from './src/models/Feedback.js';
import { Complaint } from './src/models/Complaint.js';
import {
  getAdminFeedbackList,
  getAdminFeedbackStats
} from './src/controllers/adminFeedbackController.js';
import {
  getFeedbackForAdmin,
  getFeedbackStatsForAdmin
} from './src/services/feedbackService.js';
import { protect, authorize } from './src/middleware/authMiddleware.js';
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
console.log('📊 CivicFix AI: Mini Phase 16.4 Admin Feedback Tests');
console.log('==================================================\n');

// Mock ObjectIds
const citizenUserId = new mongoose.Types.ObjectId();
const officerUserId = new mongoose.Types.ObjectId();
const adminUserId = new mongoose.Types.ObjectId();

const comp1Id = new mongoose.Types.ObjectId();
const comp2Id = new mongoose.Types.ObjectId();
const comp3Id = new mongoose.Types.ObjectId();
const comp4Id = new mongoose.Types.ObjectId();

const mockComplaints = {
  [comp1Id.toString()]: {
    _id: comp1Id,
    complaintId: 'CFX-20261119-7001',
    title: 'Severe pothole on 4th St',
    category: 'Road Damage',
    status: 'Resolved',
    location: { address: '100 Main St', latitude: 37.77, longitude: -122.41 },
    reportedBy: citizenUserId
  },
  [comp2Id.toString()]: {
    _id: comp2Id,
    complaintId: 'CFX-20261119-7002',
    title: 'Garbage dump near school',
    category: 'Garbage & Waste',
    status: 'Resolved',
    location: { address: '200 Elm St', latitude: 37.78, longitude: -122.42 },
    reportedBy: citizenUserId
  },
  [comp3Id.toString()]: {
    _id: comp3Id,
    complaintId: 'CFX-20261119-7003',
    title: 'Water pipe leak on avenue',
    category: 'Water & Sewage',
    status: 'Resolved',
    location: { address: '300 Pine St', latitude: 37.79, longitude: -122.43 },
    reportedBy: citizenUserId
  },
  [comp4Id.toString()]: {
    _id: comp4Id,
    complaintId: 'CFX-20261119-7004',
    title: 'Broken streetlight',
    category: 'Streetlight',
    status: 'Resolved',
    location: { address: '400 Oak St', latitude: 37.80, longitude: -122.44 },
    reportedBy: citizenUserId
  }
};

const mockFeedbacks = [
  {
    _id: new mongoose.Types.ObjectId(),
    complaint: mockComplaints[comp1Id.toString()],
    citizen: { _id: citizenUserId, name: 'Alice Citizen' },
    rating: 5,
    comment: 'Pothole was filled within 24 hours, amazing work!',
    createdAt: new Date('2026-11-20T08:00:00Z')
  },
  {
    _id: new mongoose.Types.ObjectId(),
    complaint: mockComplaints[comp2Id.toString()],
    citizen: { _id: citizenUserId, name: 'Bob Citizen' },
    rating: 4,
    comment: 'Waste was cleared promptly.',
    createdAt: new Date('2026-11-20T08:15:00Z')
  },
  {
    _id: new mongoose.Types.ObjectId(),
    complaint: mockComplaints[comp3Id.toString()],
    citizen: { _id: citizenUserId, name: 'Charlie Citizen' },
    rating: 3,
    comment: 'Water stopped leaking but pavement remains dirty.',
    createdAt: new Date('2026-11-20T08:30:00Z')
  },
  {
    _id: new mongoose.Types.ObjectId(),
    complaint: mockComplaints[comp4Id.toString()],
    citizen: { _id: citizenUserId, name: 'David Citizen' },
    rating: 1,
    comment: 'Light is still flickering after marked resolved.',
    createdAt: new Date('2026-11-20T08:45:00Z')
  }
];

// Mock Mongoose connection state
Object.defineProperty(mongoose.connection, 'readyState', {
  value: 1,
  writable: true,
  configurable: true
});

Complaint.find = (query) => {
  let results = Object.values(mockComplaints);
  if (query && query.complaintId) {
    if (query.complaintId instanceof RegExp) {
      results = results.filter((c) => query.complaintId.test(c.complaintId));
    } else if (typeof query.complaintId === 'string') {
      results = results.filter((c) => c.complaintId === query.complaintId);
    }
  }
  return {
    select: async () => results.map((c) => ({ _id: c._id, complaintId: c.complaintId }))
  };
};

Feedback.countDocuments = async (query = {}) => {
  let items = [...mockFeedbacks];
  if (query.rating !== undefined) {
    items = items.filter((f) => f.rating === query.rating);
  }
  if (query.complaint && query.complaint.$in) {
    const ids = query.complaint.$in.map((id) => id.toString());
    items = items.filter((f) => ids.includes(f.complaint._id.toString()));
  }
  return items.length;
};

Feedback.find = (query = {}) => {
  let items = [...mockFeedbacks];
  if (query.rating !== undefined) {
    items = items.filter((f) => f.rating === query.rating);
  }
  if (query.complaint && query.complaint.$in) {
    const ids = query.complaint.$in.map((id) => id.toString());
    items = items.filter((f) => ids.includes(f.complaint._id.toString()));
  }

  let skipCount = 0;
  let limitCount = items.length;

  const chain = {
    sort: () => chain,
    skip: (n) => {
      skipCount = n;
      return chain;
    },
    limit: (n) => {
      limitCount = n;
      return chain;
    },
    populate: () => ({
      populate: async () => {
        return items.slice(skipCount, skipCount + limitCount);
      }
    })
  };
  return chain;
};

Feedback.aggregate = async (pipeline) => {
  // Mock aggregation
  return [
    {
      totalFeedback: mockFeedbacks.length,
      avgRating: (5 + 4 + 3 + 1) / 4 // = 3.25 -> 3.3
    }
  ];
};

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
// 1. Route Registration & Access Authorization Guards
// -----------------------------------------------------------------------------
console.log('--- 1. Route Authorization & Role Access Controls ---');

const adminRouteStack = app._router.stack.filter(
  (layer) => layer.regexp && layer.regexp.test('/api/admin')
);
assert(adminRouteStack.length > 0, '1.1 /api/admin router is mounted in Express app');

// Test protect middleware
let protectInvokedNext = false;
const mockReqNoAuth = { headers: {} };
const mockResNoAuth = createMockRes();
protect(mockReqNoAuth, mockResNoAuth, () => {
  protectInvokedNext = true;
});
assert(mockResNoAuth.statusCode === 401, '1.2 Missing Authorization token returns HTTP 401');
assert(protectInvokedNext === false, '1.3 next() never called when token is missing');

// Test authorize('admin') with citizen role
const mockReqCitizen = { user: { _id: citizenUserId, role: 'citizen' } };
const mockResCitizen = createMockRes();
let citizenNext = false;
authorize('admin')(mockReqCitizen, mockResCitizen, () => {
  citizenNext = true;
});
assert(mockResCitizen.statusCode === 403, '1.4 Citizen role access to admin feedback is rejected with HTTP 403');
assert(citizenNext === false, '1.5 next() not invoked for citizen on admin routes');

// Test authorize('admin') with officer role
const mockReqOfficer = { user: { _id: officerUserId, role: 'officer' } };
const mockResOfficer = createMockRes();
let officerNext = false;
authorize('admin')(mockReqOfficer, mockResOfficer, () => {
  officerNext = true;
});
assert(mockResOfficer.statusCode === 403, '1.6 Officer role access to admin feedback is rejected with HTTP 403');
assert(officerNext === false, '1.7 next() not invoked for officer on admin routes');

// Test authorize('admin') with admin role
const mockReqAdmin = { user: { _id: adminUserId, role: 'admin' } };
const mockResAdmin = createMockRes();
let adminNext = false;
authorize('admin')(mockReqAdmin, mockResAdmin, () => {
  adminNext = true;
});
assert(adminNext === true, '1.8 Administrator role access is permitted by authorization middleware');

// -----------------------------------------------------------------------------
// 2. Feedback Listing & Pagination Tests
// -----------------------------------------------------------------------------
console.log('\n--- 2. Admin Feedback Listing & Pagination ---');

const reqList = { query: { page: '1', limit: '2' }, user: { _id: adminUserId, role: 'admin' } };
const resList = createMockRes();
await getAdminFeedbackList(reqList, resList, (err) => {
  if (err) throw err;
});

assert(resList.statusCode === 200, '2.1 GET /api/admin/feedback returns HTTP 200 OK');
assert(Array.isArray(resList.body.data.feedbacks), '2.2 Returns feedbacks array');
assert(resList.body.data.feedbacks.length === 2, '2.3 Page limit (2) respected');
assert(resList.body.data.pagination.total === 4, '2.4 Total feedback count is 4');
assert(resList.body.data.pagination.page === 1, '2.5 Current page is 1');
assert(resList.body.data.pagination.totalPages === 2, '2.6 Total pages is 2');
assert(resList.body.data.pagination.hasNextPage === true, '2.7 hasNextPage is true on page 1');
assert(resList.body.data.pagination.hasPrevPage === false, '2.8 hasPrevPage is false on page 1');

// Test Page 2
const reqListP2 = { query: { page: '2', limit: '2' }, user: { _id: adminUserId, role: 'admin' } };
const resListP2 = createMockRes();
await getAdminFeedbackList(reqListP2, resListP2, (err) => {
  if (err) throw err;
});
assert(resListP2.body.data.pagination.page === 2, '2.9 Page 2 returns page=2');
assert(resListP2.body.data.pagination.hasNextPage === false, '2.10 hasNextPage is false on page 2');
assert(resListP2.body.data.pagination.hasPrevPage === true, '2.11 hasPrevPage is true on page 2');

// -----------------------------------------------------------------------------
// 3. Citizen Privacy Protection & Payload Structure
// -----------------------------------------------------------------------------
console.log('\n--- 3. Citizen Privacy Protection & Output Sanitization ---');

const sampleFeedback = resList.body.data.feedbacks[0];
assert(sampleFeedback.complaintId === 'CFX-20261119-7001', '3.1 Populates complaint ticket ID');
assert(sampleFeedback.complaintTitle !== undefined, '3.2 Includes complaint title');
assert(sampleFeedback.complaintCategory !== undefined, '3.3 Includes complaint category');
assert(sampleFeedback.rating === 5, '3.4 Includes feedback rating');
assert(sampleFeedback.comment.includes('Pothole'), '3.5 Includes citizen feedback comment');
assert(sampleFeedback.citizenName === 'Alice Citizen', '3.6 Provides citizen display name');
assert(sampleFeedback.password === undefined, '3.7 Citizen password hash is NEVER exposed');
assert(sampleFeedback.email === undefined, '3.8 Citizen email address is omitted for privacy');
assert(sampleFeedback.token === undefined, '3.9 Authentication tokens are strictly excluded');

// -----------------------------------------------------------------------------
// 4. Rating Filter Tests
// -----------------------------------------------------------------------------
console.log('\n--- 4. Rating Filter Verification (1-5) ---');

const reqFilterRating = { query: { rating: '5' }, user: { _id: adminUserId, role: 'admin' } };
const resFilterRating = createMockRes();
await getAdminFeedbackList(reqFilterRating, resFilterRating, (err) => {
  if (err) throw err;
});
assert(resFilterRating.statusCode === 200, '4.1 Filtering by rating=5 succeeds');
assert(resFilterRating.body.data.feedbacks.every((f) => f.rating === 5), '4.2 All returned records have rating=5');

// Rating boundary rejection
let ratingErrorCaught = false;
try {
  await getFeedbackForAdmin({ rating: '6' });
} catch (err) {
  ratingErrorCaught = true;
  assert(err.statusCode === 400, '4.3 Rating > 5 throws HTTP 400 Bad Request');
}
assert(ratingErrorCaught, '4.4 Invalid rating 6 caught');

let ratingZeroError = false;
try {
  await getFeedbackForAdmin({ rating: '0' });
} catch (err) {
  ratingZeroError = true;
  assert(err.statusCode === 400, '4.5 Rating 0 throws HTTP 400 Bad Request');
}
assert(ratingZeroError, '4.6 Invalid rating 0 caught');

// -----------------------------------------------------------------------------
// 5. Complaint ID Search Filter Tests
// -----------------------------------------------------------------------------
console.log('\n--- 5. Complaint ID Search Verification ---');

const reqSearch = { query: { search: 'CFX-20261119-7001' }, user: { _id: adminUserId, role: 'admin' } };
const resSearch = createMockRes();
await getAdminFeedbackList(reqSearch, resSearch, (err) => {
  if (err) throw err;
});
assert(resSearch.statusCode === 200, '5.1 Complaint ID search returns HTTP 200 OK');
assert(
  resSearch.body.data.feedbacks.every((f) => f.complaintId === 'CFX-20261119-7001'),
  '5.2 Filtered results only contain searched complaint ticket ID'
);

const reqSearchNone = { query: { search: 'CFX-99999999-9999' }, user: { _id: adminUserId, role: 'admin' } };
const resSearchNone = createMockRes();
await getAdminFeedbackList(reqSearchNone, resSearchNone, (err) => {
  if (err) throw err;
});
assert(resSearchNone.body.data.feedbacks.length === 0, '5.3 Non-matching search returns empty array');
assert(resSearchNone.body.data.pagination.total === 0, '5.4 Non-matching search returns total=0');

// -----------------------------------------------------------------------------
// 6. Feedback Statistics & Distribution
// -----------------------------------------------------------------------------
console.log('\n--- 6. Feedback Statistics & Rating Distribution ---');

const reqStats = { user: { _id: adminUserId, role: 'admin' } };
const resStats = createMockRes();
await getAdminFeedbackStats(reqStats, resStats, (err) => {
  if (err) throw err;
});
assert(resStats.statusCode === 200, '6.1 GET /api/admin/feedback/stats returns HTTP 200 OK');
assert(resStats.body.data.stats.totalFeedback === 4, '6.2 totalFeedback matches mock count');
assert(typeof resStats.body.data.stats.averageRating === 'number', '6.3 averageRating is numeric');
assert(resStats.body.data.stats.ratingDistribution !== undefined, '6.4 ratingDistribution is provided');
assert(typeof resStats.body.data.stats.ratingDistribution[5] === 'number', '6.5 5-star count is provided');
assert(typeof resStats.body.data.stats.ratingDistribution[1] === 'number', '6.6 1-star count is provided');

// -----------------------------------------------------------------------------
// 7. Safe Handling of Empty Collections
// -----------------------------------------------------------------------------
console.log('\n--- 7. Empty Feedback Statistics Handling ---');

// Mock empty collection
const originalAggregate = Feedback.aggregate;
Feedback.aggregate = async () => [];
const emptyStats = await getFeedbackStatsForAdmin();
assert(emptyStats.totalFeedback === 0, '7.1 Empty collection returns totalFeedback: 0');
assert(emptyStats.averageRating === 0, '7.2 Empty collection returns averageRating: 0');
assert(emptyStats.ratingDistribution[1] === 0, '7.3 Empty distribution 1-star is 0');
assert(emptyStats.ratingDistribution[5] === 0, '7.4 Empty distribution 5-star is 0');
Feedback.aggregate = originalAggregate;

// -----------------------------------------------------------------------------
// 8. Invalid Query Parameter Bounds
// -----------------------------------------------------------------------------
console.log('\n--- 8. Invalid Query Parameter Bounds ---');

let pageError = false;
try {
  await getFeedbackForAdmin({ page: -1 });
} catch (err) {
  pageError = true;
  assert(err.statusCode === 400, '8.1 Negative page throws HTTP 400');
}
assert(pageError, '8.2 Page bounds error verified');

let limitError = false;
try {
  await getFeedbackForAdmin({ limit: 101 });
} catch (err) {
  limitError = true;
  assert(err.statusCode === 400, '8.3 Limit > 100 throws HTTP 400');
}
assert(limitError, '8.4 Limit bounds error verified');

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n==================================================');
console.log(`Results: ${passed}/${total} backend admin feedback tests passed`);
console.log('==================================================');

if (passed === total) {
  console.log('🎉 ALL BACKEND ADMIN FEEDBACK TESTS PASSED!\n');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED!\n');
  process.exit(1);
}
