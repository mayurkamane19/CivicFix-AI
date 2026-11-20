/**
 * CivicFix AI - Mini Phase 16.4: Admin Feedback Dashboard Frontend UI Test Suite
 *
 * Verifies:
 * 1. FeedbackManagement.jsx component structure & export
 * 2. KPI Cards rendering (total feedback card, average rating card)
 * 3. Rating distribution rendering (1-5 stars bars, percentages, interactive filters)
 * 4. Filters bar (Complaint ID search, Rating dropdown, Rows per page, Reset)
 * 5. Feedback table structure (columns: Complaint ID, Issue Details, Rating, Comments, Date)
 * 6. Empty state and loading state handling
 * 7. Pagination controls (Previous, Next, page indicator, row counts)
 * 8. Integration into AdminDashboard.jsx (import, navigation tab, content section)
 * 9. API client functions in api.js (getAdminFeedbackApi, getAdminFeedbackStatsApi)
 * 10. CSS styling definitions in App.css
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
console.log('⭐  CivicFix AI: Mini Phase 16.4 Admin Feedback UI Tests');
console.log('====================================================\n');

// -----------------------------------------------------------------------------
// 1. Component File Existence & Exports
// -----------------------------------------------------------------------------
console.log('--- 1. Component File & Module Exports ---');

const compPath = path.resolve(__dirname, '../frontend/src/components/admin/FeedbackManagement.jsx');
assert(fs.existsSync(compPath), '1.1 FeedbackManagement.jsx file exists');

const compSource = fs.readFileSync(compPath, 'utf8');
assert(compSource.includes('export const FeedbackManagement'), '1.2 Named export FeedbackManagement exists');
assert(compSource.includes('export default FeedbackManagement'), '1.3 Default export FeedbackManagement exists');

// -----------------------------------------------------------------------------
// 2. KPI Cards & Metrics Verification
// -----------------------------------------------------------------------------
console.log('\n--- 2. KPI Metrics & Summary Cards ---');

assert(compSource.includes('Total Feedback Received'), '2.1 Contains Total Feedback KPI title');
assert(compSource.includes('stats.totalFeedback'), '2.2 Displays stats.totalFeedback value');
assert(compSource.includes('Average Citizen Rating'), '2.3 Contains Average Citizen Rating KPI title');
assert(compSource.includes('stats.averageRating'), '2.4 Displays stats.averageRating value');
assert(compSource.includes('/ 5.0'), '2.5 Displays "/ 5.0" rating scale indicator');

// -----------------------------------------------------------------------------
// 3. Rating Distribution Breakdown
// -----------------------------------------------------------------------------
console.log('\n--- 3. Rating Distribution Breakdown ---');

assert(compSource.includes('Rating Distribution'), '3.1 Contains Rating Distribution header');
assert(compSource.includes('[5, 4, 3, 2, 1]'), '3.2 Maps across 5 to 1 star levels');
assert(compSource.includes('stats.ratingDistribution'), '3.3 Reads ratingDistribution counts');
assert(compSource.includes('dist-progress-bar'), '3.4 Renders graphical distribution progress bars');
assert(compSource.includes('dist-row-btn'), '3.5 Distribution rows are interactive buttons for quick filtering');

// -----------------------------------------------------------------------------
// 4. Filters & Search Toolbar
// -----------------------------------------------------------------------------
console.log('\n--- 4. Search & Filter Controls ---');

assert(compSource.includes('Search by Complaint ID'), '4.1 Provides Complaint ID search input label');
assert(compSource.includes('handleSearchSubmit'), '4.2 Implements search form submission handler');
assert(compSource.includes('handleResetFilters'), '4.3 Implements filter reset handler');
assert(compSource.includes('Rating Filter'), '4.4 Provides rating filter dropdown');
assert(compSource.includes('All Ratings (1 - 5 Stars)'), '4.5 Rating dropdown includes All Ratings option');
assert(compSource.includes('Rows Per Page'), '4.6 Provides rows per page limit selector');

// -----------------------------------------------------------------------------
// 5. Feedback Records Table
// -----------------------------------------------------------------------------
console.log('\n--- 5. Feedback Table Structure & Data Cells ---');

assert(compSource.includes('Feedback Records'), '5.1 Contains Feedback Records table header');
assert(compSource.includes('Complaint ID'), '5.2 Table contains Complaint ID column');
assert(compSource.includes('Issue Details'), '5.3 Table contains Issue Details column');
assert(compSource.includes('Rating'), '5.4 Table contains Rating column');
assert(compSource.includes('Citizen Comments'), '5.5 Table contains Citizen Comments column');
assert(compSource.includes('Submission Date'), '5.6 Table contains Submission Date column');
assert(compSource.includes('item.complaintId'), '5.7 Renders complaint ticket identifier');
assert(compSource.includes('item.comment'), '5.8 Renders citizen comment text');
assert(compSource.includes('renderStars(item.rating)'), '5.9 Renders accessible star visualization for rating');

// -----------------------------------------------------------------------------
// 6. Loading, Error & Empty States
// -----------------------------------------------------------------------------
console.log('\n--- 6. Loading, Error & Empty States ---');

assert(compSource.includes('feedback-loading-state'), '6.1 Handles records loading spinner state');
assert(compSource.includes('feedback-empty-state'), '6.2 Handles empty feedback registry state');
assert(compSource.includes('No Citizen Feedback Found'), '6.3 Displays clear empty message');
assert(compSource.includes('statsError'), '6.4 Displays stats loading error banner');
assert(compSource.includes('recordsError'), '6.5 Displays records loading error banner');

// -----------------------------------------------------------------------------
// 7. Pagination Controls
// -----------------------------------------------------------------------------
console.log('\n--- 7. Pagination Logic & Controls ---');

assert(compSource.includes('feedback-pagination-bar'), '7.1 Includes pagination footer container');
assert(compSource.includes('pagination.hasPrevPage'), '7.2 Checks hasPrevPage for Previous button state');
assert(compSource.includes('pagination.hasNextPage'), '7.3 Checks hasNextPage for Next button state');
assert(compSource.includes('Page {pagination.page} of {pagination.totalPages}'), '7.4 Displays page counter');
assert(compSource.includes('pagination.total'), '7.5 Displays total record count');

// -----------------------------------------------------------------------------
// 8. AdminDashboard.jsx Integration
// -----------------------------------------------------------------------------
console.log('\n--- 8. AdminDashboard.jsx Integration ---');

const adminDashPath = path.resolve(__dirname, '../frontend/src/pages/AdminDashboard.jsx');
const adminDashSource = fs.readFileSync(adminDashPath, 'utf8');

assert(
  adminDashSource.includes("import FeedbackManagement from '../components/admin/FeedbackManagement'"),
  '8.1 AdminDashboard.jsx imports FeedbackManagement component'
);
assert(
  adminDashSource.includes("activeTab === 'feedback'"),
  '8.2 AdminDashboard.jsx manages activeTab === "feedback"'
);
assert(
  adminDashSource.includes('⭐ Citizen Feedback'),
  '8.3 AdminDashboard.jsx includes Citizen Feedback navigation tab button'
);
assert(
  adminDashSource.includes('<FeedbackManagement />') || adminDashSource.includes('<FeedbackManagement'),
  '8.4 AdminDashboard.jsx renders <FeedbackManagement /> in main container'
);

// -----------------------------------------------------------------------------
// 9. API Client Methods in api.js
// -----------------------------------------------------------------------------
console.log('\n--- 9. Frontend API Client Methods ---');

const apiPath = path.resolve(__dirname, '../frontend/src/services/api.js');
const apiSource = fs.readFileSync(apiPath, 'utf8');

assert(apiSource.includes('export const getAdminFeedbackApi'), '9.1 api.js exports getAdminFeedbackApi');
assert(apiSource.includes('export const getAdminFeedbackStatsApi'), '9.2 api.js exports getAdminFeedbackStatsApi');
assert(apiSource.includes('/api/admin/feedback'), '9.3 api.js calls /api/admin/feedback endpoint');
assert(apiSource.includes('/api/admin/feedback/stats'), '9.4 api.js calls /api/admin/feedback/stats endpoint');
assert(apiSource.includes('getAdminFeedbackApi,'), '9.5 default export includes getAdminFeedbackApi');
assert(apiSource.includes('getAdminFeedbackStatsApi,'), '9.6 default export includes getAdminFeedbackStatsApi');

// -----------------------------------------------------------------------------
// 10. CSS Definitions in App.css
// -----------------------------------------------------------------------------
console.log('\n--- 10. CSS Styles in App.css ---');

const cssPath = path.resolve(__dirname, '../frontend/src/App.css');
const cssSource = fs.readFileSync(cssPath, 'utf8');

assert(cssSource.includes('.feedback-management-container'), '10.1 App.css defines .feedback-management-container');
assert(cssSource.includes('.feedback-kpi-grid'), '10.2 App.css defines .feedback-kpi-grid');
assert(cssSource.includes('.feedback-kpi-card'), '10.3 App.css defines .feedback-kpi-card');
assert(cssSource.includes('.feedback-distribution-card'), '10.4 App.css defines .feedback-distribution-card');
assert(cssSource.includes('.dist-progress-bar'), '10.5 App.css defines .dist-progress-bar');
assert(cssSource.includes('.feedback-table'), '10.6 App.css defines .feedback-table');
assert(cssSource.includes('.feedback-pagination-bar'), '10.7 App.css defines .feedback-pagination-bar');

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`Results: ${passedTests}/${totalTests} UI tests passed`);
console.log('====================================================');

if (passedTests === totalTests) {
  console.log('🎉 ALL ADMIN FEEDBACK FRONTEND UI TESTS PASSED!\n');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED!\n');
  process.exit(1);
}
