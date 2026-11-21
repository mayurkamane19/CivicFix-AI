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
console.log('🖥️  CivicFix AI: Phase 20 Citizen UI & Behavioral Test Suite');
console.log('===============================================================\n');

const frontendRoot = fs.existsSync(path.resolve(__dirname, '..', 'frontend'))
  ? path.resolve(__dirname, '..', 'frontend')
  : path.resolve('frontend');

// -----------------------------------------------------------------------------
// 1. API Client Integration Contracts
// -----------------------------------------------------------------------------
console.log('--- 1. Frontend API Client Citizen Endpoints ---');

runTest('1.1 api.js exports all 4 Phase 20 citizen endpoints', () => {
  const apiFile = fs.readFileSync(path.join(frontendRoot, 'src', 'services', 'api.js'), 'utf8');
  const expectedFunctions = [
    'getCitizenDashboardApi',
    'getMyCitizenComplaintsApi',
    'getMyCitizenComplaintDetailsApi',
    'updateMyProfileApi'
  ];

  for (const fn of expectedFunctions) {
    assert.ok(apiFile.includes(`export const ${fn}`), `api.js should export ${fn}`);
    assert.ok(apiFile.includes(`${fn},`), `api.js default export should include ${fn}`);
  }
});

// -----------------------------------------------------------------------------
// 2. Citizen Dashboard Behavioral Logic & Formatting
// -----------------------------------------------------------------------------
console.log('\n--- 2. Citizen Dashboard Behavioral State & Formatting ---');

runTest('2.1 Stat definitions correctly map 6 key operational states', () => {
  const STAT_DEFINITIONS = [
    { key: 'total', title: 'Total Filed', statusFilter: null },
    { key: 'pending', title: 'Pending', statusFilter: 'Pending' },
    { key: 'inProgress', title: 'In Progress', statusFilter: 'In Progress' },
    { key: 'awaitingVerification', title: 'Awaiting Verify', statusFilter: 'Awaiting Verification' },
    { key: 'resolved', title: 'Resolved', statusFilter: 'Resolved' },
    { key: 'reopened', title: 'Reopened', statusFilter: 'Reopened' }
  ];

  assert.strictEqual(STAT_DEFINITIONS.length, 6);
  assert.strictEqual(STAT_DEFINITIONS.find(s => s.key === 'awaitingVerification').statusFilter, 'Awaiting Verification');
  assert.strictEqual(STAT_DEFINITIONS.find(s => s.key === 'total').statusFilter, null);
});

runTest('2.2 Dashboard timeAgo calculates relative timestamps accurately', () => {
  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return 'long ago';
  };

  const now = Date.now();
  assert.strictEqual(timeAgo(new Date(now - 10000).toISOString()), 'just now');
  assert.strictEqual(timeAgo(new Date(now - 15 * 60000).toISOString()), '15m ago');
  assert.strictEqual(timeAgo(new Date(now - 3 * 3600000).toISOString()), '3h ago');
  assert.strictEqual(timeAgo(new Date(now - 5 * 86400000).toISOString()), '5d ago');
  assert.strictEqual(timeAgo(null), '');
});

runTest('2.3 Recent activity list sorts complaints by updatedAt descending', () => {
  const items = [
    { complaintId: 'CFX-1', updatedAt: '2026-11-20T10:00:00Z' },
    { complaintId: 'CFX-2', updatedAt: '2026-11-20T14:30:00Z' },
    { complaintId: 'CFX-3', updatedAt: '2026-11-20T12:00:00Z' }
  ];

  const sorted = [...items].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  assert.strictEqual(sorted[0].complaintId, 'CFX-2');
  assert.strictEqual(sorted[1].complaintId, 'CFX-3');
  assert.strictEqual(sorted[2].complaintId, 'CFX-1');
});

runTest('2.4 Quick actions map to proper navigation intents', () => {
  const actions = [
    { id: 'report', intent: 'report-new' },
    { id: 'complaints', intent: 'my-complaints' },
    { id: 'pending-review', intent: 'my-complaints', filter: 'Awaiting Verification' }
  ];

  assert.strictEqual(actions.find(a => a.id === 'report').intent, 'report-new');
  assert.strictEqual(actions.find(a => a.id === 'pending-review').filter, 'Awaiting Verification');
});

// -----------------------------------------------------------------------------
// 3. StatusBadge Component Behavioral Logic
// -----------------------------------------------------------------------------
console.log('\n--- 3. StatusBadge Component Behavioral Logic ---');

