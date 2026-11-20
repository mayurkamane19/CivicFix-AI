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
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}:`, err.message);
    failed++;
  }
};

console.log('\n=== CivicFix AI – Phase 19: UI & Component Integration Tests ===\n');

const frontendRoot = fs.existsSync(path.resolve(__dirname, '..', 'frontend'))
  ? path.resolve(__dirname, '..', 'frontend')
  : path.resolve('frontend');

// 1. Frontend API Client Tests
runTest('api.js exports all Phase 19 resolution and workspace endpoints', () => {
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

// 2. ResolutionVerificationCard Component Tests
runTest('ResolutionVerificationCard.jsx implements citizen verification and contest workflow', () => {
  const cardFile = fs.readFileSync(
    path.join(frontendRoot, 'src', 'components', 'resolution', 'ResolutionVerificationCard.jsx'),
    'utf8'
  );

  assert.ok(cardFile.includes('verifyResolutionApi'), 'should call verifyResolutionApi');
  assert.ok(cardFile.includes('rejectResolutionApi'), 'should call rejectResolutionApi');
  assert.ok(cardFile.includes('badge-verified'), 'should render verified badge');
  assert.ok(cardFile.includes('badge-awaiting'), 'should render awaiting badge');
  assert.ok(cardFile.includes('badge-rejected'), 'should render rejected badge');
  assert.ok(cardFile.includes('badge-admin-review'), 'should render admin review badge');
  assert.ok(cardFile.includes('photo-comparison-grid'), 'should render comparison grid');
  assert.ok(cardFile.includes('rejectionReason'), 'should include rejection reason textarea');
  assert.ok(cardFile.includes('rejectionPhotos'), 'should support optional rebuttal photos');
  assert.ok(cardFile.includes('reopen-history-section'), 'should display reopen history timeline');
  assert.ok(cardFile.includes('lightboxImage'), 'should support lightbox image preview');
});

// 3. OfficerResolutionModal Component Tests
runTest('OfficerResolutionModal.jsx implements photographic evidence upload and remarks', () => {
  const modalFile = fs.readFileSync(
    path.join(frontendRoot, 'src', 'components', 'resolution', 'OfficerResolutionModal.jsx'),
    'utf8'
  );

  assert.ok(modalFile.includes('submitOfficerResolutionApi'), 'should call submitOfficerResolutionApi');
  assert.ok(modalFile.includes('officerRemarks'), 'should require officer remarks');
  assert.ok(modalFile.includes('afterPhotos'), 'should include after photos input');
  assert.ok(modalFile.includes('beforePhotos'), 'should include before photos input');
  assert.ok(modalFile.includes('btn-remove-thumb'), 'should allow removing thumbnail previews');
  assert.ok(modalFile.includes('photoCaption'), 'should support photo caption');
});

// 4. AdminResolutionReviewTab Component Tests
runTest('AdminResolutionReviewTab.jsx implements resolution oversight and dispute arbitration', () => {
  const adminTabFile = fs.readFileSync(
    path.join(frontendRoot, 'src', 'components', 'resolution', 'AdminResolutionReviewTab.jsx'),
    'utf8'
  );

  assert.ok(adminTabFile.includes('getAdminResolutionsApi'), 'should fetch resolutions list');
  assert.ok(adminTabFile.includes('getAdminResolutionStatsApi'), 'should fetch resolution stats');
  assert.ok(adminTabFile.includes('reviewAdminResolutionApi'), 'should process admin arbitration reviews');
  assert.ok(adminTabFile.includes('disputedOnly'), 'should support disputedOnly filter');
  assert.ok(adminTabFile.includes('APPROVE_RESOLUTION'), 'should offer APPROVE_RESOLUTION action');
  assert.ok(adminTabFile.includes('REOPEN_COMPLAINT'), 'should offer REOPEN_COMPLAINT action');
  assert.ok(adminTabFile.includes('OVERRIDE_RESOLUTION'), 'should offer OVERRIDE_RESOLUTION action');
  assert.ok(adminTabFile.includes('REASSIGN'), 'should offer REASSIGN action');
});

// 5. OfficerDashboard.jsx Integration Tests
runTest('OfficerDashboard.jsx integrates workspace metrics, priority queue, and resolution modal', () => {
  const dashFile = fs.readFileSync(path.join(frontendRoot, 'src', 'pages', 'OfficerDashboard.jsx'), 'utf8');

  assert.ok(dashFile.includes('OfficerResolutionModal'), 'should import OfficerResolutionModal');
  assert.ok(dashFile.includes('getOfficerWorkspaceApi'), 'should invoke getOfficerWorkspaceApi');
  assert.ok(dashFile.includes('resolutionModalOpen'), 'should track resolution modal state');
  assert.ok(dashFile.includes('badge-reopened'), 'getStatusBadge should support Reopened status');
  assert.ok(dashFile.includes('Submit Resolution Evidence'), 'detail modal should include resolution submit button');
});

// 6. TrackComplaintPage.jsx Integration Tests
runTest('TrackComplaintPage.jsx integrates ResolutionVerificationCard', () => {
  const trackFile = fs.readFileSync(path.join(frontendRoot, 'src', 'pages', 'TrackComplaintPage.jsx'), 'utf8');

  assert.ok(trackFile.includes('ResolutionVerificationCard'), 'should import and render ResolutionVerificationCard');
  assert.ok(trackFile.includes('<ResolutionVerificationCard'), 'should mount ResolutionVerificationCard component');
});

// 7. AdminDashboard.jsx Integration Tests
runTest('AdminDashboard.jsx integrates AdminResolutionReviewTab', () => {
  const adminDashFile = fs.readFileSync(path.join(frontendRoot, 'src', 'pages', 'AdminDashboard.jsx'), 'utf8');

  assert.ok(adminDashFile.includes('AdminResolutionReviewTab'), 'should import AdminResolutionReviewTab');
  assert.ok(adminDashFile.includes("activeTab === 'resolutions'"), 'should include resolutions tab toggle');
  assert.ok(adminDashFile.includes('<AdminResolutionReviewTab'), 'should mount AdminResolutionReviewTab component');
});

// 8. OfficerAnalytics.jsx Integration Tests
runTest('OfficerAnalytics.jsx displays citizen verification quality column', () => {
  const offAnalyticsFile = fs.readFileSync(
    path.join(frontendRoot, 'src', 'components', 'analytics', 'OfficerAnalytics.jsx'),
    'utf8'
  );

  assert.ok(offAnalyticsFile.includes('Citizen Verified'), 'should include Citizen Verified column header');
  assert.ok(offAnalyticsFile.includes('verificationRate'), 'should display officer verificationRate');
});

// 9. CSS Verification
runTest('App.css contains all Phase 19 resolution, comparison grid, and modal classes', () => {
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

console.log(`\n======================================================`);
console.log(`Phase 19 UI Tests Completed: ${passed} passed, ${failed} failed`);
console.log(`======================================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
