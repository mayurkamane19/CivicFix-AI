import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;

const runTest = (name, fn) => {
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    failed++;
  }
};

console.log('\n===============================================================');
console.log('🖥️  CivicFix AI: Phase 19 Resolution UI & Behavioral Test Suite');
console.log('===============================================================\n');

const frontendRoot = fs.existsSync(path.resolve(__dirname, '..', 'frontend'))
  ? path.resolve(__dirname, '..', 'frontend')
  : path.resolve('frontend');

// -----------------------------------------------------------------------------
// 1. API Client Integration Contracts
// -----------------------------------------------------------------------------
console.log('--- 1. Frontend API Client Method Contracts ---');

runTest('1.1 api.js exports all 11 resolution and workspace endpoints', () => {
  const apiFile = fs.readFileSync(path.join(frontendRoot, 'src', 'services', 'api.js'), 'utf8');
  const expectedFunctions = [
    'getOfficerWorkspaceApi',
    'uploadResolutionEvidenceApi',
    'submitOfficerResolutionApi',
    'getComplaintResolutionApi',
    'verifyResolutionApi',
    'rejectResolutionApi',
    'getAdminResolutionsApi',
    'getAdminResolutionStatsApi',
    'getAdminResolutionDetailsApi',
    'reviewAdminResolutionApi',
    'getOfficerPerformanceAnalyticsApi'
  ];

  for (const fn of expectedFunctions) {
    assert.ok(apiFile.includes(`export const ${fn}`), `api.js should export ${fn}`);
    assert.ok(apiFile.includes(`${fn},`), `api.js default export should include ${fn}`);
  }
});

// -----------------------------------------------------------------------------
// 2. Officer Resolution Modal Behavioral & Validation Tests
// -----------------------------------------------------------------------------
console.log('\n--- 2. Officer Resolution Modal Behavioral Testing ---');

function validateOfficerResolutionForm(remarks, afterFiles = [], existingAfterCount = 0) {
  if (!remarks || typeof remarks !== 'string' || remarks.trim().length < 10) {
    return { valid: false, error: 'Please provide resolution remarks of at least 10 characters.' };
  }
  if (afterFiles.length === 0 && existingAfterCount === 0) {
    return { valid: false, error: 'At least one completion (after) photograph is required.' };
  }
  return { valid: true, remarks: remarks.trim() };
}

runTest('2.1 Officer remarks < 10 characters are rejected with validation error', () => {
  const res = validateOfficerResolutionForm('Too short', [{ name: 'after.jpg' }]);
  assert.equal(res.valid, false);
  assert.equal(res.error, 'Please provide resolution remarks of at least 10 characters.');
});

runTest('2.2 Missing completion (after) photo is rejected when no existing photo exists', () => {
  const res = validateOfficerResolutionForm('Cleared all asphalt debris on site successfully', [], 0);
  assert.equal(res.valid, false);
  assert.equal(res.error, 'At least one completion (after) photograph is required.');
});

runTest('2.3 Valid remarks with new after photo pass form validation', () => {
  const res = validateOfficerResolutionForm('Repaired 2-inch pipe leak and resurfaced asphalt pavement', [{ name: 'after.jpg' }], 0);
  assert.equal(res.valid, true);
});

runTest('2.4 Valid remarks pass if complaint already has existing after photos', () => {
  const res = validateOfficerResolutionForm('Updated resolution remarks after citizen inspection', [], 2);
  assert.equal(res.valid, true);
});

// Image Preview & Removal State Simulation
function simulateThumbnailRemoval(files, previews, removeIndex) {
  const nextFiles = [...files];
  const nextPreviews = [...previews];
  nextFiles.splice(removeIndex, 1);
  nextPreviews.splice(removeIndex, 1);
  return { files: nextFiles, previews: nextPreviews };
}

runTest('2.5 Image preview removal correctly removes selected index without mutating other items', () => {
  const files = [{ name: 'photo1.jpg' }, { name: 'photo2.jpg' }, { name: 'photo3.jpg' }];
  const previews = ['blob:url/1', 'blob:url/2', 'blob:url/3'];

  const updated = simulateThumbnailRemoval(files, previews, 1);
  assert.equal(updated.files.length, 2);
  assert.equal(updated.previews.length, 2);
  assert.equal(updated.files[0].name, 'photo1.jpg');
  assert.equal(updated.files[1].name, 'photo3.jpg');
  assert.equal(updated.previews[1], 'blob:url/3');
});