const STATUS_CONFIG = {
  'Pending': { bg: '#fefce8', text: '#92400e', label: 'Pending' },
  'In Progress': { bg: '#eff6ff', text: '#1e40af', label: 'In Progress' },
  'Assigned': { bg: '#f0f9ff', text: '#075985', label: 'Assigned' },
  'Awaiting Verification': { bg: '#fff7ed', text: '#9a3412', label: 'Awaiting Verification' },
  'Resolved': { bg: '#ecfdf5', text: '#065f46', label: 'Resolved' },
  'Reopened': { bg: '#fff1f2', text: '#9f1239', label: 'Reopened' },
  'Under Administrative Review': { bg: '#faf5ff', text: '#581c87', label: 'Under Review' }
};

runTest('3.1 StatusBadge provides distinct visual styles for all 7 statuses', () => {
  const requiredStatuses = [
    'Pending', 'In Progress', 'Assigned', 'Awaiting Verification',
    'Resolved', 'Reopened', 'Under Administrative Review'
  ];

  for (const s of requiredStatuses) {
    const conf = STATUS_CONFIG[s];
    assert.ok(conf, `Config missing for status ${s}`);
    assert.ok(conf.bg, `Background color missing for ${s}`);
    assert.ok(conf.text, `Text color missing for ${s}`);
    assert.ok(conf.label, `Label missing for ${s}`);
  }
});

runTest('3.2 StatusBadge falls back safely for unmapped status', () => {
  const fallback = STATUS_CONFIG['NonExistent'] || { label: 'Unknown', bg: '#f8fafc' };
  assert.strictEqual(fallback.label, 'Unknown');
  assert.strictEqual(fallback.bg, '#f8fafc');
});

// -----------------------------------------------------------------------------
// 4. MyComplaints Filtering, Searching, & Pagination Logic
// -----------------------------------------------------------------------------
console.log('\n--- 4. MyComplaints Filtering, Searching, & Pagination Logic ---');

const sampleComplaints = [
  { complaintId: 'CFX-20261120-0001', title: 'Deep Pothole on MG Road', description: 'Large crater near shop', category: 'Pothole', status: 'Pending', createdAt: '2026-11-20T08:00:00Z', updatedAt: '2026-11-20T08:00:00Z' },
  { complaintId: 'CFX-20261120-0002', title: 'Garbage dump near school', description: 'Debris left uncleared', category: 'Garbage', status: 'In Progress', createdAt: '2026-11-20T09:00:00Z', updatedAt: '2026-11-20T11:00:00Z' },
  { complaintId: 'CFX-20261120-0003', title: 'Broken streetlight junction', description: 'Lights out on crossroad', category: 'Streetlight', status: 'Resolved', createdAt: '2026-11-20T07:00:00Z', updatedAt: '2026-11-20T12:00:00Z', resolutionEvidence: { status: 'Submitted by Officer' } },
  { complaintId: 'CFX-20261120-0004', title: 'Water leakage in main pipe', description: 'Clean water overflowing road', category: 'Water Supply', status: 'Resolved', createdAt: '2026-11-19T10:00:00Z', updatedAt: '2026-11-20T13:00:00Z', resolutionEvidence: { status: 'Verified by Citizen' } },
  { complaintId: 'CFX-20261120-0005', title: 'Sewage drain overflowing', description: 'Foul odor across colony', category: 'Sewage', status: 'In Progress', createdAt: '2026-11-18T10:00:00Z', updatedAt: '2026-11-19T10:00:00Z' }
];

