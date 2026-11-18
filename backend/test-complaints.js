/**
 * CivicFix AI - Phase 4: Complaint Submission & Tracking Test Suite
 * Tests field validations, ID generation, category restrictions,
 * coordinate bounds checks, public data sanitization, and error handling.
 */

import { Complaint } from './src/models/Complaint.js';
import {
  ALLOWED_CATEGORIES,
  generateComplaintId,
  createComplaint,
  getComplaintByTrackId
} from './src/services/complaintService.js';

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
console.log('📋 CivicFix AI: Phase 4 Complaint Test Suite');
console.log('==================================================\n');

// -----------------------------------------------------------------------------
// 1. COMPLAINT ID GENERATION TESTS
// -----------------------------------------------------------------------------
console.log('--- 1. Unique Complaint ID Generation ---');

const id1 = generateComplaintId();
const id2 = generateComplaintId();

assert(
  typeof id1 === 'string' && id1.startsWith('CFX-'),
  'Complaint ID starts with standard "CFX-" municipal prefix'
);

assert(
  /^CFX-\d{8}-\d{4}$/.test(id1),
  `Complaint ID matches expected format CFX-YYYYMMDD-XXXX (Generated: ${id1})`
);

assert(id1 !== id2, 'Successive complaint IDs are unique');

// -----------------------------------------------------------------------------
// 2. FIELD VALIDATIONS & CATEGORY CONSTRAINTS
// -----------------------------------------------------------------------------
console.log('\n--- 2. Input Validations & Category Constraints ---');

// Test 4: Missing Title
let missingTitleErr = null;
try {
  await createComplaint({
    description: 'Pothole on 5th Avenue causing tire damage',
    category: 'Road Damage',
    address: '5th Ave & 42nd St'
  });
} catch (err) {
  missingTitleErr = err;
}
assert(
  missingTitleErr && missingTitleErr.statusCode === 400 && missingTitleErr.message.includes('title is required'),
  'Missing title is rejected with 400 Bad Request'
);

// Test 5: Short Title (< 3 chars)
let shortTitleErr = null;
try {
  await createComplaint({
    title: 'Po',
    description: 'Pothole on 5th Avenue causing tire damage',
    category: 'Road Damage',
    address: '5th Ave & 42nd St'
  });
} catch (err) {
  shortTitleErr = err;
}
assert(
  shortTitleErr && shortTitleErr.statusCode === 400 && shortTitleErr.message.includes('between 3 and 150 characters'),
  'Short title (< 3 chars) is rejected'
);

// Test 6: Missing Description
let missingDescErr = null;
try {
  await createComplaint({
    title: 'Deep Pothole',
    category: 'Road Damage',
    address: '5th Ave & 42nd St'
  });
} catch (err) {
  missingDescErr = err;
}
assert(
  missingDescErr && missingDescErr.statusCode === 400 && missingDescErr.message.includes('description is required'),
  'Missing description is rejected with 400 Bad Request'
);

// Test 7: Short Description (< 10 chars)
let shortDescErr = null;
try {
  await createComplaint({
    title: 'Deep Pothole',
    description: 'Too short',
    category: 'Road Damage',
    address: '5th Ave & 42nd St'
  });
} catch (err) {
  shortDescErr = err;
}
assert(
  shortDescErr && shortDescErr.statusCode === 400 && shortDescErr.message.includes('between 10 and 2000 characters'),
  'Short description (< 10 chars) is rejected'
);

// Test 8: Invalid Category
let invalidCategoryErr = null;
try {
  await createComplaint({
    title: 'Alien Spaceship Landing',
    description: 'Unknown flying object blocking the main street lane',
    category: 'UFO Sighting',
    address: '5th Ave & 42nd St'
  });
} catch (err) {
  invalidCategoryErr = err;
}
assert(
  invalidCategoryErr && invalidCategoryErr.statusCode === 400 && invalidCategoryErr.message.includes('Supported categories'),
  'Invalid category is rejected with allowed categories list'
);

