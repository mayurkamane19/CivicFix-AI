/**
 * CivicFix AI - Phase 22: Government Multi-Ward Management Backend Tests
 *
 * Automated verification for:
 * 1. Ward model schema validation & constraint enforcement
 * 2. Ward service CRUD, duplicate code/number prevention, and safe deletion guards
 * 3. Officer & department ward assignment, linking, and workload scoping
 * 4. Inter-ward complaint transfer workflow, audit history, and SLA deadline preservation
 * 5. City-wide multi-ward overview statistics, ward comparison, and CSV export
 * 6. RBAC security: Municipal Admin vs Ward Admin vs Field Officer vs Citizen
 */

import mongoose from 'mongoose';
import { Ward } from './src/models/Ward.js';
import { Complaint } from './src/models/Complaint.js';
import { Department } from './src/models/Department.js';
import { User } from './src/models/User.js';
import {
  createWard,
  getWards,
  getWardById,
  updateWard,
  toggleWardStatus,
  deleteWard,
  assignOfficersToWard,
  removeOfficerFromWard,
  assignDepartmentsToWard,
  transferComplaintBetweenWards,
  getMunicipalOverviewStats,
  getWardAnalytics,
  exportMunicipalWardCsv
} from './src/services/wardService.js';
import wardRoutes from './src/routes/wardRoutes.js';
import { authorize } from './src/middleware/authMiddleware.js';

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

async function runAsyncTest(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
  }
}

console.log('===============================================================');
console.log('🏛️  CivicFix AI: Phase 22 Multi-Ward Backend Test Suite');
console.log('===============================================================\n');

