/**
 * CivicFix AI - Model Schema Validation Test Runner
 * Validates Mongoose models in-memory without requiring an active database connection.
 */

import { User } from './src/models/User.js';
import { Complaint } from './src/models/Complaint.js';

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
  }
}

console.log('==================================================');
console.log('🧪 CivicFix AI: Schema Validation Test Suite (Phase 3)');
console.log('==================================================\n');

// -----------------------------------------------------------------------------
// USER MODEL TESTS
// -----------------------------------------------------------------------------
console.log('--- User Model Validation Tests ---');

// Test 1: Valid User with Password
const validUser = new User({
  name: 'John Citizen',
  email: 'john.citizen@example.com',
  password: 'StrongPassword123',
  role: 'citizen'
});
const validUserError = validUser.validateSync();
assert(validUserError === undefined, 'Valid user data with password is accepted');

// Test 2: Missing Name
const missingNameUser = new User({
  email: 'noname@example.com',
  password: 'StrongPassword123',
  role: 'citizen'
});
const missingNameError = missingNameUser.validateSync();
assert(
  missingNameError && missingNameError.errors['name'] !== undefined,
  'Missing name is rejected'
);

// Test 3: Invalid Email
const invalidEmailUser = new User({
  name: 'Invalid Email User',
  email: 'not-an-email-address',
  password: 'StrongPassword123',
  role: 'citizen'
});
const invalidEmailError = invalidEmailUser.validateSync();
assert(
  invalidEmailError && invalidEmailError.errors['email'] !== undefined,
  'Invalid email format is rejected'
);

// Test 4: Invalid Role
const invalidRoleUser = new User({
  name: 'Invalid Role User',
  email: 'role@example.com',
  password: 'StrongPassword123',
  role: 'superhero'
});
const invalidRoleError = invalidRoleUser.validateSync();
assert(
  invalidRoleError && invalidRoleError.errors['role'] !== undefined,
  'Invalid role ("superhero") is rejected'
);

// Test 5: Missing Password
const missingPasswordUser = new User({
  name: 'No Password User',
  email: 'nopass@example.com',
  role: 'citizen'
});
const missingPasswordError = missingPasswordUser.validateSync();
assert(
  missingPasswordError && missingPasswordError.errors['password'] !== undefined,
  'Missing password is rejected'
);

// Test 6: Short Password (< 8 characters)
const shortPasswordUser = new User({
  name: 'Short Password User',
  email: 'shortpass@example.com',
  password: 'short',
  role: 'citizen'
});
const shortPasswordError = shortPasswordUser.validateSync();
assert(
  shortPasswordError && shortPasswordError.errors['password'] !== undefined,
  'Short password (< 8 chars) is rejected'
);

// Test 7: Default Role is citizen
const defaultRoleUser = new User({
  name: 'Default Role User',
  email: 'default@example.com',
  password: 'StrongPassword123'
});
assert(defaultRoleUser.role === 'citizen', 'Default role is set to "citizen"');

// -----------------------------------------------------------------------------
// COMPLAINT MODEL TESTS
// -----------------------------------------------------------------------------
console.log('\n--- Complaint Model Validation Tests ---');

// Test 8: Valid Complaint
const validComplaint = new Complaint({
  title: 'Dangerous Pothole on Main Street',
  description: 'Deep pothole near crosswalk causing traffic slowdowns',
  category: 'Road Damage',
  location: {
    address: '123 Main St, Springfield',
    latitude: 37.7749,
    longitude: -122.4194
  },
  status: 'Pending'
});
const validComplaintError = validComplaint.validateSync();
assert(validComplaintError === undefined, 'Valid complaint data is accepted');

// Test 9: Missing Title
const missingTitleComplaint = new Complaint({
  category: 'Garbage',
  status: 'Pending'
});
const missingTitleError = missingTitleComplaint.validateSync();
assert(
  missingTitleError && missingTitleError.errors['title'] !== undefined,
  'Missing title is rejected'
);

// Test 10: Invalid Status
const invalidStatusComplaint = new Complaint({
  title: 'Overflowing dumpster near park',
  category: 'Garbage',
  status: 'Archived' // Valid: Pending, In Progress, Resolved
});
const invalidStatusError = invalidStatusComplaint.validateSync();
assert(
  invalidStatusError && invalidStatusError.errors['status'] !== undefined,
  'Invalid status ("Archived") is rejected'
);

// Test 11: Invalid Category
const invalidCategoryComplaint = new Complaint({
  title: 'Power outage on block 4',
  category: 'Alien Invasion', // Valid: Road Damage, Garbage, Water Leakage, Streetlight, Drainage, Other
  status: 'Pending'
});
const invalidCategoryError = invalidCategoryComplaint.validateSync();
assert(
  invalidCategoryError && invalidCategoryError.errors['category'] !== undefined,
  'Invalid category ("Alien Invasion") is rejected'
);

// Test 12: Default Status and ID Generation
const defaultFieldsComplaint = new Complaint({
  title: 'Water pipe leak near school',
  category: 'Water Leakage'
});
assert(defaultFieldsComplaint.status === 'Pending', 'Default status is set to "Pending"');
assert(
  typeof defaultFieldsComplaint.complaintId === 'string' &&
  defaultFieldsComplaint.complaintId.startsWith('CFX-'),
  'Complaint ID automatically generated with "CFX-" prefix'
);

console.log('\n==================================================');
console.log(`Summary: ${passedCount}/${totalCount} tests passed.`);
console.log('==================================================');

if (passedCount === totalCount) {
  process.exit(0);
} else {
  process.exit(1);
}