// Test 9: Missing Address
let missingAddressErr = null;
try {
  await createComplaint({
    title: 'Water Leakage Near Park',
    description: 'Fresh water gushing out from broken municipal pipeline',
    category: 'Water Leakage'
  });
} catch (err) {
  missingAddressErr = err;
}
assert(
  missingAddressErr && missingAddressErr.statusCode === 400 && missingAddressErr.message.includes('address is required'),
  'Missing address is rejected'
);

// Test 10: Invalid Latitude (> 90)
let invalidLatErr = null;
try {
  await createComplaint({
    title: 'Broken Streetlight',
    description: 'Light pole flickering and going dark at night',
    category: 'Streetlight',
    address: 'Corner of Maple St',
    latitude: 145.5
  });
} catch (err) {
  invalidLatErr = err;
}
assert(
  invalidLatErr && invalidLatErr.statusCode === 400 && invalidLatErr.message.includes('Latitude must be a valid number between -90 and 90'),
  'Out-of-bounds latitude is rejected'
);

// Test 11: Invalid Longitude (< -180)
let invalidLngErr = null;
try {
  await createComplaint({
    title: 'Broken Streetlight',
    description: 'Light pole flickering and going dark at night',
    category: 'Streetlight',
    address: 'Corner of Maple St',
    longitude: -250.0
  });
} catch (err) {
  invalidLngErr = err;
}
assert(
  invalidLngErr && invalidLngErr.statusCode === 400 && invalidLngErr.message.includes('Longitude must be a valid number between -180 and 180'),
  'Out-of-bounds longitude is rejected'
);

// -----------------------------------------------------------------------------
// 3. MODEL INSTANTIATION & PUBLIC DATA SANITIZATION
// -----------------------------------------------------------------------------
console.log('\n--- 3. Model & Public Sanitization Tests ---');

// Test 12: Temporary Guest Submission (reportedBy is null)
const guestDoc = new Complaint({
  complaintId: generateComplaintId(),
  title: 'Blocked Drainage Canal',
  description: 'Heavy rain causes water backflow into residential streets',
  category: 'Drainage',
  location: {
    address: '77 Elm Street',
    latitude: 37.7749,
    longitude: -122.4194
  },
  status: 'Pending',
  reportedBy: null // Temporary guest submission
});

const valErr = guestDoc.validateSync();
assert(valErr === undefined, 'Guest complaint with reportedBy=null validates successfully');
assert(guestDoc.status === 'Pending', 'Initial complaint status defaults to "Pending"');

// Test 13: toPublicJSON Sanitization
const publicJson = guestDoc.toPublicJSON();
assert(
  publicJson._id === undefined &&
  publicJson.__v === undefined &&
  publicJson.reportedBy === undefined,
  'toPublicJSON() excludes internal database identifiers and user references'
);

assert(
  publicJson.complaintId.startsWith('CFX-') &&
  publicJson.title === 'Blocked Drainage Canal' &&
  publicJson.category === 'Drainage' &&
  publicJson.address === '77 Elm Street' &&
  publicJson.status === 'Pending',
  'toPublicJSON() provides all required public tracking attributes'
);

// -----------------------------------------------------------------------------
// 4. TRACKING VALIDATIONS
// -----------------------------------------------------------------------------
console.log('\n--- 4. Tracking Validations ---');

// Test 14: Empty Complaint ID tracking
let emptyTrackErr = null;
try {
  await getComplaintByTrackId('');
} catch (err) {
  emptyTrackErr = err;
}
assert(
  emptyTrackErr && emptyTrackErr.statusCode === 400,
  'Tracking with empty ID is rejected with 400 Bad Request'
);

// Test 15: All 6 Supported Categories are Defined
const expectedCategories = ['Road Damage', 'Garbage', 'Water Leakage', 'Streetlight', 'Drainage', 'Other'];
const categoriesMatch = expectedCategories.every((cat) => ALLOWED_CATEGORIES.includes(cat)) &&
                        ALLOWED_CATEGORIES.length === expectedCategories.length;
assert(categoriesMatch, 'All 6 standard municipal complaint categories are correctly supported');

console.log('\n==================================================');
console.log(`Summary: ${passed}/${total} Phase 4 complaint tests passed.`);
console.log('==================================================');

process.exit(passed === total ? 0 : 1);