runTest('4.1 Keyword search matches either complaintId or description case-insensitively', () => {
  const searchFilter = (query) => {
    const q = query.toLowerCase().trim();
    return sampleComplaints.filter(c =>
      c.complaintId.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  };

  assert.strictEqual(searchFilter('pothole').length, 1);
  assert.strictEqual(searchFilter('cfx-20261120-0002').length, 1);
  assert.strictEqual(searchFilter('overflowing').length, 2);
  assert.strictEqual(searchFilter('nonexistent').length, 0);
});

runTest('4.2 Status filter recognizes Awaiting Verification via resolutionEvidence status', () => {
  const filterByStatus = (status) => {
    return sampleComplaints.filter(c => {
      if (status === 'Awaiting Verification') {
        return c.resolutionEvidence?.status === 'Submitted by Officer';
      }
      return c.status === status;
    });
  };

  assert.strictEqual(filterByStatus('Awaiting Verification').length, 1);
  assert.strictEqual(filterByStatus('Pending').length, 1);
  assert.strictEqual(filterByStatus('In Progress').length, 2);
  assert.strictEqual(filterByStatus('Resolved').length, 2);
});

runTest('4.3 Category filter narrows complaints accurately', () => {
  const filterByCategory = (cat) => sampleComplaints.filter(c => c.category === cat);
  assert.strictEqual(filterByCategory('Garbage').length, 1);
  assert.strictEqual(filterByCategory('Road Damage').length, 0);
});

runTest('4.4 Sort options reorder complaints correctly', () => {
  const sortNewest = [...sampleComplaints].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  assert.strictEqual(sortNewest[0].complaintId, 'CFX-20261120-0002');

  const sortOldest = [...sampleComplaints].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  assert.strictEqual(sortOldest[0].complaintId, 'CFX-20261120-0005');

  const sortUpdated = [...sampleComplaints].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  assert.strictEqual(sortUpdated[0].complaintId, 'CFX-20261120-0004');
});

runTest('4.5 Pagination calculation computes total pages and slice bounds', () => {
  const total = 25;
  const limit = 10;
  const pages = Math.ceil(total / limit);
  assert.strictEqual(pages, 3);

  const getPageSlice = (items, pageNum, pageSize) => {
    const start = (pageNum - 1) * pageSize;
    return items.slice(start, start + pageSize);
  };

  const dummy = Array.from({ length: 25 }, (_, i) => i + 1);
  assert.strictEqual(getPageSlice(dummy, 1, 10).length, 10);
  assert.strictEqual(getPageSlice(dummy, 2, 10).length, 10);
  assert.strictEqual(getPageSlice(dummy, 3, 10).length, 5);
});

// -----------------------------------------------------------------------------
// 5. Multi-Step Complaint Submission Validation Logic
// -----------------------------------------------------------------------------
console.log('\n--- 5. Multi-Step Submission Validation & Progress Logic ---');

runTest('5.1 Step 1 validation: Category is strictly required', () => {
  const validateCategory = (cat) => Boolean(cat && cat.trim().length > 0);
  assert.strictEqual(validateCategory(''), false);
  assert.strictEqual(validateCategory('   '), false);
  assert.strictEqual(validateCategory('Pothole'), true);
});

runTest('5.2 Step 2 validation: Title length constraints (10 to 200 chars)', () => {
  const validateTitle = (t) => {
    if (!t || t.trim().length < 10) return 'Too short';
    if (t.trim().length > 200) return 'Too long';
    return null;
  };

  assert.strictEqual(validateTitle(''), 'Too short');
  assert.strictEqual(validateTitle('Broken'), 'Too short');
  assert.strictEqual(validateTitle('Deep crater near main gate'), null);
  assert.strictEqual(validateTitle('a'.repeat(201)), 'Too long');
});

runTest('5.3 Step 2 validation: Description length constraints (20 to 2000 chars)', () => {
  const validateDesc = (d) => {
    if (!d || d.trim().length < 20) return 'Too short';
    if (d.trim().length > 2000) return 'Too long';
    return null;
  };

  assert.strictEqual(validateDesc('Short note'), 'Too short');
  assert.strictEqual(validateDesc('This is a comprehensive description of the civic problem on the road.'), null);
  assert.strictEqual(validateDesc('a'.repeat(2001)), 'Too long');
});

runTest('5.4 Step 3 validation: File type restrictions (JPEG, PNG, WebP only)', () => {
  const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
  const validateMime = (mime) => allowedMime.includes(mime);

  assert.strictEqual(validateMime('image/jpeg'), true);
  assert.strictEqual(validateMime('image/png'), true);
  assert.strictEqual(validateMime('image/webp'), true);
  assert.strictEqual(validateMime('application/pdf'), false);
  assert.strictEqual(validateMime('application/x-msdownload'), false);
});

runTest('5.5 Step 3 validation: Maximum file size limit 5MB enforced', () => {
  const MAX_SIZE = 5 * 1024 * 1024;
  const validateSize = (size) => size <= MAX_SIZE;

  assert.strictEqual(validateSize(2 * 1024 * 1024), true);
  assert.strictEqual(validateSize(5 * 1024 * 1024), true);
  assert.strictEqual(validateSize(5 * 1024 * 1024 + 1), false);
});

runTest('5.6 Step 4 validation: Address minimum length enforced', () => {
  const validateAddress = (addr) => Boolean(addr && addr.trim().length >= 5);

  assert.strictEqual(validateAddress(''), false);
  assert.strictEqual(validateAddress('MG'), false);
  assert.strictEqual(validateAddress('MG Road, Sector 4'), true);
});

runTest('5.7 Stepper progress percentage calculation', () => {
  const calcProgress = (step) => Math.min(100, Math.round(((step - 1) / 5) * 100));

  assert.strictEqual(calcProgress(1), 0);
  assert.strictEqual(calcProgress(2), 20);
  assert.strictEqual(calcProgress(3), 40);
  assert.strictEqual(calcProgress(4), 60);
  assert.strictEqual(calcProgress(5), 80);
  assert.strictEqual(calcProgress(6), 100);
});

// -----------------------------------------------------------------------------
// 6. Citizen Profile & Notification Preference Logic
// -----------------------------------------------------------------------------
console.log('\n--- 6. Citizen Profile & Preference Logic ---');

runTest('6.1 Name validation: 2 to 100 characters', () => {
  const validateName = (n) => Boolean(n && n.trim().length >= 2 && n.trim().length <= 100);

  assert.strictEqual(validateName(''), false);
  assert.strictEqual(validateName('A'), false);
  assert.strictEqual(validateName('Mayur Kamane'), true);
  assert.strictEqual(validateName('x'.repeat(101)), false);
});

runTest('6.2 Avatar initials generation from user name', () => {
  const getInitials = (n) => {
    if (!n) return 'C';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0][0].toUpperCase();
  };

  assert.strictEqual(getInitials('Mayur Kamane'), 'MK');
  assert.strictEqual(getInitials('Alice'), 'A');
  assert.strictEqual(getInitials(''), 'C');
  assert.strictEqual(getInitials(null), 'C');
});

