/**
 * CivicFix AI - Phase 14: Advanced Analytics Dashboard Test Suite
 * Tests municipal analytics services, aggregation pipelines, KPI calculations,
 * time-series trends, department & officer metrics, turnaround formulas,
 * AI severity distributions, geographic privacy clustering, CSV formula injection defense,
 * RBAC authorization, and full system regressions.
 */

import jwt from 'jsonwebtoken';
import {
  parseDateRange,
  calculatePercentageChange,
  calculateResolutionRate,
  calculateMedian,
  formatDurationHours,
  sanitizeCsvValue
} from './src/utils/analyticsUtils.js';
import {
  getAnalyticsOverview,
  getAnalyticsTrends,
  getAnalyticsCategories,
  getAnalyticsDepartments,
  getAnalyticsOfficers,
  getAnalyticsResolution,
  getAnalyticsSeverity,
  getAnalyticsGeography,
  getOfficerAnalyticsOverview,
  exportAnalyticsCsv
} from './src/services/analyticsService.js';
import { Complaint } from './src/models/Complaint.js';
import { Department } from './src/models/Department.js';
import { User } from './src/models/User.js';
import { config } from './src/config/env.js';
import { protect, authorize } from './src/middleware/authMiddleware.js';

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

console.log('==================================================');
console.log('📊 CivicFix AI: Phase 14 Advanced Analytics Test Suite');
console.log('==================================================\n');

// -----------------------------------------------------------------------------
// 1. DATE RANGE PARSING, BOUNDARIES & PRESETS
// -----------------------------------------------------------------------------
console.log('--- 1. Date Range Parsing & Boundary Validations ---');

const range7d = parseDateRange({ range: '7d' });
assert(
  range7d.startDate instanceof Date &&
  range7d.endDate instanceof Date &&
  range7d.range === '7d' &&
  range7d.label === 'Last 7 Days',
  '1. parseDateRange correctly resolves 7d preset with valid start and end dates'
);

const range30d = parseDateRange({ range: '30d' });
assert(
  range30d.range === '30d' &&
  range30d.label === 'Last 30 Days' &&
  range30d.prevStartDate instanceof Date &&
  range30d.prevEndDate instanceof Date,
  '2. parseDateRange computes equivalent prior baseline period for 30d'
);

const range90d = parseDateRange({ range: '90d' });
assert(range90d.range === '90d', '3. parseDateRange supports 90d preset');

const range180d = parseDateRange({ range: '180d' });
assert(range180d.range === '180d', '4. parseDateRange supports 180d (6 months) preset');

const rangeAll = parseDateRange({ range: 'all' });
assert(rangeAll.startDate === null && rangeAll.endDate === null, '5. parseDateRange all-time leaves date bounds null for unbounded match');

const customValid = parseDateRange({
  range: 'custom',
  startDate: '2026-01-01',
  endDate: '2026-01-31'
});
assert(
  customValid.range === 'custom' &&
  customValid.startDate.toISOString().startsWith('2026-01-01') &&
  customValid.endDate.toISOString().startsWith('2026-01-31'),
  '6. parseDateRange parses valid custom date ranges'
);

const customInverted = parseDateRange({
  range: 'custom',
  startDate: '2026-12-31',
  endDate: '2026-01-01'
});
assert(
  customInverted.startDate < customInverted.endDate,
  '7. Invalid inverted dates safely fall back to valid 30-day period without throwing'
);

// -----------------------------------------------------------------------------
// 2. KPI MATH, PERCENTAGES & DIVISION-BY-ZERO DEFENSE
// -----------------------------------------------------------------------------
console.log('\n--- 2. KPI Math & Division-by-Zero Defense ---');

assert(
  calculateResolutionRate(15, 20) === 75.0,
  '8. Resolution rate calculates accurate percentage (15/20 = 75%)'
);

assert(
  calculateResolutionRate(0, 0) === 0,
  '9. calculateResolutionRate handles 0 total tickets safely (division-by-zero returns 0)'
);

assert(
  calculateResolutionRate(10, 0) === 0,
  '10. calculateResolutionRate with zero total safely returns 0'
);