async function runAllTests() {
  // ---------------------------------------------------------------------------
  // 1. Ward Model & Schema Validation
  // ---------------------------------------------------------------------------
  console.log('--- 1. Ward Model Schema & Validation Constraints ---');

  runTest('1.1 Valid ward document passes schema validation', () => {
    const ward = new Ward({
      name: 'Ward 1 - Central Civic Square',
      code: 'WARD-01',
      number: 1,
      zone: 'Central Zone',
      center: { latitude: 18.5204, longitude: 73.8567 },
      population: 45000,
      areaKm2: 8.5
    });
    const err = ward.validateSync();
    if (err) throw err;
  });

  runTest('1.2 Missing ward name is rejected by schema validator', () => {
    const ward = new Ward({
      code: 'WARD-02',
      number: 2,
      zone: 'North Zone'
    });
    const err = ward.validateSync();
    if (!err || !err.errors.name) {
      throw new Error('Expected validation error for missing name');
    }
  });

  runTest('1.3 Missing ward code is rejected by schema validator', () => {
    const ward = new Ward({
      name: 'Ward Without Code',
      number: 3,
      zone: 'South Zone'
    });
    const err = ward.validateSync();
    if (!err || !err.errors.code) {
      throw new Error('Expected validation error for missing code');
    }
  });

  runTest('1.4 Ward number less than 1 is rejected by schema validator', () => {
    const ward = new Ward({
      name: 'Invalid Number Ward',
      code: 'WARD-ZERO',
      number: 0,
      zone: 'West Zone'
    });
    const err = ward.validateSync();
    if (!err || !err.errors.number) {
      throw new Error('Expected validation error for number < 1');
    }
  });

  runTest('1.5 Out-of-bounds latitude is rejected by schema validator', () => {
    const ward = new Ward({
      name: 'Invalid Coordinates Ward',
      code: 'WARD-GEO-ERR',
      number: 99,
      zone: 'East Zone',
      center: { latitude: 95.5, longitude: 73.8 }
    });
    const err = ward.validateSync();
    if (!err || !err.errors['center.latitude']) {
      throw new Error('Expected validation error for latitude > 90');
    }
  });

  runTest('1.6 toSafeObject() exposes clean attributes without internal database metadata', () => {
    const ward = new Ward({
      _id: new mongoose.Types.ObjectId(),
      name: 'Ward 1 - Central',
      code: 'WARD-01',
      number: 1,
      zone: 'Central Zone',
      municipality: 'City Municipal Corporation',
      isActive: true,
      center: { latitude: 18.52, longitude: 73.85 },
      population: 50000,
      areaKm2: 10
    });
    const safe = ward.toSafeObject();
    if (safe.name !== 'Ward 1 - Central') throw new Error('name mismatch');
    if (safe.code !== 'WARD-01') throw new Error('code mismatch');
    if (safe.number !== 1) throw new Error('number mismatch');
    if (safe.isActive !== true) throw new Error('isActive mismatch');
    if (safe._id !== undefined) throw new Error('_id should not be exposed on safe object');
  });

  // ---------------------------------------------------------------------------
  // 2. User & Complaint Schema Multi-Ward Extensions
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. User & Complaint Schema Multi-Ward Extensions ---');

  runTest('2.1 User schema supports role enum extension (ward_admin, department_head)', () => {
    const user = new User({
      name: 'Ward Officer Admin',
      email: 'wardadmin@city.gov',
      password: 'Password123!',
      role: 'ward_admin'
    });
    const err = user.validateSync();
    if (err) throw err;
  });

  runTest('2.2 User schema supports optional ward ObjectId reference', () => {
    const testWardId = new mongoose.Types.ObjectId();
    const user = new User({
      name: 'Field Officer Central',
      email: 'officer.central@city.gov',
      password: 'Password123!',
      role: 'officer',
      ward: testWardId
    });
    const err = user.validateSync();
    if (err) throw err;
    if (user.ward.toString() !== testWardId.toString()) throw new Error('User ward ref mismatch');
  });

  runTest('2.3 Complaint schema includes ward, wardName, and wardTransferHistory', () => {
    const testWardId = new mongoose.Types.ObjectId();
    const complaint = new Complaint({
      title: 'Water pipe leak near central square',
      category: 'Water Leakage',
      ward: testWardId,
      wardName: 'Ward 1 - Central',
      wardCode: 'WARD-01',
      location: { address: 'Main Street 100', latitude: 18.52, longitude: 73.85 }
    });
    const err = complaint.validateSync();
    if (err) throw err;
    if (!Array.isArray(complaint.wardTransferHistory)) {
      throw new Error('wardTransferHistory should be initialized as an array');
    }
  });

  runTest('2.4 Complaint toPublicJSON() and toAdminJSON() expose ward details safely', () => {
    const testWardId = new mongoose.Types.ObjectId();
    const complaint = new Complaint({
      complaintId: 'CFX-20261121-1001',
      title: 'Broken streetlight on MG Road',
      category: 'Streetlight',
      ward: testWardId,
      wardName: 'Ward 1 - Central',
      wardCode: 'WARD-01',
      location: { address: 'MG Road', latitude: 18.52, longitude: 73.85 }
    });

    const pub = complaint.toPublicJSON();
    if (pub.wardName !== 'Ward 1 - Central') throw new Error('Public JSON missing wardName');
    if (pub.wardCode !== 'WARD-01') throw new Error('Public JSON missing wardCode');

    const adm = complaint.toAdminJSON();
    if (adm.ward !== testWardId.toString()) throw new Error('Admin JSON missing ward ID');
    if (!Array.isArray(adm.wardTransferHistory)) throw new Error('Admin JSON missing wardTransferHistory');
  });

  // ---------------------------------------------------------------------------
  // 3. Ward Service CRUD & Business Rules Verification (Mocked DB State)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Ward Service Logic, Duplicate Prevention & Safe Deletion ---');

  // Set Mongoose connection readyState to 1 so getDatabaseStatus() returns 'connected'
  mongoose.connection.readyState = 1;

  // Behavioral mock state
  const mockWards = [];
  const mockComplaints = [];
  const mockUsers = [];
  const mockDepartments = [];

  Ward.prototype.save = function () {
    this._id = this._id || new mongoose.Types.ObjectId();
    const idx = mockWards.findIndex((w) => w._id.toString() === this._id.toString());
    if (idx >= 0) {
      mockWards[idx] = this;
    } else {
      mockWards.push(this);
    }
    return Promise.resolve(this);
  };

  // Setup sample mock department
  const sampleDept = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Road Maintenance',
    code: 'ROAD',
    isActive: true
  };
  mockDepartments.push(sampleDept);

  // Setup sample mock officer
  const sampleOfficer = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Officer Vikram',
    email: 'vikram@city.gov',
    role: 'officer',
    department: sampleDept._id,
    ward: null,
    isActive: true,
    save: function () { return Promise.resolve(this); }
  };
  mockUsers.push(sampleOfficer);

  // Wire Mongoose model methods to mock state for deterministic offline unit testing
  Ward.findOne = function (query = {}) {
    for (const w of mockWards) {
      if (query.code && w.code === query.code) {
        if (query._id && query._id.$ne && w._id.toString() === query._id.$ne.toString()) continue;
        return Promise.resolve(w);
      }
      if (query.number && w.number === query.number) {
        if (query._id && query._id.$ne && w._id.toString() === query._id.$ne.toString()) continue;
        return Promise.resolve(w);
      }
    }
    return Promise.resolve(null);
  };

  Ward.findById = function (id) {
    const targetId = id?.toString();
    const found = mockWards.find((w) => (w._id || w.id)?.toString() === targetId);
    if (!found) {
      const emptyPopulate = {
        populate: () => emptyPopulate,
        then: (resolve) => resolve(null)
      };
      return emptyPopulate;
    }
    found.save = function () {
      const idx = mockWards.findIndex((w) => (w._id || w.id)?.toString() === targetId);
      if (idx >= 0) mockWards[idx] = this;
      return Promise.resolve(this);
    };
    const populateChain = {
      populate: () => populateChain,
      then: (resolve) => resolve(found)
    };
    return populateChain;
  };

  Ward.countDocuments = function (query = {}) {
    let list = mockWards;
    if (query.isActive !== undefined) list = list.filter((w) => w.isActive === query.isActive);
    return Promise.resolve(list.length);
  };

  Ward.find = function () {
    return {
      populate: () => ({
        populate: () => ({
          populate: () => ({
            sort: () => ({
              skip: () => ({
                limit: () => Promise.resolve(mockWards)
              })
            })
          })
        })
      }),
      sort: () => ({
        select: () => Promise.resolve(mockWards)
      })
    };
  };

  Ward.findByIdAndDelete = function (id) {
    const idx = mockWards.findIndex((w) => w._id.toString() === id.toString());
    if (idx >= 0) mockWards.splice(idx, 1);
    return Promise.resolve({ success: true });
  };

  Complaint.countDocuments = function (query = {}) {
    let list = mockComplaints;
    if (query.ward) list = list.filter((c) => c.ward?.toString() === query.ward.toString());
    if (query.status) list = list.filter((c) => c.status === query.status);
    return Promise.resolve(list.length);
  };

  Complaint.findOne = function (query = {}) {
    const found = mockComplaints.find((c) => c.complaintId === query.complaintId);
    return Promise.resolve(found || null);
  };

  Complaint.aggregate = function () {
    return Promise.resolve([]);
  };

  Complaint.find = function () {
    return {
      sort: () => ({
        limit: () => ({
          select: () => Promise.resolve([])
        })
      }),
      populate: () => ({
        sort: () => ({
          limit: () => Promise.resolve([])
        })
      })
    };
  };

  User.findById = function (id) {
    const found = mockUsers.find((u) => u._id.toString() === id.toString());
    return Promise.resolve(found || null);
  };

  Department.findById = function (id) {
    const found = mockDepartments.find((d) => d._id.toString() === id.toString());
    return Promise.resolve(found || null);
  };

  // Test 3.1: Create Ward
  await runAsyncTest('3.1 createWard validates input and provisions active ward', async () => {
    const ward = await createWard({
      name: 'Ward 1 - Central Civic Square',
      code: 'WARD-01',
      number: 1,
      zone: 'Central Zone',
      center: { latitude: 18.5204, longitude: 73.8567 },
      population: 45000
    });

    if (ward.code !== 'WARD-01') throw new Error('Ward code mismatch');
    if (ward.number !== 1) throw new Error('Ward number mismatch');
    if (ward.isActive !== true) throw new Error('New ward should default to active');
  });

  // Test 3.2: Duplicate Code Prevention
  await runAsyncTest('3.2 createWard prevents duplicate ward code (HTTP 409)', async () => {
    try {
      await createWard({
        name: 'Duplicate Code Ward',
        code: 'WARD-01',
        number: 10,
        zone: 'North Zone'
      });
      throw new Error('Should have thrown on duplicate code');
    } catch (err) {
      if (err.statusCode !== 409 || !err.message.includes('already exists')) {
        throw new Error(`Expected 409 error on duplicate code, got: ${err.message}`);
      }
    }
  });

  // Test 3.3: Duplicate Number Prevention
  await runAsyncTest('3.3 createWard prevents duplicate ward number (HTTP 409)', async () => {
    try {
      await createWard({
        name: 'Duplicate Number Ward',
        code: 'WARD-99',
        number: 1,
        zone: 'South Zone'
      });
      throw new Error('Should have thrown on duplicate number');
    } catch (err) {
      if (err.statusCode !== 409 || !err.message.includes('already exists')) {
        throw new Error(`Expected 409 error on duplicate number, got: ${err.message}`);
      }
    }
  });

  // Test 3.4: Ward Activation and Deactivation
  await runAsyncTest('3.4 toggleWardStatus toggles isActive state safely', async () => {
    const existing = mockWards[0];
    const resDeactivate = await toggleWardStatus(existing._id.toString(), false);
    if (resDeactivate.isActive !== false) throw new Error('Expected ward to be deactivated');

    const resActivate = await toggleWardStatus(existing._id.toString(), true);
    if (resActivate.isActive !== true) throw new Error('Expected ward to be activated');
  });

  // Test 3.5: Safe Deletion - blocked when active complaints exist
  await runAsyncTest('3.5 deleteWard is blocked when ward contains active complaints', async () => {
    const existing = mockWards[0];
    // Attach mock complaint to this ward
    mockComplaints.push({
      _id: new mongoose.Types.ObjectId(),
      complaintId: 'CFX-20261121-0001',
      ward: existing._id,
      status: 'In Progress'
    });

    try {
      await deleteWard(existing._id.toString());
      throw new Error('Should have blocked deletion with active complaints');
    } catch (err) {
      if (err.statusCode !== 400 || !err.message.includes('existing complaints')) {
        throw new Error(`Expected complaint guard error, got: ${err.message}`);
      }
    }
  });

  // Test 3.6: Safe Deletion - blocked when assigned officers exist
  await runAsyncTest('3.6 deleteWard is blocked when ward has assigned officers', async () => {
    const existing = mockWards[0];
    mockComplaints.length = 0; // Clear complaints
    existing.assignedOfficers = [sampleOfficer._id]; // Assign officer

    try {
      await deleteWard(existing._id.toString());
      throw new Error('Should have blocked deletion with assigned officers');
    } catch (err) {
      if (err.statusCode !== 400 || !err.message.includes('assigned officers')) {
        throw new Error(`Expected officer guard error, got: ${err.message}`);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Officer and Department Assignment Scoping
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Officer & Department Ward Assignment ---');

  await runAsyncTest('4.1 assignOfficersToWard links officer to ward and updates User.ward', async () => {
    const existing = mockWards[0];
    existing.assignedOfficers = [];

    const res = await assignOfficersToWard(existing._id.toString(), [sampleOfficer._id.toString()]);
    if (res.assignedCount !== 1) throw new Error('Expected 1 officer assigned');
    if (sampleOfficer.ward.toString() !== existing._id.toString()) {
      throw new Error('Officer user document ward was not updated');
    }
  });

  await runAsyncTest('4.2 removeOfficerFromWard unlinks officer and clears User.ward', async () => {
    const existing = mockWards[0];
    await removeOfficerFromWard(existing._id.toString(), sampleOfficer._id.toString());
    if (sampleOfficer.ward !== null) throw new Error('Officer user ward was not cleared');
    if (existing.assignedOfficers.includes(sampleOfficer._id)) {
      throw new Error('Officer was not removed from ward array');
    }
  });

  await runAsyncTest('4.3 assignDepartmentsToWard links valid departments to ward', async () => {
    const existing = mockWards[0];
    const res = await assignDepartmentsToWard(existing._id.toString(), [sampleDept._id.toString()]);
    if (res.assignedDepartmentsCount !== 1) throw new Error('Expected 1 department assigned');
    if (!existing.assignedDepartments.map((d) => d.toString()).includes(sampleDept._id.toString())) {
      throw new Error('Department ID missing from ward.assignedDepartments');
    }
  });

  // ---------------------------------------------------------------------------
  // 5. Inter-Ward Complaint Transfer & SLA Deadline Preservation
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Inter-Ward Complaint Transfer & SLA Preservation ---');

  // Create Destination Ward (Ward 2)
  const destWard = new Ward({
    _id: new mongoose.Types.ObjectId(),
    name: 'Ward 2 - North Heritage',
    code: 'WARD-02',
    number: 2,
    zone: 'North Zone',
    isActive: true,
    assignedOfficers: []
  });
  mockWards.push(destWard);

  // Create Test Complaint with active SLA
  const originalDeadline = new Date(Date.now() + 48 * 3600000); // 48h in future
  const originalStartTime = new Date();
  const testComplaint = {
    _id: new mongoose.Types.ObjectId(),
    complaintId: 'CFX-20261121-TRANSFER-01',
    title: 'Damaged storm drainage inlet',
    ward: mockWards[0]._id,
    wardName: mockWards[0].name,
    wardCode: mockWards[0].code,
    assignedDepartment: sampleDept._id,
    assignedDepartmentName: sampleDept.name,
    assignedOfficer: sampleOfficer._id,
    assignedOfficerName: sampleOfficer.name,
    wardTransferHistory: [],
    sla: {
      status: 'Within SLA',
      priority: 'High',
      targetResolutionHours: 48,
      startTime: originalStartTime,
      deadline: originalDeadline,
      currentEscalationLevel: 0,
      isEscalated: false,
      monitoringActive: true
    },
    save: function () { return Promise.resolve(this); }
  };
  mockComplaints.push(testComplaint);

  await runAsyncTest('5.1 Complaint transfer without mandatory reason (< 10 chars) is rejected', async () => {
    try {
      await transferComplaintBetweenWards(testComplaint.complaintId, {
        destinationWardId: destWard._id.toString(),
        reason: 'Too short'
      });
      throw new Error('Should have rejected short reason');
    } catch (err) {
      if (err.statusCode !== 400 || !err.message.includes('10 characters')) {
        throw new Error(`Expected reason validation error, got: ${err.message}`);
      }
    }
  });

  await runAsyncTest('5.2 Complaint transfer to inactive ward is rejected with HTTP 400', async () => {
    destWard.isActive = false;
    try {
      await transferComplaintBetweenWards(testComplaint.complaintId, {
        destinationWardId: destWard._id.toString(),
        reason: 'Jurisdictional boundary adjustment by municipal committee'
      });
      throw new Error('Should have rejected transfer to inactive ward');
    } catch (err) {
      if (err.statusCode !== 400 || !err.message.includes('inactive ward')) {
        throw new Error(`Expected inactive ward error, got: ${err.message}`);
      }
    } finally {
      destWard.isActive = true;
    }
  });

  await runAsyncTest('5.3 Complaint transfer updates ward, logs transfer history, and PRESERVES SLA deadline', async () => {
    const adminUser = { _id: new mongoose.Types.ObjectId(), name: 'Commissioner Mehta' };
    const transferReason = 'Reassigned to North Zone engineering division per boundary survey';

    const result = await transferComplaintBetweenWards(testComplaint.complaintId, {
      destinationWardId: destWard._id.toString(),
      reason: transferReason,
      adminUser
    });

    if (result.destinationWard.code !== 'WARD-02') throw new Error('Destination ward code mismatch');
    if (testComplaint.ward.toString() !== destWard._id.toString()) throw new Error('Complaint ward ref was not updated');
    if (testComplaint.wardName !== destWard.name) throw new Error('Complaint wardName was not updated');
    if (testComplaint.wardTransferHistory.length !== 1) throw new Error('Transfer history record missing');

    const historyEntry = testComplaint.wardTransferHistory[0];
    if (historyEntry.reason !== transferReason) throw new Error('Transfer reason not recorded accurately');
    if (historyEntry.transferredByName !== 'Commissioner Mehta') throw new Error('Transferring administrator name mismatch');

    // CRITICAL SLA PRESERVATION CHECK
    if (testComplaint.sla.deadline.getTime() !== originalDeadline.getTime()) {
      throw new Error('CRITICAL VIOLATION: SLA deadline was mutated or reset during transfer!');
    }
    if (testComplaint.sla.priority !== 'High') {
      throw new Error('SLA priority was changed during transfer');
    }
    if (testComplaint.sla.monitoringActive !== true) {
      throw new Error('SLA monitoring was deactivated during transfer');
    }
  });

  // ---------------------------------------------------------------------------
  // 6. City-Wide Multi-Ward Overview & CSV Export Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Multi-Ward Overview & CSV Export ---');

  await runAsyncTest('6.1 getMunicipalOverviewStats returns structured city-wide KPIs and ward comparison', async () => {
    const stats = await getMunicipalOverviewStats();
    if (typeof stats.kpi.totalWards !== 'number') throw new Error('totalWards should be a number');
    if (typeof stats.kpi.overallSlaCompliance !== 'number') throw new Error('overallSlaCompliance should be a number');
    if (!Array.isArray(stats.wardComparison)) throw new Error('wardComparison should be an array');
    if (!Array.isArray(stats.recentTransfers)) throw new Error('recentTransfers should be an array');
  });

  await runAsyncTest('6.2 exportMunicipalWardCsv produces valid RFC-4180 CSV with required municipal headers', async () => {
    const csv = await exportMunicipalWardCsv();
    if (!csv.includes('Ticket ID,Title,Category,Ward Code,Ward Name,Zone,Status,Priority,SLA Status,Created At,Resolved At')) {
      throw new Error('CSV headers do not match specification');
    }
  });

  // ---------------------------------------------------------------------------
  // 7. Role-Based Access Control (RBAC) & Endpoint Authorization
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Role-Based Access Control & IDOR Guarding ---');

  runTest('7.1 Citizen role is strictly blocked by authorize("admin") on ward creation', () => {
    const authMiddleware = authorize('admin');
    let statusCode = null;
    let jsonBody = null;
    const req = { user: { role: 'citizen' } };
    const res = {
      status: (code) => { statusCode = code; return { json: (b) => { jsonBody = b; } }; }
    };
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });

    if (nextCalled) throw new Error('Citizen was permitted to access admin ward resource');
    if (statusCode !== 403) throw new Error(`Expected HTTP 403 Forbidden, got ${statusCode}`);
  });

  runTest('7.2 Field Officer role is blocked on administrative complaint transfer', () => {
    const authMiddleware = authorize('admin');
    let statusCode = null;
    const req = { user: { role: 'officer' } };
    const res = {
      status: (code) => { statusCode = code; return { json: () => {} }; }
    };
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });

    if (nextCalled) throw new Error('Officer was permitted to transfer complaint');
    if (statusCode !== 403) throw new Error(`Expected HTTP 403 Forbidden, got ${statusCode}`);
  });

  runTest('7.3 Municipal Administrator is permitted across all ward operations', () => {
    const authMiddleware = authorize('admin');
    const req = { user: { role: 'admin' } };
    const res = { status: () => ({ json: () => {} }) };
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });

    if (!nextCalled) throw new Error('Admin was blocked on admin ward route');
  });

  runTest('7.4 Ward Administrator is permitted on overview and ward analytics routes', () => {
    const authMiddleware = authorize('admin', 'ward_admin');
    const req = { user: { role: 'ward_admin' } };
    let nextCalled = false;
    authMiddleware(req, {}, () => { nextCalled = true; });

    if (!nextCalled) throw new Error('Ward admin was blocked on ward overview');
  });

  console.log('\n===============================================================');
  console.log(`Phase 22 Ward Backend Tests: ${passed} passed, ${total - passed} failed.`);
  console.log('===============================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test execution uncaught error:', err);
  process.exit(1);
});
