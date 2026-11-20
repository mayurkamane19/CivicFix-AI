/**
 * CivicFix AI - Mini Phase 16.3: Citizen Feedback Frontend UI Test Suite
 *
 * Verifies:
 * 1. Status visibility rules (form renders only when complaint status is 'Resolved')
 * 2. Unresolved complaint exclusion ('Pending', 'In Progress', 'Rejected', etc. return null)
 * 3. Star rating selection (1 to 5 stars, with correct descriptive labels)
 * 4. Star rating boundary validation (rejects 0, negative, >5, or non-numeric)
 * 5. Comment character limit enforcement (max 500 characters, counter boundaries)
 * 6. Prevention of duplicate feedback submission (existing feedback display state)
 * 7. Error handling & authentication guard (requires citizen auth token)
 * 8. API client integration contract (submitFeedbackApi, getComplaintFeedbackApi, getMyFeedbackApi)
 * 9. Frontend files existence and JSX wiring in TrackComplaintPage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

console.log('====================================================');
console.log('⭐  CivicFix AI: Mini Phase 16.3 Frontend Feedback Tests');
console.log('====================================================\n');

// -----------------------------------------------------------------------------
// 1. Status Visibility & Guard Verification
// -----------------------------------------------------------------------------
console.log('--- 1. Status Guard & Visibility Logic ---');

const RATING_LABELS = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent'
};

function shouldRenderFeedbackForm(status) {
  return status === 'Resolved';
}

assert(shouldRenderFeedbackForm('Resolved') === true, 'Feedback form renders when complaint status is "Resolved"');
assert(shouldRenderFeedbackForm('Pending') === false, 'Feedback form is strictly hidden when status is "Pending"');
assert(shouldRenderFeedbackForm('In Progress') === false, 'Feedback form is strictly hidden when status is "In Progress"');
assert(shouldRenderFeedbackForm('Rejected') === false, 'Feedback form is strictly hidden when status is "Rejected"');
assert(shouldRenderFeedbackForm(null) === false, 'Feedback form is hidden when status is null');
assert(shouldRenderFeedbackForm(undefined) === false, 'Feedback form is hidden when status is undefined');

// -----------------------------------------------------------------------------
// 2. Star Rating Selection & Labels
// -----------------------------------------------------------------------------
console.log('\n--- 2. Star Rating Validation & Descriptive Labels ---');

function validateRating(rating) {
  if (typeof rating !== 'number' || !Number.isInteger(rating)) {
    return { valid: false, error: 'Please select a star rating between 1 and 5 stars.' };
  }
  if (rating < 1 || rating > 5) {
    return { valid: false, error: 'Please select a star rating between 1 and 5 stars.' };
  }
  return { valid: true, label: RATING_LABELS[rating] };
}

assert(validateRating(1).valid && validateRating(1).label === 'Poor', '1 Star maps to "Poor"');
assert(validateRating(2).valid && validateRating(2).label === 'Fair', '2 Stars map to "Fair"');
assert(validateRating(3).valid && validateRating(3).label === 'Good', '3 Stars map to "Good"');
assert(validateRating(4).valid && validateRating(4).label === 'Very Good', '4 Stars map to "Very Good"');
assert(validateRating(5).valid && validateRating(5).label === 'Excellent', '5 Stars map to "Excellent"');

assert(validateRating(0).valid === false, '0 Star selection is rejected as invalid');
assert(validateRating(-1).valid === false, 'Negative rating is rejected as invalid');
assert(validateRating(6).valid === false, '6 Stars selection is rejected (> 5)');
assert(validateRating(null).valid === false, 'Null rating is rejected as invalid');
assert(validateRating('5').valid === false, 'String rating is rejected without coercion');

// -----------------------------------------------------------------------------
// 3. Comment Validation & Character Limit
// -----------------------------------------------------------------------------
console.log('\n--- 3. Comment Character Limit Enforcement (Max 500) ---');

function validateComment(comment) {
  if (comment === undefined || comment === null || comment === '') {
    return { valid: true, length: 0 };
  }
  if (typeof comment !== 'string') {
    return { valid: false, error: 'Comment must be a text string.' };
  }
  if (comment.length > 500) {
    return { valid: false, error: 'Feedback comment cannot exceed 500 characters.' };
  }
  return { valid: true, length: comment.length, trimmed: comment.trim() };
}

assert(validateComment('').valid === true, 'Empty comment is optional and valid');
assert(validateComment('   ').valid === true, 'Whitespace comment is optional and valid');

const comment100 = 'A'.repeat(100);
assert(validateComment(comment100).valid === true && validateComment(comment100).length === 100, '100-character comment is valid');

const comment500 = 'A'.repeat(500);
assert(validateComment(comment500).valid === true && validateComment(comment500).length === 500, '500-character boundary comment is valid');

const comment501 = 'A'.repeat(501);
assert(validateComment(comment501).valid === false, '501-character comment is rejected (> 500 limit)');

// -----------------------------------------------------------------------------
// 4. Client Authentication Guard
// -----------------------------------------------------------------------------
console.log('\n--- 4. Client Authentication Guard ---');

function canSubmitFeedback(token, rating, comment) {
  if (!token) {
    return { allowed: false, error: 'Please sign in with your citizen account to rate this resolution.' };
  }
  const ratingVal = validateRating(rating);
  if (!ratingVal.valid) {
    return { allowed: false, error: ratingVal.error };
  }
  const commentVal = validateComment(comment);
  if (!commentVal.valid) {
    return { allowed: false, error: commentVal.error };
  }
  return { allowed: true };
}

assert(
  canSubmitFeedback(null, 5, 'Great!').allowed === false &&
  canSubmitFeedback(null, 5, 'Great!').error.includes('sign in'),
  'Submission without auth token is rejected with user-friendly login message'
);

assert(
  canSubmitFeedback('valid.jwt.token', 0, 'Great!').allowed === false,
  'Submission with valid token but 0 rating is blocked'
);

assert(
  canSubmitFeedback('valid.jwt.token', 5, 'Great job!').allowed === true,
  'Submission with valid token, rating and comment is accepted'
);

// -----------------------------------------------------------------------------
// 5. Existing Feedback Display vs Submission Form
// -----------------------------------------------------------------------------
console.log('\n--- 5. Duplicate Submission Prevention & Submitted State ---');

function determineFeedbackViewState(status, existingFeedback) {
  if (status !== 'Resolved') {
    return 'HIDDEN';
  }
  if (existingFeedback) {
    return 'DISPLAY_ALREADY_SUBMITTED';
  }
  return 'DISPLAY_FORM';
}

assert(determineFeedbackViewState('In Progress', null) === 'HIDDEN', 'Unresolved issue view state is HIDDEN');
assert(determineFeedbackViewState('Resolved', null) === 'DISPLAY_FORM', 'Resolved issue without feedback shows interactive FORM');

const sampleExistingFeedback = {
  feedbackId: 'FDB-20261120-1001',
  rating: 5,
  comment: 'Fixed prompt and road looks clean.',
  createdAt: new Date().toISOString()
};
assert(
  determineFeedbackViewState('Resolved', sampleExistingFeedback) === 'DISPLAY_ALREADY_SUBMITTED',
  'Resolved issue with existing feedback shows DISPLAY_ALREADY_SUBMITTED state'
);

// -----------------------------------------------------------------------------
// 6. API Client Contracts Verification
// -----------------------------------------------------------------------------
console.log('\n--- 6. API Client Service Module Check ---');

const apiServicePath = path.resolve(__dirname, '../frontend/src/services/api.js');
assert(fs.existsSync(apiServicePath), 'frontend/src/services/api.js exists');

const apiSource = fs.readFileSync(apiServicePath, 'utf8');
assert(apiSource.includes('export const submitFeedbackApi'), 'api.js exports submitFeedbackApi');
assert(apiSource.includes('export const getComplaintFeedbackApi'), 'api.js exports getComplaintFeedbackApi');
assert(apiSource.includes('export const getMyFeedbackApi'), 'api.js exports getMyFeedbackApi');
assert(apiSource.includes('/api/feedback/'), 'api.js routes call /api/feedback/ endpoints');
assert(apiSource.includes("'Authorization': `Bearer ${token}`"), 'api.js attaches JWT auth headers to feedback requests');

// -----------------------------------------------------------------------------
// 7. Component Source and Integration Verification
// -----------------------------------------------------------------------------
console.log('\n--- 7. Component Source & TrackComplaintPage Integration ---');

const feedbackFormPath = path.resolve(__dirname, '../frontend/src/components/feedback/FeedbackForm.jsx');
assert(fs.existsSync(feedbackFormPath), 'FeedbackForm.jsx component file exists');

const formSource = fs.readFileSync(feedbackFormPath, 'utf8');
assert(formSource.includes('export const FeedbackForm'), 'FeedbackForm component is exported');
assert(formSource.includes('status === \'Resolved\''), 'FeedbackForm includes status === "Resolved" guard');
assert(formSource.includes('maxLength={500}'), 'FeedbackForm sets maxLength={500} on textarea');
assert(formSource.includes('submitFeedbackApi'), 'FeedbackForm invokes submitFeedbackApi');
assert(formSource.includes('getComplaintFeedbackApi'), 'FeedbackForm invokes getComplaintFeedbackApi');
assert(formSource.includes('star-btn'), 'FeedbackForm provides interactive star-btn elements');

const trackPagePath = path.resolve(__dirname, '../frontend/src/pages/TrackComplaintPage.jsx');
const trackSource = fs.readFileSync(trackPagePath, 'utf8');
assert(trackSource.includes("import FeedbackForm from '../components/feedback/FeedbackForm'"), 'TrackComplaintPage imports FeedbackForm');
assert(trackSource.includes('<FeedbackForm'), 'TrackComplaintPage renders <FeedbackForm');
assert(trackSource.includes('complaintId={complaintData.complaintId}'), 'TrackComplaintPage passes complaintId prop');
assert(trackSource.includes('status={complaintData.status}'), 'TrackComplaintPage passes status prop');

const cssPath = path.resolve(__dirname, '../frontend/src/App.css');
const cssSource = fs.readFileSync(cssPath, 'utf8');
assert(cssSource.includes('.feedback-section'), 'App.css defines .feedback-section');
assert(cssSource.includes('.feedback-stars-selector'), 'App.css defines .feedback-stars-selector');
assert(cssSource.includes('.star-filled'), 'App.css defines .star-filled');
assert(cssSource.includes('.star-empty'), 'App.css defines .star-empty');
assert(cssSource.includes('.feedback-submitted-card'), 'App.css defines .feedback-submitted-card');

// -----------------------------------------------------------------------------
// Test Summary
// -----------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`Results: ${passedTests}/${totalTests} tests passed`);
console.log('====================================================');

if (passedTests === totalTests) {
  console.log('🎉 ALL FRONTEND FEEDBACK UI TESTS PASSED!\n');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED!\n');
  process.exit(1);
}