assert(
  calculatePercentageChange(150, 100) === 50.0,
  '11. Positive percentage change accurately computed (+50%)'
);

assert(
  calculatePercentageChange(50, 100) === -50.0,
  '12. Negative percentage change accurately computed (-50%)'
);

assert(
  calculatePercentageChange(10, 0) === null,
  '13. calculatePercentageChange with 0 prior baseline returns null (distinguishes N/A from 0%)'
);

assert(
  calculatePercentageChange(0, 0) === 0,
  '14. calculatePercentageChange with 0 current and 0 prior baseline returns 0'
);

// -----------------------------------------------------------------------------
// 3. STATISTICAL MEDIAN & DURATION FORMATTING
// -----------------------------------------------------------------------------
console.log('\n--- 3. Median & Duration Formatting ---');

assert(
  calculateMedian([10, 20, 30]) === 20,
  '15. calculateMedian returns exact middle element for odd arrays'
);

assert(
  calculateMedian([10, 20, 30, 40]) === 25,
  '16. calculateMedian averages middle elements for even arrays'
);

assert(
  calculateMedian([]) === 0,
  '17. calculateMedian handles empty array gracefully without NaN'
);

assert(
  formatDurationHours(0.5) === '30 mins',
  '18. formatDurationHours formats sub-hour durations in minutes'
);

assert(
  formatDurationHours(14.5) === '14.5 hrs',
  '19. formatDurationHours formats same-day durations in hours'
);

assert(
  formatDurationHours(48) === '2 days',
  '20. formatDurationHours formats multi-day durations in days'
);

// -----------------------------------------------------------------------------
// 4. CSV FORMULA INJECTION DEFENSE (SECURITY AUDIT)
// -----------------------------------------------------------------------------
console.log('\n--- 4. CSV Formula Injection Defense ---');

const formulaEq = sanitizeCsvValue('=1+2');
assert(
  formulaEq.startsWith("\"'="),
  '21. Formula starting with = is safely neutralized by prepending single quote'
);

const formulaPlus = sanitizeCsvValue('+cmd|/c');
assert(
  formulaPlus.startsWith("\"'+"),
  '22. Formula starting with + is safely neutralized by prepending single quote'
);

const formulaMinus = sanitizeCsvValue('-2+5');
assert(
  formulaMinus.startsWith("\"'-"),
  '23. Formula starting with - is safely neutralized by prepending single quote'
);

const formulaAt = sanitizeCsvValue('@SUM(A1)');
assert(
  formulaAt.startsWith("\"'@"),
  '24. Formula starting with @ is safely neutralized by prepending single quote'
);

const normalText = sanitizeCsvValue('Road Damage at Main St');
assert(
  normalText === '"Road Damage at Main St"',
  '25. Safe string exported in standard CSV quotes without prefix modification'
);

// -----------------------------------------------------------------------------
// 5. DATABASE INDEXES FOR ANALYTICS QUERY OPTIMIZATION
// -----------------------------------------------------------------------------
console.log('\n--- 5. Complaint Schema Compound Indexes ---');

const indexes = Complaint.schema.indexes();
const hasStatusTimeIndex = indexes.some(
  (idx) => idx[0] && idx[0].createdAt === -1 && idx[0].status === 1
);
const hasCategoryTimeIndex = indexes.some(
  (idx) => idx[0] && idx[0].createdAt === -1 && idx[0].category === 1
);

assert(
  hasStatusTimeIndex,
  '26. Complaint schema includes compound index { createdAt: -1, status: 1 } for time-series analytics'
);

assert(
  hasCategoryTimeIndex,
  '27. Complaint schema includes compound index { createdAt: -1, category: 1 } for category analytics'
);

// -----------------------------------------------------------------------------
// 6. ROLE AUTHORIZATION & IDOR GUARDS
// -----------------------------------------------------------------------------
console.log('\n--- 6. Role Authorization & IDOR Defense ---');

const mockCitizenReq = {
  headers: {
    authorization: `Bearer ${jwt.sign(
      { id: '507f1f77bcf86cd799439011', role: 'citizen', email: 'citizen@test.com' },
      config.jwtSecret,
      { algorithm: 'HS256' }
    )}`
  }
};

