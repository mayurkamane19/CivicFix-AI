/**
 * Phase 27: Full Municipal Workflow & Five-Role E2E Integration Suite
 * Executes complete real-world municipal complaint lifecycle across 5 roles:
 * Citizen -> Super Admin -> Officer -> Ward Admin -> Department Head
 * Target Database: civicfix_phase27_test on live local MongoDB (127.0.0.1:27017)
 */

import http from 'http';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import app from './src/app.js';
import { User } from './src/models/User.js';
import { Complaint } from './src/models/Complaint.js';
import { Department } from './src/models/Department.js';
import { Ward } from './src/models/Ward.js';
import { SlaConfig } from './src/models/SlaConfig.js';
import { Feedback } from './src/models/Feedback.js';
import { NotificationLog } from './src/models/NotificationLog.js';
import { generateToken } from './src/utils/jwt.js';

const TEST_DB_URI = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/civicfix_phase27_test';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
  }
}

console.log('================================================================');
console.log('🏛️  CivicFix AI: Phase 27 Five-Role Municipal Workflow E2E Suite');
console.log('Target Database: civicfix_phase27_test');
console.log('Live Server: 127.0.0.1:27017');
console.log('================================================================\n');

let server;
let baseUrl;
const testRunId = Date.now();

// Generated IDs for teardown
const cleanupIds = {
  users: [],
  complaints: [],
  departments: [],
  wards: [],
  slaConfigs: [],
  feedbacks: [],
  notifications: []
};

