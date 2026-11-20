/**
 * CivicFix AI - Phase 17: Smart Complaint Escalation & SLA Management Frontend UI Test Suite
 *
 * Verifies:
 * 1. SlaManagement.jsx component existence, structure, and exports
 * 2. KPI Summary Cards rendering (Active Monitored, Approaching Deadline, Overdue, Escalated, Compliance Rate)
 * 3. Sub-tab navigation (Overdue Queue, SLA Config Editor, Escalation Audit Logs)
 * 4. Overdue Queue table columns and badges
 * 5. Manual Escalation modal elements and confirmation controls
 * 6. SLA Configuration Editor form inputs and threshold sliders/fields
 * 7. AdminDashboard integration (tab navigation, icon, component rendering)
 * 8. OfficerDashboard SLA alert banner, assigned table SLA column, and modal details
 * 9. TrackComplaintPage citizen-safe SLA target resolution card and deadline indicator
 * 10. Data leakage prevention: strict exclusion of internal escalation levels from citizen view
 * 11. API client functions for all SLA endpoints in frontend/src/services/api.js
 * 12. App.css styles for SLA KPI cards, status pills, and escalation badges
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

console.log('======================================================================');
console.log('🎨  CivicFix AI: Phase 17 SLA & Escalation UI Test Suite');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// 1. SlaManagement Component File & Exports
// -----------------------------------------------------------------------------
console.log('--- 1. SlaManagement Component File & Module Exports ---');

const slaCompPath = path.resolve(__dirname, '../frontend/src/components/admin/SlaManagement.jsx');
assert(fs.existsSync(slaCompPath), '1.1 SlaManagement.jsx file exists');

const slaSource = fs.readFileSync(slaCompPath, 'utf8');
assert(slaSource.includes('export const SlaManagement'), '1.2 Named export SlaManagement exists');
assert(slaSource.includes('export default SlaManagement'), '1.3 Default export SlaManagement exists');

// -----------------------------------------------------------------------------
// 2. KPI Cards & Metrics Verification
// -----------------------------------------------------------------------------
console.log('\n--- 2. KPI Summary Cards & Metrics ---');

assert(slaSource.includes('Active SLA Tickets'), '2.1 Contains "Active SLA Tickets" KPI title');
assert(slaSource.includes('Approaching Deadline'), '2.2 Contains "Approaching Deadline" KPI title');
assert(slaSource.includes('Overdue Tickets'), '2.3 Contains "Overdue Tickets" KPI title');
assert(slaSource.includes('Escalated Tickets'), '2.4 Contains "Escalated Tickets" KPI title');
assert(slaSource.includes('SLA Compliance Rate'), '2.5 Contains "SLA Compliance Rate" KPI title');
assert(slaSource.includes('sla-kpi-grid'), '2.6 Uses sla-kpi-grid responsive layout container');

// -----------------------------------------------------------------------------
// 3. Sub-tabs Navigation
// -----------------------------------------------------------------------------
console.log('\n--- 3. Sub-tabs Navigation ---');

assert(slaSource.includes('activeSubTab === \'overview\''), '3.1 Supports Overdue & Approaching Queue sub-tab');
assert(slaSource.includes('activeSubTab === \'config\''), '3.2 Supports SLA Policy Config sub-tab');
assert(slaSource.includes('activeSubTab === \'escalations\''), '3.3 Supports Escalation Audit Logs sub-tab');
assert(slaSource.includes('sla-subtabs-nav'), '3.4 Contains sub-tabs navigation container');

// -----------------------------------------------------------------------------
// 4. Overdue Queue Table Columns
// -----------------------------------------------------------------------------
console.log('\n--- 4. Overdue Queue Table Columns & Actions ---');

assert(slaSource.includes('Ticket ID'), '4.1 Table header includes Ticket ID');
assert(slaSource.includes('Issue Title'), '4.2 Table header includes Issue Title');
assert(slaSource.includes('Priority'), '4.3 Table header includes Priority');
assert(slaSource.includes('Department'), '4.4 Table header includes Department');
assert(slaSource.includes('SLA Status'), '4.5 Table header includes SLA Status');
assert(slaSource.includes('Overdue / Remaining'), '4.6 Table header includes Overdue / Remaining progress');
assert(slaSource.includes('Escalation Level'), '4.7 Table header includes Escalation Level');
assert(slaSource.includes('Actions'), '4.8 Table header includes Actions');
assert(slaSource.includes('setManualModalOpen'), '4.9 Contains manual escalation trigger control');

// -----------------------------------------------------------------------------
// 5. Manual Escalation Modal
// -----------------------------------------------------------------------------
console.log('\n--- 5. Manual Escalation Modal ---');

assert(slaSource.includes('manualModalOpen'), '5.1 Contains manual escalation modal state and trigger');
assert(slaSource.includes('Manual Complaint Escalation'), '5.2 Modal title explains manual escalation');
assert(slaSource.includes('Mandatory Justification / Reason'), '5.3 Requires justification reason text');
assert(slaSource.includes('handleManualEscalate'), '5.4 Implements handleManualEscalate handler');
assert(slaSource.includes('Confirm Escalation'), '5.5 Contains Confirm Escalation submission button');

// -----------------------------------------------------------------------------
// 6. SLA Configuration Editor
// -----------------------------------------------------------------------------
console.log('\n--- 6. SLA Configuration Editor Inputs ---');

assert(slaSource.includes('Resolution Deadline Targets (Hours)'), '6.1 Contains Resolution Targets header');
assert(slaSource.includes('Critical Priority'), '6.2 Configures Critical Priority');
assert(slaSource.includes('High Priority'), '6.3 Configures High Priority');
assert(slaSource.includes('Medium Priority'), '6.4 Configures Medium Priority');
assert(slaSource.includes('Low Priority'), '6.5 Configures Low Priority');
assert(slaSource.includes('Automated Escalation Thresholds'), '6.6 Contains Automated Escalation Thresholds');
assert(slaSource.includes('Level 1: Warning Trigger'), '6.7 Configures Level 1 Warning');
assert(slaSource.includes('Level 2: Breach Trigger'), '6.8 Configures Level 2 Breach');
assert(slaSource.includes('Level 3: Critical Breach'), '6.9 Configures Level 3 Critical');
assert(slaSource.includes('Save SLA Targets'), '6.10 Contains save configuration button');

// -----------------------------------------------------------------------------
// 7. AdminDashboard Integration
// -----------------------------------------------------------------------------
console.log('\n--- 7. AdminDashboard Integration ---');

const adminDashPath = path.resolve(__dirname, '../frontend/src/pages/AdminDashboard.jsx');
assert(fs.existsSync(adminDashPath), '7.1 AdminDashboard.jsx exists');

const adminDashSource = fs.readFileSync(adminDashPath, 'utf8');
assert(adminDashSource.includes('SlaManagement'), '7.2 AdminDashboard imports SlaManagement component');
assert(adminDashSource.includes('activeTab === \'sla\''), '7.3 AdminDashboard has activeTab === "sla" branch');
assert(adminDashSource.includes('SLA & Escalations') || adminDashSource.includes('SLA &amp; Escalations'), '7.4 AdminDashboard has SLA & Escalations navigation tab');

// -----------------------------------------------------------------------------
// 8. OfficerDashboard SLA Integration
// -----------------------------------------------------------------------------
console.log('\n--- 8. OfficerDashboard SLA Attention & Column ---');

const officerDashPath = path.resolve(__dirname, '../frontend/src/pages/OfficerDashboard.jsx');
assert(fs.existsSync(officerDashPath), '8.1 OfficerDashboard.jsx exists');

const officerDashSource = fs.readFileSync(officerDashPath, 'utf8');
assert(officerDashSource.includes('sla-officer-alert'), '8.2 OfficerDashboard displays SLA alert banner when overdue tasks exist');
assert(officerDashSource.includes('SLA Status'), '8.3 Officer assigned table includes SLA Status column');
assert(officerDashSource.includes('getOfficerSlaOverviewApi'), '8.4 OfficerDashboard fetches officer SLA metrics via api');

// -----------------------------------------------------------------------------
// 9. Citizen Tracking SLA Section & Data Privacy
// -----------------------------------------------------------------------------
console.log('\n--- 9. Citizen Complaint Tracking SLA Section & Privacy ---');

const trackPath = path.resolve(__dirname, '../frontend/src/pages/TrackComplaintPage.jsx');
assert(fs.existsSync(trackPath), '9.1 TrackComplaintPage.jsx exists');

const trackSource = fs.readFileSync(trackPath, 'utf8');
assert(trackSource.includes('track-sla-item'), '9.2 TrackComplaintPage contains SLA section container');
assert(trackSource.includes('Target Resolution Window'), '9.3 Displays citizen Target Resolution Window');
assert(trackSource.includes('Target Resolution Deadline'), '9.4 Displays citizen Target Resolution Deadline');
assert(trackSource.includes('sla-reassurance-box'), '9.5 Displays reassurance message for monitored issues');

// Data leakage prevention check on citizen page:
// TrackComplaintPage MUST NOT display internal escalation levels (Level 1, Level 2, Level 3) in public UI
assert(!trackSource.includes('Level 1 Warning') && !trackSource.includes('Level 2 SLA Breach') && !trackSource.includes('Level 3 Critical'),
  '9.6 Public TrackComplaintPage strictly conceals internal escalation hierarchy (Level 1/2/3)');

// -----------------------------------------------------------------------------
// 10. API Client Functions in api.js
// -----------------------------------------------------------------------------
console.log('\n--- 10. Frontend API Client Functions ---');

const apiPath = path.resolve(__dirname, '../frontend/src/services/api.js');
assert(fs.existsSync(apiPath), '10.1 api.js exists');

const apiSource = fs.readFileSync(apiPath, 'utf8');
const requiredApiFunctions = [
  'getAdminSlaConfigApi',
  'updateAdminSlaConfigApi',
  'getAdminSlaOverviewApi',
  'getAdminOverdueComplaintsApi',
  'getAdminEscalationLogsApi',
  'getComplaintEscalationHistoryApi',
  'manualEscalateComplaintApi',
  'triggerSlaEvaluationApi',
  'getOfficerSlaOverviewApi',
  'getOfficerEscalationsApi'
];

for (const fn of requiredApiFunctions) {
  assert(apiSource.includes(fn), `10.2 api.js exports client function: ${fn}`);
}

// -----------------------------------------------------------------------------
// 11. CSS Styles in App.css
// -----------------------------------------------------------------------------
console.log('\n--- 11. App.css Stylesheet Verification ---');

const cssPath = path.resolve(__dirname, '../frontend/src/App.css');
assert(fs.existsSync(cssPath), '11.1 App.css exists');

const cssSource = fs.readFileSync(cssPath, 'utf8');
const requiredStyles = [
  '.sla-management-container',
  '.sla-kpi-grid',
  '.sla-kpi-card',
  '.sla-subtabs-nav',
  '.sla-subtab-btn',
  '.sla-table-card',
  '.sla-table',
  '.sla-priority-pill',
  '.sla-status-pill',
  '.esc-level-badge',
  '.sla-progress-track',
  '.target-input-card',
  '.sla-officer-alert',
  '.track-sla-card',
  '.sla-reassurance-box'
];

for (const cls of requiredStyles) {
  assert(cssSource.includes(cls), `11.2 App.css contains style rule: ${cls}`);
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`🎨  Phase 17 SLA UI Tests: ${passedTests} / ${totalTests} passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('======================================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