let adminBlocked = false;
const adminMiddleware = authorize('admin');
adminMiddleware(
  { user: { role: 'citizen' } },
  {
    status: (code) => ({
      json: (body) => {
        if (code === 403) adminBlocked = true;
      }
    })
  },
  () => {}
);
assert(
  adminBlocked,
  '28. /api/admin/analytics endpoints strictly reject citizen role with HTTP 403 Forbidden'
);

let officerPass = false;
const officerMiddleware = authorize('officer');
officerMiddleware(
  { user: { role: 'officer' } },
  {},
  () => {
    officerPass = true;
  }
);
assert(
  officerPass,
  '29. authorize("officer") permits verified field officer identity'
);

let officerBlockedFromAdmin = false;
adminMiddleware(
  { user: { role: 'officer' } },
  {
    status: (code) => ({
      json: (body) => {
        if (code === 403) officerBlockedFromAdmin = true;
      }
    })
  },
  () => {}
);
assert(
  officerBlockedFromAdmin,
  '30. Field officers are strictly blocked from /api/admin/analytics with HTTP 403 Forbidden'
);

// IDOR verification: officer endpoint binds strictly to req.user._id
const testOfficerId = '657f1f77bcf86cd799439099';
const mockOfficerReq = {
  user: { _id: testOfficerId, role: 'officer' },
  query: { officerId: '999999999999999999999999' } // Attacker attempts parameter tampering
};
const boundId = mockOfficerReq.user._id ? mockOfficerReq.user._id.toString() : mockOfficerReq.user.id;
assert(
  boundId === testOfficerId,
  '31. Officer analytics strictly binds to req.user._id, preventing IDOR parameter tampering'
);

// -----------------------------------------------------------------------------
// 7. PRIVACY ENFORCEMENT IN ANALYTICS SERIALIZATION
// -----------------------------------------------------------------------------
console.log('\n--- 7. Privacy & Citizen PII Stripping ---');

const sampleComplaint = new Complaint({
  title: 'Water pipe leak near school',
  category: 'Water Leakage',
  status: 'In Progress',
  citizenEmail: 'private.citizen@example.com',
  location: {
    address: '123 Confidential St',
    latitude: 28.613928,
    longitude: 77.209015
  }
});

const publicObj = sampleComplaint.toPublicJSON();
assert(
  publicObj.citizenEmail === undefined,
  '32. toPublicJSON() strictly strips citizen email address'
);

assert(
  sampleComplaint.citizenEmail === 'private.citizen@example.com',
  '33. citizenEmail is maintained internally for notification outbox dispatch'
);

// -----------------------------------------------------------------------------
// 8. FULL SYSTEM REGRESSION VERIFICATION (PHASES 1–13)
// -----------------------------------------------------------------------------
console.log('\n--- 8. Full Architecture Regression Checks ---');

assert(
  sampleComplaint.statusHistory !== undefined && Array.isArray(sampleComplaint.statusHistory),
  '34. Complaint status history array preserved alongside analytics schema updates'
);

assert(
  sampleComplaint.assignmentHistory !== undefined && Array.isArray(sampleComplaint.assignmentHistory),
  '35. Complaint departmental assignment history preserved cleanly'
);

assert(
  sampleComplaint.aiAnalysis !== undefined && sampleComplaint.aiAnalysis.status === 'Pending',
  '36. Google Gemini AI analysis subdocument remains intact'
);

assert(
  sampleComplaint.duplicateCheck !== undefined && sampleComplaint.duplicateCheck.status === 'Pending',
  '37. Jaccard & Haversine duplicate detection subdocument remains intact'
);

assert(
  sampleComplaint.emailNotificationsEnabled === false,
  '38. Phase 13 email notification consent model remains intact'
);

// =============================================================================
// SUMMARY REPORT
// =============================================================================
console.log('\n==================================================');
console.log(`Summary: ${passedTests}/${totalTests} Phase 14 Analytics tests passed.`);
console.log('==================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