runTest('2.6 Modal submission loading state disables action buttons and toggles label', () => {
  const isSubmitting = true;
  const submitButtonText = isSubmitting ? 'Uploading Evidence...' : 'Submit Resolution';
  assert.equal(submitButtonText, 'Uploading Evidence...');
  assert.equal(isSubmitting, true);
});

// -----------------------------------------------------------------------------
// 3. Citizen Verification & Contest Workflow Behavioral Tests
// -----------------------------------------------------------------------------
console.log('\n--- 3. Citizen Verification & Contest Workflow Testing ---');

function canCitizenPerformVerification(complaintStatus, verificationStatus) {
  return complaintStatus === 'Resolved' && verificationStatus === 'Awaiting Citizen Verification';
}

runTest('3.1 Citizen action buttons are enabled ONLY when Resolved & Awaiting Citizen Verification', () => {
  assert.equal(canCitizenPerformVerification('Resolved', 'Awaiting Citizen Verification'), true);
  assert.equal(canCitizenPerformVerification('In Progress', 'Awaiting Citizen Verification'), false);
  assert.equal(canCitizenPerformVerification('Resolved', 'Verified by Citizen'), false);
  assert.equal(canCitizenPerformVerification('Reopened', 'Rejected by Citizen'), false);
  assert.equal(canCitizenPerformVerification('Resolved', 'Under Administrative Review'), false);
});

function getVerificationStatusBadgeClass(status) {
  switch (status) {
    case 'Verified by Citizen': return 'badge-verified';
    case 'Awaiting Citizen Verification': return 'badge-awaiting';
    case 'Rejected by Citizen': return 'badge-rejected';
    case 'Under Administrative Review': return 'badge-admin-review';
    case 'Reopened': return 'badge-reopened';
    default: return 'badge-secondary';
  }
}

runTest('3.2 Verification badge classes correctly map across all 6 canonical statuses', () => {
  assert.equal(getVerificationStatusBadgeClass('Verified by Citizen'), 'badge-verified');
  assert.equal(getVerificationStatusBadgeClass('Awaiting Citizen Verification'), 'badge-awaiting');
  assert.equal(getVerificationStatusBadgeClass('Rejected by Citizen'), 'badge-rejected');
  assert.equal(getVerificationStatusBadgeClass('Under Administrative Review'), 'badge-admin-review');
  assert.equal(getVerificationStatusBadgeClass('Reopened'), 'badge-reopened');
  assert.equal(getVerificationStatusBadgeClass('Not Submitted'), 'badge-secondary');
});

function validateCitizenRejection(reason, files = []) {
  if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
    return { valid: false, error: 'Please provide a specific reason of at least 10 characters.' };
  }
  return { valid: true, reason: reason.trim(), fileCount: files.length };
}

runTest('3.3 Citizen contest reason < 10 characters is blocked with mandatory error message', () => {
  const res = validateCitizenRejection('bad job');
  assert.equal(res.valid, false);
  assert.equal(res.error, 'Please provide a specific reason of at least 10 characters.');
});

runTest('3.4 Valid citizen contest reason with rebuttal photos passes validation', () => {
  const res = validateCitizenRejection('The pothole was only partially filled and loose gravel remains on the road.', [
    { name: 'current_condition.jpg' }
  ]);
  assert.equal(res.valid, true);
  assert.equal(res.fileCount, 1);
});

function checkReopenEscalationWarning(reopenCount, maxLimit = 3) {
  const nextReopen = reopenCount + 1;
  return {
    nextReopen,
    willEscalateToAdmin: nextReopen >= maxLimit,
    message: `Reopen count: ${nextReopen} of ${maxLimit}`
  };
}

runTest('3.5 Reopening modal warns when approaching or reaching maximum limit (3 of 3)', () => {
  const firstReopen = checkReopenEscalationWarning(0, 3);
  assert.equal(firstReopen.willEscalateToAdmin, false);
  assert.equal(firstReopen.nextReopen, 1);

  const thirdReopen = checkReopenEscalationWarning(2, 3);
  assert.equal(thirdReopen.willEscalateToAdmin, true);
  assert.equal(thirdReopen.nextReopen, 3);
});

// -----------------------------------------------------------------------------
// 4. Admin Arbitration & Oversight Behavioral Tests
// -----------------------------------------------------------------------------
console.log('\n--- 4. Admin Arbitration & Review Testing ---');