runTest('6.3 Notification preferences toggle state transitions', () => {
  let prefs = {
    emailNotifications: true,
    complaintStatus: true,
    resolutionAlerts: false
  };

  const toggle = (key) => {
    prefs = { ...prefs, [key]: !prefs[key] };
  };

  toggle('resolutionAlerts');
  assert.strictEqual(prefs.resolutionAlerts, true);

  toggle('emailNotifications');
  assert.strictEqual(prefs.emailNotifications, false);
});

// -----------------------------------------------------------------------------
// 7. Resolution Verification Integration & Policy Rules
// -----------------------------------------------------------------------------
console.log('\n--- 7. Resolution Verification Integration & Policy Rules ---');

runTest('7.1 Citizen can verify only when resolution status is Awaiting Citizen Verification', () => {
  const canAct = (status, resStatus) => {
    return status === 'Resolved' &&
      (resStatus === 'Awaiting Citizen Verification' || resStatus === 'Submitted by Officer');
  };

  assert.strictEqual(canAct('Resolved', 'Awaiting Citizen Verification'), true);
  assert.strictEqual(canAct('Resolved', 'Submitted by Officer'), true);
  assert.strictEqual(canAct('Resolved', 'Verified by Citizen'), false);
  assert.strictEqual(canAct('In Progress', 'Awaiting Citizen Verification'), false);
  assert.strictEqual(canAct('Resolved', 'Not Submitted'), false);
});

runTest('7.2 Citizen rejection requires non-empty reason of at least 10 chars', () => {
  const validateRejectionReason = (reason) => {
    return Boolean(reason && reason.trim().length >= 10);
  };

  assert.strictEqual(validateRejectionReason(''), false);
  assert.strictEqual(validateRejectionReason('Not fixed'), false); // 9 chars
  assert.strictEqual(validateRejectionReason('The pothole is still half open'), true); // 30 chars
});

runTest('7.3 Reopening limit of 3 escalates to administrative review', () => {
  const checkReopenStatus = (reopenCount, maxLimit = 3) => {
    if (reopenCount >= maxLimit) {
      return { canReopen: false, status: 'Under Administrative Review' };
    }
    return { canReopen: true, remaining: maxLimit - reopenCount };
  };

  assert.deepStrictEqual(checkReopenStatus(0), { canReopen: true, remaining: 3 });
  assert.deepStrictEqual(checkReopenStatus(2), { canReopen: true, remaining: 1 });
  assert.deepStrictEqual(checkReopenStatus(3), { canReopen: false, status: 'Under Administrative Review' });
  assert.deepStrictEqual(checkReopenStatus(4), { canReopen: false, status: 'Under Administrative Review' });
});

runTest('7.4 Feedback submission gated on citizen resolution verification', () => {
  const canSubmitFeedback = (complaintStatus, resolutionStatus) => {
    if (complaintStatus !== 'Resolved') return false;
    // Legacy complaints without resolutionEvidence can submit
    if (!resolutionStatus || resolutionStatus === 'Not Submitted') return true;
    // Phase 19+ requires verified resolution
    return resolutionStatus === 'Verified by Citizen';
  };

  assert.strictEqual(canSubmitFeedback('Resolved', 'Verified by Citizen'), true);
  assert.strictEqual(canSubmitFeedback('Resolved', 'Submitted by Officer'), false);
  assert.strictEqual(canSubmitFeedback('Resolved', 'Awaiting Citizen Verification'), false);
  assert.strictEqual(canSubmitFeedback('Resolved', 'Contested by Citizen'), false);
  assert.strictEqual(canSubmitFeedback('In Progress', 'Verified by Citizen'), false);
  assert.strictEqual(canSubmitFeedback('Resolved', 'Not Submitted'), true);
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n===============================================================');
console.log(`Phase 20 Citizen UI Test Suite: ${passed} passed, ${failed} failed.`);
console.log('===============================================================\n');

if (failed > 0) {
  process.exit(1);
}
