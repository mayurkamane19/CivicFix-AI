/**
 * CivicFix AI - Phase 18: Notification Center UI Test Suite
 *
 * Automated verification for:
 * 1. Component existence and frontend API client methods
 * 2. Bell icon button, SVG markup, unread badge, and ARIA accessibility attributes
 * 3. Dropdown layout, category filter pills, search input, and batch controls
 * 4. Priority styling (Critical, High, Medium, Low) and category iconography
 * 5. Adaptive 30s real-time polling and Page Visibility lifecycle cleanup
 * 6. Role-mandated notification alert guards in UI
 * 7. Navbar, AdminDashboard, and OfficerDashboard layout integrations
 * 8. Responsive CSS styling rules, modal animations, and pulse effects in App.css
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let total = 0;
let passed = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
  }
}

console.log('====================================================');
console.log('🖥️  CivicFix AI: Phase 18 Notification UI & Component Tests');
console.log('====================================================\n');

const frontendRoot = path.resolve(__dirname, '../frontend/src');
const notifCenterPath = path.join(frontendRoot, 'components/notifications/NotificationCenter.jsx');
const apiPath = path.join(frontendRoot, 'services/api.js');
const navbarPath = path.join(frontendRoot, 'components/Navbar.jsx');
const adminDashPath = path.join(frontendRoot, 'pages/AdminDashboard.jsx');
const officerDashPath = path.join(frontendRoot, 'pages/OfficerDashboard.jsx');
const appCssPath = path.join(frontendRoot, 'App.css');

// -----------------------------------------------------------------------------
// 1. FILE EXISTENCE & EXPORT VERIFICATION
// -----------------------------------------------------------------------------
console.log('--- 1. File Existence & API Client Integration ---');

assert(fs.existsSync(notifCenterPath), '1.1 NotificationCenter.jsx exists in frontend/src/components/notifications/');

const apiContent = fs.readFileSync(apiPath, 'utf-8');

assert(apiContent.includes('export const getUserNotificationsApi'), '1.2 api.js exports getUserNotificationsApi');
assert(apiContent.includes('export const getUnreadCountApi'), '1.3 api.js exports getUnreadCountApi');
assert(apiContent.includes('export const markNotificationReadApi'), '1.4 api.js exports markNotificationReadApi');
assert(apiContent.includes('export const markAllNotificationsReadApi'), '1.5 api.js exports markAllNotificationsReadApi');
assert(apiContent.includes('export const deleteNotificationApi'), '1.6 api.js exports deleteNotificationApi');
assert(apiContent.includes('export const clearReadNotificationsApi'), '1.7 api.js exports clearReadNotificationsApi');
assert(apiContent.includes('export const broadcastAnnouncementApi'), '1.8 api.js exports broadcastAnnouncementApi');
assert(apiContent.includes('export const getNotificationPreferencesApi'), '1.9 api.js exports getNotificationPreferencesApi');
assert(apiContent.includes('export const updateNotificationPreferencesApi'), '1.10 api.js exports updateNotificationPreferencesApi');

// -----------------------------------------------------------------------------
// 2. NOTIFICATION CENTER COMPONENT STRUCTURE
// -----------------------------------------------------------------------------
console.log('\n--- 2. Component Structure & Accessibility Attributes ---');

const notifCenterContent = fs.readFileSync(notifCenterPath, 'utf-8');

assert(notifCenterContent.includes('className="notification-center-container"'), '2.1 NotificationCenter defines root container');
assert(notifCenterContent.includes('className={`notification-bell-btn'), '2.2 Interactive bell button is defined');
assert(notifCenterContent.includes('notification-bell-icon'), '2.3 Bell button renders SVG notification bell icon');
assert(notifCenterContent.includes('aria-label={`Notifications,'), '2.4 Bell button provides accessible aria-label with unread count');
assert(notifCenterContent.includes('aria-expanded={isOpen}'), '2.5 Bell button manages aria-expanded state');
assert(notifCenterContent.includes('unreadCount > 99 ? \'99+\' : unreadCount'), '2.6 Unread counter badge formats overflow as 99+');
assert(notifCenterContent.includes('unreadCount > 0 && ('), '2.7 Unread badge is conditionally rendered only when unreadCount > 0');

// -----------------------------------------------------------------------------
// 3. DROPDOWN PANEL, FILTERS & BATCH CONTROLS
// -----------------------------------------------------------------------------
console.log('\n--- 3. Dropdown Controls, Category Tabs & Search ---');

assert(notifCenterContent.includes('className="notification-dropdown"'), '3.1 Dropdown panel markup is defined');
assert(notifCenterContent.includes('handleMarkAllRead'), '3.2 "Mark all as read" batch action is wired');
assert(notifCenterContent.includes('handleClearRead'), '3.3 "Clear read" batch action is wired');
assert(notifCenterContent.includes('filter-tab-pill'), '3.4 Category filter pills are defined');
assert(notifCenterContent.includes('setActiveFilter(\'all\')'), '3.5 "All" filter tab option is supported');
assert(notifCenterContent.includes('setActiveFilter(\'unread\')'), '3.6 "Unread" filter tab option is supported');
assert(notifCenterContent.includes('setActiveFilter(\'complaints\')'), '3.7 "Complaints" category filter tab is supported');
assert(notifCenterContent.includes('setActiveFilter(\'sla\')'), '3.8 "SLA Alerts" category filter tab is supported');
assert(notifCenterContent.includes('setActiveFilter(\'system\')'), '3.9 "System" category filter tab is supported');
assert(notifCenterContent.includes('notification-search-input'), '3.10 In-panel keyword search input is implemented');
assert(notifCenterContent.includes('All Caught Up!'), '3.11 Empty state with friendly text is implemented');

// -----------------------------------------------------------------------------
// 4. CATEGORY ICONS & PRIORITY HIGHLIGHTS
// -----------------------------------------------------------------------------
console.log('\n--- 4. Category Icons & Priority Highlights ---');

assert(notifCenterContent.includes('cat-escalation') && notifCenterContent.includes('🚨'), '4.1 Escalation alert is mapped to 🚨 alert badge');
assert(notifCenterContent.includes('cat-sla-warning') && notifCenterContent.includes('⚠️'), '4.2 SLA warning is mapped to ⚠️ warning badge');
assert(notifCenterContent.includes('cat-resolution') && notifCenterContent.includes('✅'), '4.3 Resolution is mapped to ✅ checkmark badge');
assert(notifCenterContent.includes('cat-reopened') && notifCenterContent.includes('🔄'), '4.4 Reopened ticket is mapped to 🔄 refresh badge');
assert(notifCenterContent.includes('cat-status') && notifCenterContent.includes('📋'), '4.5 Status change is mapped to 📋 clipboard badge');
assert(notifCenterContent.includes('cat-assignment') && notifCenterContent.includes('👷'), '4.6 Assignment is mapped to 👷 officer badge');
assert(notifCenterContent.includes('cat-feedback') && notifCenterContent.includes('⭐'), '4.7 Feedback is mapped to ⭐ star badge');
assert(notifCenterContent.includes('cat-announcement') && notifCenterContent.includes('📢'), '4.8 Announcement is mapped to 📢 megaphone badge');

assert(notifCenterContent.includes('priority-critical'), '4.9 Critical priority visual indicator is applied');
assert(notifCenterContent.includes('priority-high'), '4.10 High priority visual indicator is applied');
assert(notifCenterContent.includes('unread-dot'), '4.11 Unread blue indicator dot is rendered on unread items');
assert(notifCenterContent.includes('formatRelativeTime'), '4.12 Relative timestamp formatting function is used');

// -----------------------------------------------------------------------------
// 5. REAL-TIME POLLING & LIFECYCLE MANAGEMENT
// -----------------------------------------------------------------------------
console.log('\n--- 5. Real-Time Adaptive Polling Lifecycle ---');

assert(notifCenterContent.includes('30000'), '5.1 Polling interval set to 30 seconds');
assert(notifCenterContent.includes('document.addEventListener(\'visibilitychange\''), '5.2 Page Visibility API listener registered for active tab state');
assert(notifCenterContent.includes('document.removeEventListener(\'visibilitychange\''), '5.3 Visibility listener cleaned up on component unmount');
assert(notifCenterContent.includes('clearInterval(pollingRef.current)'), '5.4 Polling interval timer strictly cleared on unmount');

// -----------------------------------------------------------------------------
// 6. ROLE-MANDATED PREFERENCES IN UI
// -----------------------------------------------------------------------------
console.log('\n--- 6. Role-Mandated Alerts Protection in UI ---');

assert(
  notifCenterContent.includes('disabled={currentUser?.role === \'admin\'}'),
  '6.1 Critical escalations toggle is disabled for admin role'
);
assert(
  notifCenterContent.includes('Mandatory for Administrators'),
  '6.2 Mandated badge displayed for admin critical escalations'
);
assert(
  notifCenterContent.includes('disabled={currentUser?.role === \'officer\'}'),
  '6.3 New assignments toggle is disabled for officer role'
);
assert(
  notifCenterContent.includes('Mandatory for Field Officers'),
  '6.4 Mandated badge displayed for field officer new assignments'
);

// -----------------------------------------------------------------------------
// 7. LAYOUT & DASHBOARD INTEGRATION
// -----------------------------------------------------------------------------
console.log('\n--- 7. Application Navbar & Dashboard Layout Integration ---');

const navbarContent = fs.readFileSync(navbarPath, 'utf-8');
assert(navbarContent.includes('import NotificationCenter'), '7.1 Navbar.jsx imports NotificationCenter component');
assert(navbarContent.includes('<NotificationCenter'), '7.2 Navbar.jsx renders NotificationCenter for authenticated user');
assert(navbarContent.includes('onNavigateTrack={onNavigateTrack}'), '7.3 Navbar passes onNavigateTrack navigation handler to NotificationCenter');

const adminDashContent = fs.readFileSync(adminDashPath, 'utf-8');
assert(adminDashContent.includes('import NotificationCenter'), '7.4 AdminDashboard.jsx imports NotificationCenter');
assert(adminDashContent.includes('<NotificationCenter currentUser={currentUser} />'), '7.5 AdminDashboard renders NotificationCenter in header actions');

const officerDashContent = fs.readFileSync(officerDashPath, 'utf-8');
assert(officerDashContent.includes('import NotificationCenter'), '7.6 OfficerDashboard.jsx imports NotificationCenter');
assert(officerDashContent.includes('<NotificationCenter currentUser={currentUser} />'), '7.7 OfficerDashboard renders NotificationCenter in header actions');

// -----------------------------------------------------------------------------
// 8. CSS STYLES & RESPONSIVE RULES
// -----------------------------------------------------------------------------
console.log('\n--- 8. CSS Styles, Animation & Responsive Breakpoints ---');

const cssContent = fs.readFileSync(appCssPath, 'utf-8');

assert(cssContent.includes('.notification-center-container'), '8.1 App.css defines .notification-center-container');
assert(cssContent.includes('.notification-bell-btn'), '8.2 App.css defines .notification-bell-btn');
assert(cssContent.includes('.notification-badge'), '8.3 App.css defines .notification-badge');
assert(cssContent.includes('@keyframes badge-pulse'), '8.4 App.css defines @keyframes badge-pulse animation');
assert(cssContent.includes('.notification-dropdown'), '8.5 App.css defines .notification-dropdown floating panel');
assert(cssContent.includes('@keyframes dropdown-pop'), '8.6 App.css defines @keyframes dropdown-pop animation');
assert(cssContent.includes('.notification-item.priority-critical'), '8.7 App.css defines critical priority styling');
assert(cssContent.includes('.notification-item.priority-high'), '8.8 App.css defines high priority styling');
assert(cssContent.includes('.notification-modal-overlay'), '8.9 App.css defines notification preferences modal overlay');
assert(cssContent.includes('@media (max-width: 640px)'), '8.10 App.css defines responsive full-width mobile dropdown breakpoint');

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`Summary: ${passed}/${total} Phase 18 UI & Component tests passed.`);
console.log('====================================================\n');

process.exit(passed === total ? 0 : 1);
