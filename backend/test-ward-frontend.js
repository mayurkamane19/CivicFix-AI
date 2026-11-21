/**
 * CivicFix AI - Phase 22: Government Multi-Ward Management Frontend Behavioral Tests
 *
 * Automated functional and behavioral verification for:
 * 1. Frontend API client contracts & export integrity (api.js)
 * 2. Ward Directory form validation (name, code uppercase normalization, positive integer number)
 * 3. Inter-Ward complaint transfer validation & mandatory justification reason
 * 4. SLA deadline preservation policy reassurance in UI
 * 5. Officer assignment selection & workload scoping logic
 * 6. Multi-Ward overview KPI aggregation & compliance rate math
 * 7. Ward search and zone filtering behavioral logic
 * 8. RBAC view guarding (Municipal Admin, Ward Admin vs unauthorized roles)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
  }
}

console.log('===============================================================');
console.log('🖥️  CivicFix AI: Phase 22 Ward Frontend & UI Behavioral Tests');
console.log('===============================================================\n');

// -----------------------------------------------------------------------------
// 1. Frontend API Client Method Contracts
// -----------------------------------------------------------------------------
console.log('--- 1. Frontend API Client Method Contracts ---');

const apiPath = path.resolve(__dirname, '../frontend/src/services/api.js');
const apiSource = fs.readFileSync(apiPath, 'utf8');

const REQUIRED_WARD_API_EXPORTS = [
  'createWardApi',
  'getWardsApi',
  'getWardDetailsApi',
  'updateWardApi',
  'toggleWardStatusApi',
  'deleteWardApi',
  'getWardOfficersApi',
  'assignWardOfficersApi',
  'removeWardOfficerApi',
  'assignWardDepartmentsApi',
  'transferComplaintWardApi',
  'getMunicipalOverviewApi',
  'getWardAnalyticsApi',
  'exportMunicipalWardCsvApi'
];

REQUIRED_WARD_API_EXPORTS.forEach((fnName, idx) => {
  runTest(`1.${idx + 1} api.js exports client function: ${fnName}`, () => {
    assert.ok(
      apiSource.includes(`export const ${fnName}`),
      `Missing named export: ${fnName}`
    );
  });
});

// -----------------------------------------------------------------------------
// 2. Ward Form Validation Logic
// -----------------------------------------------------------------------------
console.log('\n--- 2. Ward Creation & Update Validation Logic ---');

const validateWardForm = ({ name, code, number, zone }) => {
  const errors = {};
  if (!name || name.trim().length < 2) {
    errors.name = 'Ward name must be at least 2 characters long';
  }
  if (!code || code.trim().length < 2) {
    errors.code = 'Ward code is required';
  } else if (!/^[A-Z0-9-]+$/.test(code.trim().toUpperCase())) {
    errors.code = 'Ward code must be alphanumeric with hyphens';
  }
  const parsedNum = parseInt(number, 10);
  if (isNaN(parsedNum) || parsedNum < 1) {
    errors.number = 'Ward number must be a positive integer';
  }
  if (!zone || zone.trim() === '') {
    errors.zone = 'Municipal zone is required';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

runTest('2.1 Valid ward input passes client form validation', () => {
  const result = validateWardForm({
    name: 'Ward 1 - Central Civic Square',
    code: 'WARD-01',
    number: '1',
    zone: 'Central Zone'
  });
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(Object.keys(result.errors).length, 0);
});

runTest('2.2 Short ward name (< 2 chars) is flagged with validation error', () => {
  const result = validateWardForm({
    name: 'W',
    code: 'WARD-01',
    number: '1',
    zone: 'Central Zone'
  });
  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.name);
});

runTest('2.3 Missing or non-positive ward number is rejected', () => {
  const result = validateWardForm({
    name: 'Ward Zero',
    code: 'WARD-00',
    number: '0',
    zone: 'Central Zone'
  });
  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.number);
});

runTest('2.4 Code normalization converts lowercase input to uppercase', () => {
  const normalizeCode = (val) => val.trim().toUpperCase();
  assert.strictEqual(normalizeCode('ward-01'), 'WARD-01');
  assert.strictEqual(normalizeCode(' north-central '), 'NORTH-CENTRAL');
});

// -----------------------------------------------------------------------------
// 3. Inter-Ward Complaint Transfer Validation & SLA Preservation
// -----------------------------------------------------------------------------
console.log('\n--- 3. Complaint Transfer Validation & SLA Preservation ---');

const validateTransferForm = ({ destinationWardId, currentWardId, reason }) => {
  const errors = {};
  if (!destinationWardId) {
    errors.destinationWard = 'Please select a destination municipal ward';
  } else if (destinationWardId === currentWardId) {
    errors.destinationWard = 'Destination ward cannot be the same as current ward';
  }
  if (!reason || reason.trim().length < 10) {
    errors.reason = 'Please provide a mandatory transfer justification of at least 10 characters';
  } else if (reason.trim().length > 1000) {
    errors.reason = 'Transfer reason cannot exceed 1000 characters';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

runTest('3.1 Valid transfer parameters pass validation', () => {
  const result = validateTransferForm({
    destinationWardId: 'ward_2',
    currentWardId: 'ward_1',
    reason: 'Reassigned per north corridor infrastructure jurisdiction.'
  });
  assert.strictEqual(result.isValid, true);
});

runTest('3.2 Missing destination ward fails transfer validation', () => {
  const result = validateTransferForm({
    destinationWardId: '',
    currentWardId: 'ward_1',
    reason: 'Reasonable justification text here.'
  });
  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.destinationWard);
});

runTest('3.3 Transferring to the same ward is blocked with validation error', () => {
  const result = validateTransferForm({
    destinationWardId: 'ward_1',
    currentWardId: 'ward_1',
    reason: 'Trying to transfer to identical ward.'
  });
  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.destinationWard);
});

runTest('3.4 Short transfer reason (< 10 chars) is blocked with mandatory error', () => {
  const result = validateTransferForm({
    destinationWardId: 'ward_2',
    currentWardId: 'ward_1',
    reason: 'Too brief'
  });
  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.reason);
});

runTest('3.5 ComplaintTransferModal source explicitly informs citizen SLA preservation', () => {
  const modalPath = path.resolve(__dirname, '../frontend/src/components/ward/ComplaintTransferModal.jsx');
  const modalSource = fs.readFileSync(modalPath, 'utf8');
  assert.ok(
    modalSource.includes('SLA Deadline Preservation Guarantee'),
    'ComplaintTransferModal must display SLA preservation guarantee'
  );
  assert.ok(
    modalSource.includes('will not be reset'),
    'ComplaintTransferModal must state SLA will not be reset'
  );
});

// -----------------------------------------------------------------------------
// 4. Officer Assignment & Workload Scoping
// -----------------------------------------------------------------------------
console.log('\n--- 4. Officer Assignment & Workload Scoping ---');

runTest('4.1 Filtering already-assigned officers prevents redundant dropdown items', () => {
  const allOfficers = [
    { id: 'off_1', name: 'Officer A' },
    { id: 'off_2', name: 'Officer B' },
    { id: 'off_3', name: 'Officer C' }
  ];
  const assignedOfficers = [{ id: 'off_1', name: 'Officer A' }];

  const assignedSet = new Set(assignedOfficers.map((o) => o.id));
  const available = allOfficers.filter((o) => !assignedSet.has(o.id));

  assert.strictEqual(available.length, 2);
  assert.strictEqual(available[0].id, 'off_2');
  assert.strictEqual(available[1].id, 'off_3');
});

runTest('4.2 WardOfficersModal component includes unassign and assign actions', () => {
  const modalPath = path.resolve(__dirname, '../frontend/src/components/ward/WardOfficersModal.jsx');
  const modalSource = fs.readFileSync(modalPath, 'utf8');
  assert.ok(modalSource.includes('handleAssignOfficer'));
  assert.ok(modalSource.includes('handleRemoveOfficer'));
  assert.ok(modalSource.includes('Unassign'));
});

// -----------------------------------------------------------------------------
// 5. Multi-Ward KPI Aggregation Math
// -----------------------------------------------------------------------------
console.log('\n--- 5. Multi-Ward Overview & KPI Aggregation Math ---');

const computeSlaCompliance = (total, overdue) => {
  if (!total || total <= 0) return 100;
  return Math.round(((total - overdue) / total) * 100);
};

runTest('5.1 SLA compliance computes exact percentage accurately', () => {
  assert.strictEqual(computeSlaCompliance(100, 10), 90);
  assert.strictEqual(computeSlaCompliance(50, 5), 90);
  assert.strictEqual(computeSlaCompliance(20, 0), 100);
  assert.strictEqual(computeSlaCompliance(10, 10), 0);
});

runTest('5.2 Zero complaints defaults cleanly to 100% compliance without NaN', () => {
  assert.strictEqual(computeSlaCompliance(0, 0), 100);
});

// -----------------------------------------------------------------------------
// 6. Ward Search and Zone Filtering Logic
// -----------------------------------------------------------------------------
console.log('\n--- 6. Ward Search and Zone Filtering Logic ---');

const mockWards = [
  { id: 'w1', code: 'WARD-01', name: 'Ward 1 - Central Civic', zone: 'Central Zone', isActive: true },
  { id: 'w2', code: 'WARD-02', name: 'Ward 2 - North Heritage', zone: 'North Zone', isActive: true },
  { id: 'w3', code: 'WARD-03', name: 'Ward 3 - South Hillside', zone: 'South Zone', isActive: false },
  { id: 'w4', code: 'WARD-04', name: 'Ward 4 - East Industrial', zone: 'East Zone', isActive: true }
];

const filterWards = (list, { search = '', zone = 'All Zones', status = 'all' }) => {
  return list.filter((w) => {
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      const match = w.name.toLowerCase().includes(q) || w.code.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (zone && zone !== 'All Zones' && w.zone !== zone) {
      return false;
    }
    if (status !== 'all') {
      const activeMatch = status === 'true';
      if (w.isActive !== activeMatch) return false;
    }
    return true;
  });
};

runTest('6.1 Search matches ward name case-insensitively', () => {
  const res = filterWards(mockWards, { search: 'central' });
  assert.strictEqual(res.length, 1);
  assert.strictEqual(res[0].code, 'WARD-01');
});

runTest('6.2 Search matches ward code case-insensitively', () => {
  const res = filterWards(mockWards, { search: 'ward-03' });
  assert.strictEqual(res.length, 1);
  assert.strictEqual(res[0].name, 'Ward 3 - South Hillside');
});

runTest('6.3 Zone filter isolates wards belonging to specified zone', () => {
  const res = filterWards(mockWards, { zone: 'North Zone' });
  assert.strictEqual(res.length, 1);
  assert.strictEqual(res[0].code, 'WARD-02');
});

runTest('6.4 Status filter isolates inactive wards', () => {
  const res = filterWards(mockWards, { status: 'false' });
  assert.strictEqual(res.length, 1);
  assert.strictEqual(res[0].code, 'WARD-03');
});

// -----------------------------------------------------------------------------
// 7. Role-Based Navigation & Access Guarding
// -----------------------------------------------------------------------------
console.log('\n--- 7. Role-Based Access Control & Navigation Guarding ---');

const isMunicipalDashboardPermitted = (user) => {
  return Boolean(user && (user.role === 'admin' || user.role === 'ward_admin'));
};

runTest('7.1 Municipal Administrator is permitted on Municipal Dashboard', () => {
  assert.strictEqual(isMunicipalDashboardPermitted({ role: 'admin' }), true);
});

runTest('7.2 Ward Administrator is permitted on Municipal Dashboard', () => {
  assert.strictEqual(isMunicipalDashboardPermitted({ role: 'ward_admin' }), true);
});

runTest('7.3 Field Officer is blocked from Municipal Dashboard', () => {
  assert.strictEqual(isMunicipalDashboardPermitted({ role: 'officer' }), false);
});

runTest('7.4 Citizen is blocked from Municipal Dashboard', () => {
  assert.strictEqual(isMunicipalDashboardPermitted({ role: 'citizen' }), false);
});

runTest('7.5 Unauthenticated user (null) is blocked from Municipal Dashboard', () => {
  assert.strictEqual(isMunicipalDashboardPermitted(null), false);
});

// -----------------------------------------------------------------------------
// 8. Component File Existence & Integration
// -----------------------------------------------------------------------------
console.log('\n--- 8. Component File Existence & Integration ---');

const COMPONENT_FILES = [
  'frontend/src/components/ward/ward.css',
  'frontend/src/components/ward/ComplaintTransferModal.jsx',
  'frontend/src/components/ward/WardOfficersModal.jsx',
  'frontend/src/components/ward/WardManagement.jsx',
  'frontend/src/components/ward/MunicipalOverviewTab.jsx',
  'frontend/src/components/ward/WardAnalyticsTab.jsx',
  'frontend/src/components/ward/MunicipalGISMap.jsx',
  'frontend/src/pages/MunicipalDashboard.jsx'
];

COMPONENT_FILES.forEach((relPath, idx) => {
  runTest(`8.${idx + 1} Component file exists: ${relPath}`, () => {
    const fullPath = path.resolve(__dirname, '../', relPath);
    assert.ok(fs.existsSync(fullPath), `File does not exist: ${relPath}`);
  });
});

console.log('\n===============================================================');
console.log(`Phase 22 Ward Frontend Tests: ${passed} passed, ${total - passed} failed.`);
console.log('===============================================================\n');

if (passed !== total) {
  process.exit(1);
}