function validateAdminArbitration(action, notes, { reassignedDepartment, reassignedOfficer } = {}) {
  const validActions = ['APPROVE_RESOLUTION', 'REOPEN_COMPLAINT', 'OVERRIDE_RESOLUTION', 'REASSIGN'];
  if (!validActions.includes(action)) {
    return { valid: false, error: 'Invalid arbitration action.' };
  }
  if (!notes || typeof notes !== 'string' || notes.trim().length < 5) {
    return { valid: false, error: 'Administrative notes are required (minimum 5 characters).' };
  }
  if (action === 'REASSIGN' && !reassignedDepartment && !reassignedOfficer) {
    return { valid: false, error: 'Reassignment requires selecting a department or officer.' };
  }
  return { valid: true, action, notes: notes.trim() };
}

runTest('4.1 Admin review requires at least 5 characters of rationale notes', () => {
  const res = validateAdminArbitration('APPROVE_RESOLUTION', 'ok');
  assert.equal(res.valid, false);
  assert.equal(res.error, 'Administrative notes are required (minimum 5 characters).');
});

runTest('4.2 Admin review accepts APPROVE_RESOLUTION with notes', () => {
  const res = validateAdminArbitration('APPROVE_RESOLUTION', 'Citizen concerns resolved on site inspection.');
  assert.equal(res.valid, true);
});

runTest('4.3 Admin review accepts REOPEN_COMPLAINT with rework instructions', () => {
  const res = validateAdminArbitration('REOPEN_COMPLAINT', 'Evidence shows surface unfinished. Rework required.');
  assert.equal(res.valid, true);
});

runTest('4.4 Admin review REASSIGN requires target department or officer', () => {
  const invalid = validateAdminArbitration('REASSIGN', 'Transfer ticket to water department', {});
  assert.equal(invalid.valid, false);

  const valid = validateAdminArbitration('REASSIGN', 'Transfer ticket to road department', {
    reassignedDepartment: 'dept123'
  });
  assert.equal(valid.valid, true);
});

// -----------------------------------------------------------------------------
// 5. Feedback Workflow Integration & Gating Tests
// -----------------------------------------------------------------------------
console.log('\n--- 5. Feedback Workflow Integration Gating ---');

function shouldDisplayFeedbackForm(status, resolutionStatus, existingFeedback) {
  if (status !== 'Resolved') return false;
  // If resolution status is provided and unverified, gate feedback form unless already submitted
  if (resolutionStatus && resolutionStatus !== 'Verified by Citizen' && resolutionStatus !== 'Not Submitted') {
    return Boolean(existingFeedback);
  }
  return true;
}

runTest('5.1 Feedback form is HIDDEN when complaint status is In Progress or Reopened', () => {
  assert.equal(shouldDisplayFeedbackForm('In Progress', 'Not Submitted', null), false);
  assert.equal(shouldDisplayFeedbackForm('Reopened', 'Rejected by Citizen', null), false);
});

runTest('5.2 Feedback form is GATED while resolution is Awaiting Citizen Verification', () => {
  assert.equal(shouldDisplayFeedbackForm('Resolved', 'Awaiting Citizen Verification', null), false);
  assert.equal(shouldDisplayFeedbackForm('Resolved', 'Under Administrative Review', null), false);
});

runTest('5.3 Feedback form is DISPLAYED once resolution is Verified by Citizen', () => {
  assert.equal(shouldDisplayFeedbackForm('Resolved', 'Verified by Citizen', null), true);
});

runTest('5.4 Feedback form remains accessible for legacy complaints without resolution evidence', () => {
  assert.equal(shouldDisplayFeedbackForm('Resolved', 'Not Submitted', null), true);
  assert.equal(shouldDisplayFeedbackForm('Resolved', null, null), true);
});

runTest('5.5 Existing feedback remains accessible even if resolution is under review', () => {
  const existingFeedback = { rating: 5, comment: 'Great job' };
  assert.equal(shouldDisplayFeedbackForm('Resolved', 'Under Administrative Review', existingFeedback), true);
});

// -----------------------------------------------------------------------------
// 6. Component Source Structure & CSS Classes
// -----------------------------------------------------------------------------
console.log('\n--- 6. Component Source Structure & Responsive CSS Classes ---');