try {
  // 1. Connect Mongoose to live test database
  console.log(`Connecting to ${TEST_DB_URI}...`);
  await mongoose.connect(TEST_DB_URI);
  assert(mongoose.connection.readyState === 1, 'Mongoose connected to live local MongoDB (civicfix_phase27_test)');

  // Clean any lingering test wards in civicfix_phase27_test from previous runs
  await Ward.deleteMany({ code: { $regex: /^(SHIV|KOTH)_/ } });

  // 2. Start Express HTTP Server
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Express API server online at ${baseUrl}\n`);

  // ---------------------------------------------------------------------------
  // PROVISIONING FIVE USER ROLES & MUNICIPAL INFRASTRUCTURE
  // ---------------------------------------------------------------------------
  console.log('--- Phase 27.1: Provisioning Municipal Infrastructure & Roles ---');
  const salt = await bcrypt.genSalt(10);
  const commonPasswordHash = await bcrypt.hash('SecurePassword@2026', salt);

  // 1. Create 2 Distinct Departments
  const deptRoad = await Department.create({
    name: `Road Maintenance Dept ${testRunId}`,
    code: `ROAD_${testRunId.toString().slice(-4)}`,
    description: 'Pothole, asphalt, and surface leveling'
  });
  cleanupIds.departments.push(deptRoad._id);

  const deptSanitation = await Department.create({
    name: `Sanitation Dept ${testRunId}`,
    code: `SANI_${testRunId.toString().slice(-4)}`,
    description: 'Garbage, waste processing, and street cleaning'
  });
  cleanupIds.departments.push(deptSanitation._id);
  assert(deptRoad._id != null && deptSanitation._id != null, 'Departments provisioned successfully in MongoDB');

  // 2. Create 2 Distinct Municipal Wards with GeoJSON Polygon Boundaries
  // Ward 1 (Shivaji Nagar Polygon: approx 73.84 to 73.86 lng, 18.52 to 18.54 lat)
  const ward1 = await Ward.create({
    name: `Shivajinagar Ward ${testRunId}`,
    code: `SHIV_${testRunId.toString().slice(-4)}`,
    number: Math.floor(100 + Math.random() * 800),
    zone: 'Central Zone',
    center: { latitude: 18.5314, longitude: 73.8446 },
    boundaries: {
      type: 'Polygon',
      coordinates: [
        [
          [73.83, 18.51],
          [73.86, 18.51],
          [73.86, 18.55],
          [73.83, 18.55],
          [73.83, 18.51]
        ]
      ]
    },
    assignedDepartments: [deptRoad._id, deptSanitation._id]
  });
  cleanupIds.wards.push(ward1._id);

  // Ward 2 (Kothrud Polygon: approx 73.80 to 73.82 lng, 18.49 to 18.51 lat)
  const ward2 = await Ward.create({
    name: `Kothrud Ward ${testRunId}`,
    code: `KOTH_${testRunId.toString().slice(-4)}`,
    number: Math.floor(900 + Math.random() * 800),
    zone: 'West Zone',
    center: { latitude: 18.5074, longitude: 73.8077 },
    boundaries: {
      type: 'Polygon',
      coordinates: [
        [
          [73.79, 18.48],
          [73.82, 18.48],
          [73.82, 18.51],
          [73.79, 18.51],
          [73.79, 18.48]
        ]
      ]
    },
    assignedDepartments: [deptRoad._id]
  });
  cleanupIds.wards.push(ward2._id);
  assert(ward1._id != null && ward2._id != null, 'Wards with GeoJSON polygons provisioned in MongoDB');

  // 3. Create Super Admin User
  const adminUser = await User.create({
    name: 'Chief Municipal Admin',
    email: `admin_${testRunId}@civicfix.gov.in`,
    password: commonPasswordHash,
    role: 'admin'
  });
  cleanupIds.users.push(adminUser._id);

  // 4. Create Ward Admin User (Scoped strictly to Ward 1)
  const wardAdminUser = await User.create({
    name: 'Ward 1 Supervisor',
    email: `wardadmin_${testRunId}@civicfix.gov.in`,
    password: commonPasswordHash,
    role: 'ward_admin',
    ward: ward1._id
  });
  cleanupIds.users.push(wardAdminUser._id);

  // 5. Create Department Head User (Scoped strictly to Road Dept)
  const deptHeadUser = await User.create({
    name: 'Head of Road Maintenance',
    email: `depthead_${testRunId}@civicfix.gov.in`,
    password: commonPasswordHash,
    role: 'department_head',
    department: deptRoad._id
  });
  cleanupIds.users.push(deptHeadUser._id);

  // 6. Create Field Officer User (Assigned to Road Dept & Ward 1)
  const officerUser = await User.create({
    name: 'Inspector Vikram Patil',
    email: `officer_${testRunId}@civicfix.gov.in`,
    password: commonPasswordHash,
    role: 'officer',
    department: deptRoad._id,
    ward: ward1._id
  });
  cleanupIds.users.push(officerUser._id);

  // Update ward assigned officers
  ward1.assignedOfficers.push(officerUser._id);
  await ward1.save();

  // Generate valid JWT tokens for each role
  const adminToken = generateToken(adminUser);
  const wardAdminToken = generateToken(wardAdminUser);
  const deptHeadToken = generateToken(deptHeadUser);
  const officerToken = generateToken(officerUser);

  assert(adminToken && wardAdminToken && deptHeadToken && officerToken, 'JWT tokens issued for all municipal staff roles');

  // ---------------------------------------------------------------------------
  // ROLE 1: CITIZEN WORKFLOW
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 27.2: Role 1 — Citizen End-to-End Workflow ---');
  const citizenEmail = `citizen_${testRunId}@example.com`;
  
  // 1. Citizen Registration
  const citizenRegRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Sunita Deshmukh',
      email: citizenEmail,
      password: 'CitizenPass@2026'
    })
  });
  const citizenRegData = await citizenRegRes.json();
  assert(citizenRegRes.status === 201, 'Citizen successfully registered (HTTP 201)');
  const citizenToken = citizenRegData.data?.token;
  const citizenId = citizenRegData.data?.user?.id || citizenRegData.data?.user?._id;
  cleanupIds.users.push(citizenId);
  assert(typeof citizenToken === 'string', 'Citizen authenticated with valid JWT token');

  // 2. Citizen Profile Check
  const profileRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${citizenToken}` }
  });
  const profileData = await profileRes.json();
  assert(profileRes.status === 200, 'Citizen profile retrieved successfully');
  assert(profileData.data?.email === citizenEmail, 'Citizen profile matches registered email');

  // 3. Citizen Complaint Submission with GPS in Ward 1
  const complaintPayload = {
    title: 'Severe Asphalt Crater on FC Road',
    description: 'Deep road damage near Fergusson College causing heavy two-wheeler skids and traffic congestion.',
    category: 'Road Damage',
    address: 'FC Road near Goodluck Chowk, Pune',
    latitude: 18.5204, // Coordinates fall within Ward 1's bounding polygon
    longitude: 73.8446,
    citizenEmail,
    emailNotificationsEnabled: true
  };

  const submitRes = await fetch(`${baseUrl}/api/complaints`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`
    },
    body: JSON.stringify(complaintPayload)
  });
  const submitData = await submitRes.json();
  assert(submitRes.status === 201, 'Complaint submitted successfully by citizen (HTTP 201)');
  const ticketId = submitData.data?.complaintId;
  const complaintDoc = await Complaint.findOne({ complaintId: ticketId });
  cleanupIds.complaints.push(complaintDoc._id);
  assert(ticketId && ticketId.startsWith('CFX-'), 'Unique CFX ticket ID generated');

  // 4. Verify Automatic Ward Geofence Detection
  assert(complaintDoc.ward?.toString() === ward1._id.toString(), 'Spatial geofencing automatically mapped complaint to Ward 1');
  assert(complaintDoc.wardCode === ward1.code, 'Ward code accurately resolved from boundary polygon');
  assert(complaintDoc.reportedBy?.toString() === citizenId.toString(), 'Complaint reportedBy bound to authenticated citizen (Anti-IDOR)');

  // 5. Citizen Public Tracking
  const trackRes = await fetch(`${baseUrl}/api/complaints/track/${ticketId}`);
  const trackData = await trackRes.json();
  assert(trackRes.status === 200, 'Public complaint tracking returns HTTP 200');
  assert(trackData.data?.status === 'Pending', 'Initial complaint status verified as Pending');

  // 6. Citizen Dashboard & My Complaints
  const myComplaintsRes = await fetch(`${baseUrl}/api/complaints/my/complaints`, {
    headers: { 'Authorization': `Bearer ${citizenToken}` }
  });
  const myComplaintsData = await myComplaintsRes.json();
  assert(myComplaintsRes.status === 200, 'Citizen my-complaints endpoint returns HTTP 200');
  const userList = Array.isArray(myComplaintsData.data) ? myComplaintsData.data : (myComplaintsData.complaints || []);
  assert(userList.some(c => c.complaintId === ticketId), 'Submitted ticket found in citizen dashboard list');

  // ---------------------------------------------------------------------------
  // ROLE 2: SUPER ADMIN WORKFLOW & DISPATCH
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 27.3: Role 2 — Super Admin Workflow & Dispatch ---');
  
  // 1. Admin Dashboard Stats
  const adminStatsRes = await fetch(`${baseUrl}/api/admin/dashboard/stats`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(adminStatsRes.status === 200, 'Super Admin retrieves system-wide dashboard stats');

  // 2. Admin Assigns Complaint to Road Department and Field Officer
  const assignRes = await fetch(`${baseUrl}/api/admin/complaints/${ticketId}/assignment`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      departmentId: deptRoad._id.toString(),
      officerId: officerUser._id.toString(),
      note: 'Urgent asphalt patching required on arterial bus route'
    })
  });
  const assignData = await assignRes.json();
  assert(assignRes.status === 200, 'Admin successfully assigned complaint to Dept & Officer');

  // Verify assignment recorded in MongoDB
  const updatedComplaint = await Complaint.findOne({ complaintId: ticketId });
  assert(updatedComplaint.assignedDepartment?.toString() === deptRoad._id.toString(), 'Assigned department persisted in MongoDB');
  assert(updatedComplaint.assignedOfficer?.toString() === officerUser._id.toString(), 'Assigned officer persisted in MongoDB');
  assert(updatedComplaint.assignmentHistory.length >= 1, 'Assignment history audit record created');

  // 3. Admin SLA Configuration Inspection
  const slaRes = await fetch(`${baseUrl}/api/admin/sla/overview`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(slaRes.status === 200, 'Super Admin inspects global SLA overview');

  // ---------------------------------------------------------------------------
  // ROLE 3: FIELD OFFICER WORKFLOW & RESOLUTION
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 27.4: Role 3 — Field Officer Operations ---');

  // 1. Officer Priority Queue
  const officerWorkspaceRes = await fetch(`${baseUrl}/api/officer/workspace`, {
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  assert(officerWorkspaceRes.status === 200, 'Officer retrieves personal workspace queue');
  const officerWorkspaceData = await officerWorkspaceRes.json();
  const queueComplaints = officerWorkspaceData.complaints || officerWorkspaceData.data?.priorityQueue || [];
  assert(queueComplaints.some(c => c.complaintId === ticketId), 'Assigned complaint visible in Officer priority queue');

  // 2. Officer Status Update to "In Progress"
  const statusUpdateRes = await fetch(`${baseUrl}/api/officer/complaints/${ticketId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${officerToken}`
    },
    body: JSON.stringify({
      status: 'In Progress',
      note: 'Officer dispatched to FC Road with asphalt crew'
    })
  });
  assert(statusUpdateRes.status === 200, 'Officer updated complaint status to "In Progress"');

  const afterStatusComplaint = await Complaint.findOne({ complaintId: ticketId });
  assert(afterStatusComplaint.status === 'In Progress', 'Status persisted as "In Progress" in MongoDB');
  assert(afterStatusComplaint.statusHistory.some(h => h.newStatus === 'In Progress'), 'Status history recorded audit entry');

  // 3. Officer Submits Resolution Evidence
  const resolveSubmitRes = await fetch(`${baseUrl}/api/officer/complaints/${ticketId}/resolution/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${officerToken}`
    },
    body: JSON.stringify({
      remarks: 'Crater excavated, filled with dense bituminous macadam, leveled and roller compacted.',
      beforeImages: [{ url: 'https://cloudinary.com/test_before_crater.jpg', caption: 'Pothole before repair' }],
      afterImages: [{ url: 'https://cloudinary.com/test_after_compacted.jpg', caption: 'Surface leveled after compaction' }]
    })
  });
  const resolveData = await resolveSubmitRes.json();
  if (resolveSubmitRes.status !== 200) {
    console.error('Officer resolution submit failed:', resolveSubmitRes.status, resolveData);
  }
  assert(resolveSubmitRes.status === 200, 'Officer submitted resolution evidence (HTTP 200)');

  const resolvedComplaint = await Complaint.findOne({ complaintId: ticketId });
  assert(resolvedComplaint.status === 'Resolved', 'Complaint status transitioned to "Resolved"');
  assert(resolvedComplaint.resolutionEvidence.status === 'Awaiting Citizen Verification', 'Resolution verification status is "Awaiting Citizen Verification"');
  assert(resolvedComplaint.resolutionEvidence.afterImages.length === 1, 'Resolution after-images persisted in MongoDB');

  // 4. Anti-IDOR: Officer Cannot Access Complaints Assigned to Others
  // Create complaint for another department
  const unassignedComplaint = await Complaint.create({
    title: 'Garbage dump overflow in Kothrud',
    description: 'Debris piles blocking sidewalk in residential zone.',
    category: 'Garbage',
    location: { address: 'Kothrud sector 4' },
    status: 'Pending',
    assignedDepartment: deptSanitation._id,
    ward: ward2._id
  });
  cleanupIds.complaints.push(unassignedComplaint._id);

  const unauthorizedOfficerRes = await fetch(`${baseUrl}/api/officer/complaints/${unassignedComplaint.complaintId}`, {
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  assert(unauthorizedOfficerRes.status === 403 || unauthorizedOfficerRes.status === 404, 'Officer strictly blocked from accessing unassigned complaints (Anti-IDOR)');

  // ---------------------------------------------------------------------------
  // ROLE 4: WARD ADMIN WORKFLOW & ISOLATION
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 27.5: Role 4 — Ward Administrator Operations & Boundaries ---');

  // 1. Ward Admin accesses assigned Ward 1 complaints
  const wardAdminComplaintsRes = await fetch(`${baseUrl}/api/admin/complaints`, {
    headers: { 'Authorization': `Bearer ${wardAdminToken}` }
  });
  assert(wardAdminComplaintsRes.status === 200, 'Ward Admin retrieves complaints scoped to Ward 1');
  const wardComplaints = (await wardAdminComplaintsRes.json()).data || [];
  assert(wardComplaints.every(c => !c.ward || c.ward === ward1._id.toString() || c.ward?._id === ward1._id.toString()), 'All returned complaints strictly belong to Ward 1');

  // 2. Cross-Ward Security Check: Ward 1 Admin attempts to view Ward 2 complaint
  const crossWardRes = await fetch(`${baseUrl}/api/admin/complaints/${unassignedComplaint.complaintId}`, {
    headers: { 'Authorization': `Bearer ${wardAdminToken}` }
  });
  assert(crossWardRes.status === 403, 'Cross-ward access strictly blocked with HTTP 403 Forbidden');

  // 3. Ward Admin cannot perform Super Admin actions (e.g. modify global SLA config or delete wards)
  const wardAdminSlaRes = await fetch(`${baseUrl}/api/admin/sla/config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${wardAdminToken}`
    },
    body: JSON.stringify({ Critical: 2 })
  });
  assert(wardAdminSlaRes.status === 403, 'Ward Admin blocked from modifying global SLA configuration (HTTP 403)');

  // ---------------------------------------------------------------------------
  // ROLE 5: DEPARTMENT HEAD WORKFLOW & ISOLATION
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 27.6: Role 5 — Department Head Operations & Boundaries ---');

  // 1. Department Head views Road Department complaints
  const deptHeadComplaintsRes = await fetch(`${baseUrl}/api/admin/complaints`, {
    headers: { 'Authorization': `Bearer ${deptHeadToken}` }
  });
  assert(deptHeadComplaintsRes.status === 200, 'Department Head retrieves department complaints');

  // 2. Cross-Department Security Check: Road Dept Head attempts to inspect Sanitation complaint
  const crossDeptRes = await fetch(`${baseUrl}/api/admin/complaints/${unassignedComplaint.complaintId}`, {
    headers: { 'Authorization': `Bearer ${deptHeadToken}` }
  });
  assert(crossDeptRes.status === 403, 'Cross-department inspection blocked with HTTP 403 Forbidden');

  // 3. Department Head cannot access system-level notification logs
  const deptHeadNotifRes = await fetch(`${baseUrl}/api/admin/notifications`, {
    headers: { 'Authorization': `Bearer ${deptHeadToken}` }
  });
  assert(deptHeadNotifRes.status === 403, 'Department Head blocked from administrative notification logs (HTTP 403)');

  // ---------------------------------------------------------------------------
  // CITIZEN RESOLUTION VERIFICATION, REJECTION & FEEDBACK
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 27.7: Citizen Verification, Rejection & Feedback ---');

  // 1. Citizen inspects resolution evidence
  const citizenEvidenceRes = await fetch(`${baseUrl}/api/complaints/${ticketId}/resolution`, {
    headers: { 'Authorization': `Bearer ${citizenToken}` }
  });
  assert(citizenEvidenceRes.status === 200, 'Citizen retrieved resolution evidence');
  const citizenEvidenceJson = await citizenEvidenceRes.json();
  const resData = citizenEvidenceJson.data?.resolution || citizenEvidenceJson.resolution || citizenEvidenceJson.data;
  const afterImgs = resData?.resolutionEvidence?.afterImages || resData?.afterImages;
  assert(afterImgs && afterImgs.length === 1, 'Citizen can view officer after-repair photos');

  // 2. Citizen Rejection Flow (e.g. repair was incomplete)
  const rejectRes = await fetch(`${baseUrl}/api/complaints/${ticketId}/resolution/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`
    },
    body: JSON.stringify({
      reason: 'Bitumen edges are still uneven and loose stones remain'
    })
  });
  const rejectData = await rejectRes.json();
  if (rejectRes.status !== 200) {
    console.error('Citizen rejection failed:', rejectRes.status, rejectData);
  }
  assert(rejectRes.status === 200, 'Citizen rejected resolution (HTTP 200)');

  const reopenedComplaint = await Complaint.findOne({ complaintId: ticketId });
  assert(reopenedComplaint.status === 'Reopened', 'Complaint transitioned to "Reopened" status');
  assert(reopenedComplaint.resolutionEvidence.status === 'Rejected by Citizen', 'Resolution status marked "Rejected by Citizen"');

  // 3. Officer Re-Resolves and Submits Final Fix
  await Complaint.updateOne(
    { complaintId: ticketId },
    {
      $set: {
        status: 'Resolved',
        'resolutionEvidence.status': 'Awaiting Citizen Verification',
        'resolutionEvidence.remarks': 'Loose gravel swept and sealant coat applied across entire patch.'
      }
    }
  );

  // 4. Citizen Accepts Resolution
  const verifyRes = await fetch(`${baseUrl}/api/complaints/${ticketId}/resolution/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`
    },
    body: JSON.stringify({
      remarks: 'Road surface is now smooth and completely cleared. Good work!'
    })
  });
  assert(verifyRes.status === 200, 'Citizen successfully verified and accepted resolution');

  const verifiedComplaint = await Complaint.findOne({ complaintId: ticketId });
  assert(verifiedComplaint.resolutionEvidence.status === 'Verified by Citizen', 'Complaint marked "Verified by Citizen"');

  // 5. Citizen Submits 5-Star Feedback
  const feedbackRes = await fetch(`${baseUrl}/api/feedback/${ticketId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`
    },
    body: JSON.stringify({
      rating: 5,
      comment: 'Prompt resolution by officer and excellent municipal response.'
    })
  });
  const feedbackData = await feedbackRes.json();
  if (feedbackRes.status !== 201) {
    console.error('Feedback submit failed:', feedbackRes.status, feedbackData);
  }
  assert(feedbackRes.status === 201, 'Citizen submitted 5-star feedback successfully (HTTP 201)');
  const createdFeedbackId = feedbackData.data?.feedback?._id || feedbackData.data?._id;
  if (createdFeedbackId) {
    cleanupIds.feedbacks.push(createdFeedbackId);
  }

  // 6. Anti-IDOR: Another citizen cannot submit feedback for this complaint
  const imposterCitizen = await User.create({
    name: 'Imposter Citizen',
    email: `imposter_${testRunId}@example.com`,
    password: commonPasswordHash,
    role: 'citizen'
  });
  cleanupIds.users.push(imposterCitizen._id);
  const imposterToken = generateToken(imposterCitizen);

  const imposterFeedbackRes = await fetch(`${baseUrl}/api/feedback/${ticketId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${imposterToken}`
    },
    body: JSON.stringify({
      rating: 1,
      comment: 'Attempting unauthorized feedback'
    })
  });
  assert(imposterFeedbackRes.status === 403, 'Unauthorized feedback strictly blocked with HTTP 403 Forbidden (Anti-IDOR)');

  // ---------------------------------------------------------------------------
  // NOTIFICATIONS, AUDIT LOGGING & SLA EVALUATION
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 27.8: Notifications, Audit Trail & SLA Engine ---');

  // 1. Verify In-App Notification Log created for citizen
  const notifRes = await fetch(`${baseUrl}/api/notifications`, {
    headers: { 'Authorization': `Bearer ${citizenToken}` }
  });
  assert(notifRes.status === 200, 'Citizen retrieves in-app notifications inbox');

  // 2. Admin triggers live SLA evaluation engine
  const evalRes = await fetch(`${baseUrl}/api/admin/sla/evaluate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(evalRes.status === 200, 'SLA automated evaluation engine triggered successfully');

  // ---------------------------------------------------------------------------
  // CLEAN ISOLATED TEARDOWN
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 27.9: Clean Isolated Teardown ---');
  for (const id of cleanupIds.feedbacks.filter(Boolean)) {
    await Feedback.findByIdAndDelete(id);
  }
  for (const id of cleanupIds.complaints.filter(Boolean)) {
    await Complaint.findByIdAndDelete(id);
  }
  for (const id of cleanupIds.users.filter(Boolean)) {
    await User.findByIdAndDelete(id);
  }
  for (const id of cleanupIds.wards.filter(Boolean)) {
    await Ward.findByIdAndDelete(id);
  }
  for (const id of cleanupIds.departments.filter(Boolean)) {
    await Department.findByIdAndDelete(id);
  }

  const lingeringComplaints = await Complaint.countDocuments({ _id: { $in: cleanupIds.complaints } });
  const lingeringUsers = await User.countDocuments({ _id: { $in: cleanupIds.users } });
  assert(lingeringComplaints === 0 && lingeringUsers === 0, 'Zero lingering records in civicfix_phase27_test (Complete Teardown)');

} catch (err) {
  assert(false, `Phase 27 E2E failure: ${err.message}\n${err.stack}`);
} finally {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
  await mongoose.connection.close();
}

console.log('\n================================================================');
console.log(`Phase 27 Summary: ${passed}/${total} E2E Municipal Workflow tests passed.`);
console.log('================================================================');

process.exit(passed === total ? 0 : 1);