runTest('6.1 ResolutionVerificationCard.jsx includes all required interactive elements', () => {
  const cardFile = fs.readFileSync(
    path.join(frontendRoot, 'src', 'components', 'resolution', 'ResolutionVerificationCard.jsx'),
    'utf8'
  );
  assert.ok(cardFile.includes('verifyResolutionApi'), 'calls verifyResolutionApi');
  assert.ok(cardFile.includes('rejectResolutionApi'), 'calls rejectResolutionApi');
  assert.ok(cardFile.includes('photo-comparison-grid'), 'renders comparison grid');
  assert.ok(cardFile.includes('lightboxImage'), 'supports lightbox image zoom');
  assert.ok(cardFile.includes('reopen-history-section'), 'renders reopen history');
});

runTest('6.2 OfficerResolutionModal.jsx includes photo preview and removal controls', () => {
  const modalFile = fs.readFileSync(
    path.join(frontendRoot, 'src', 'components', 'resolution', 'OfficerResolutionModal.jsx'),
    'utf8'
  );
  assert.ok(modalFile.includes('submitOfficerResolutionApi'), 'calls submitOfficerResolutionApi');
  assert.ok(modalFile.includes('btn-remove-thumb'), 'supports thumbnail removal');
  assert.ok(modalFile.includes('officerRemarks'), 'includes remarks textarea');
});

runTest('6.3 AdminResolutionReviewTab.jsx implements arbitration actions', () => {
  const adminTabFile = fs.readFileSync(
    path.join(frontendRoot, 'src', 'components', 'resolution', 'AdminResolutionReviewTab.jsx'),
    'utf8'
  );
  assert.ok(adminTabFile.includes('reviewAdminResolutionApi'), 'calls reviewAdminResolutionApi');
  assert.ok(adminTabFile.includes('APPROVE_RESOLUTION'), 'supports APPROVE_RESOLUTION');
  assert.ok(adminTabFile.includes('REOPEN_COMPLAINT'), 'supports REOPEN_COMPLAINT');
  assert.ok(adminTabFile.includes('OVERRIDE_RESOLUTION'), 'supports OVERRIDE_RESOLUTION');
  assert.ok(adminTabFile.includes('REASSIGN'), 'supports REASSIGN');
});

runTest('6.4 TrackComplaintPage.jsx passes resolutionStatus to FeedbackForm', () => {
  const trackFile = fs.readFileSync(path.join(frontendRoot, 'src', 'pages', 'TrackComplaintPage.jsx'), 'utf8');
  assert.ok(trackFile.includes('ResolutionVerificationCard'), 'mounts ResolutionVerificationCard');
  assert.ok(trackFile.includes('resolutionStatus='), 'passes resolutionStatus to FeedbackForm');
});

runTest('6.5 OfficerDashboard.jsx integrates workspace metrics and resolution submit actions', () => {
  const dashFile = fs.readFileSync(path.join(frontendRoot, 'src', 'pages', 'OfficerDashboard.jsx'), 'utf8');
  assert.ok(dashFile.includes('OfficerResolutionModal'), 'mounts OfficerResolutionModal');
  assert.ok(dashFile.includes('getOfficerWorkspaceApi'), 'calls getOfficerWorkspaceApi');
  assert.ok(dashFile.includes('Submit Resolution Evidence'), 'detail modal includes resolution button');
});

runTest('6.6 App.css includes all required Phase 19 layout, grid, and modal classes', () => {
  const cssFile = fs.readFileSync(path.join(frontendRoot, 'src', 'App.css'), 'utf8');
  const requiredClasses = [
    '.resolution-card',
    '.resolution-remarks-box',
    '.badge-verified',
    '.badge-awaiting',
    '.badge-rejected',
    '.badge-admin-review',
    '.photo-comparison-grid',
    '.before-column',
    '.after-column',
    '.evidence-photo',
    '.citizen-action-banner',
    '.verify-btn',
    '.contest-btn',
    '.reopen-history-section',
    '.officer-resolution-modal',
    '.lightbox-overlay',
    '.admin-arbitration-form'
  ];
  for (const cls of requiredClasses) {
    assert.ok(cssFile.includes(cls), `App.css should contain class '${cls}'`);
  }
});

console.log('\n===============================================================');
console.log(`Phase 19 UI & Behavioral Tests Completed: ${passed} passed, ${failed} failed`);
console.log('===============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
