/**
 * Phase 26: Live HTTP API Integration Test Suite
 * Tests actual Express HTTP endpoints against live MongoDB Community Server
 * Target Database: civicfix_phase26_test (Dedicated isolated test DB)
 */

import http from 'http';
import mongoose from 'mongoose';
import app from './src/app.js';
import { User } from './src/models/User.js';
import { Complaint } from './src/models/Complaint.js';

const TEST_DB_URI = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/civicfix_phase26_test';

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

console.log('====================================================');
console.log('🌐 CivicFix AI: Phase 26 Live HTTP API Integration');
console.log('Target Database: civicfix_phase26_test');
console.log('Server: 127.0.0.1:27017 (Local MongoDB)');
console.log('====================================================\n');

let server;
let baseUrl;
const testRunId = Date.now();
const testEmail = `live_citizen_${testRunId}@civicfix.internal`;
const testPassword = 'Password123!';

let authToken = null;
let registeredUserId = null;
let createdComplaintTicketId = null;
let createdComplaintDocId = null;

try {
  // 1. Connect Mongoose to live test database
  console.log(`Connecting Mongoose to ${TEST_DB_URI}...`);
  await mongoose.connect(TEST_DB_URI);
  assert(mongoose.connection.readyState === 1, 'Mongoose connected to live local MongoDB');

  // 2. Start HTTP server on dynamic port
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Express server running for test at ${baseUrl}\n`);

  // 3. GET /api/health
  console.log('--- 1. Live Health Check Endpoint ---');
  const healthRes = await fetch(`${baseUrl}/api/health`);
  const healthData = await healthRes.json();
  assert(healthRes.status === 200, 'GET /api/health returned HTTP 200');
  assert(healthData.status === 'healthy', 'Health check reports status "healthy"');
  assert(healthData.database === 'connected', 'Health check reports database "connected" with live MongoDB');

  // 4. POST /api/auth/register
  console.log('\n--- 2. Live User Registration (POST /api/auth/register) ---');
  const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Phase 26 Live Citizen',
      email: testEmail,
      password: testPassword
    })
  });
  const registerData = await registerRes.json();
  assert(registerRes.status === 201, 'POST /api/auth/register returned HTTP 201');
  assert(registerData.success === true, 'Registration payload returns success: true');
  assert(registerData.data && registerData.data.token, 'Registration returns valid JWT authentication token');
  registeredUserId = registerData.data.user?.id || registerData.data.user?._id;
  assert(registeredUserId != null, 'Registered user ObjectId returned in response');

  // Verify directly in live MongoDB
  const dbUser = await User.findById(registeredUserId);
  assert(dbUser != null, 'User document confirmed physically persisted in live MongoDB');
  assert(dbUser.email === testEmail, 'Persisted user email matches registered input');

  // 5. POST /api/auth/login
  console.log('\n--- 3. Live User Authentication (POST /api/auth/login) ---');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword
    })
  });
  const loginData = await loginRes.json();
  assert(loginRes.status === 200, 'POST /api/auth/login returned HTTP 200');
  assert(loginData.success === true, 'Login payload returns success: true');
  authToken = loginData.data?.token;
  assert(typeof authToken === 'string' && authToken.length > 20, 'Login returned valid JWT token from live DB user');

  // 6. POST /api/complaints
  console.log('\n--- 4. Live Complaint Submission (POST /api/complaints) ---');
  const complaintPayload = {
    title: 'Severe Water Leakage on Phase 26 Avenue',
    description: 'Main municipal water supply pipeline fractured, causing street flooding and low water pressure.',
    category: 'Water Leakage',
    address: 'Phase 26 Avenue, Shivaji Nagar, Pune',
    latitude: 18.5314,
    longitude: 73.8446,
    citizenEmail: testEmail,
    emailNotificationsEnabled: false
  };

  const submitRes = await fetch(`${baseUrl}/api/complaints`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(complaintPayload)
  });
  const submitData = await submitRes.json();
  assert(submitRes.status === 201, 'POST /api/complaints returned HTTP 201 Created');
  assert(submitData.success === true, 'Complaint submission returned success: true');
  createdComplaintTicketId = submitData.data?.complaintId;
  createdComplaintDocId = submitData.data?._id || submitData.data?.id;
  assert(createdComplaintTicketId && createdComplaintTicketId.startsWith('CFX-'), 'Unique CFX ticket generated by API');

  // Verify complaint in live MongoDB
  const dbComplaint = await Complaint.findOne({ complaintId: createdComplaintTicketId });
  assert(dbComplaint != null, 'Complaint document confirmed physically saved in live MongoDB');
  if (dbComplaint) {
    createdComplaintDocId = dbComplaint._id;
  }
  assert(dbComplaint?.title === complaintPayload.title, 'Complaint title matches submission payload');
  assert(dbComplaint?.status === 'Pending', 'Initial complaint status defaults to "Pending"');
  assert(dbComplaint?.reportedBy?.toString() === registeredUserId.toString(), 'Complaint reportedBy matches authenticated citizen');

  // 7. GET /api/complaints/track/:complaintId
  console.log('\n--- 5. Public Complaint Tracking (GET /api/complaints/track/:id) ---');
  const trackRes = await fetch(`${baseUrl}/api/complaints/track/${createdComplaintTicketId}`);
  const trackData = await trackRes.json();
  assert(trackRes.status === 200, 'GET /api/complaints/track/:id returned HTTP 200');
  assert(trackData.success === true, 'Track response returned success: true');
  assert(trackData.data?.complaintId === createdComplaintTicketId, 'Tracked complaint ID matches created ticket');
  assert(trackData.data?.status === 'Pending', 'Tracked complaint status verified from live MongoDB');

  // 8. GET /api/complaints/my/complaints
  console.log('\n--- 6. Authenticated Citizen Complaint List (GET /api/complaints/my/complaints) ---');
  const myComplaintsRes = await fetch(`${baseUrl}/api/complaints/my/complaints`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const myComplaintsData = await myComplaintsRes.json();
  assert(myComplaintsRes.status === 200, 'GET /api/complaints/my/complaints returned HTTP 200');
  const complaintList = Array.isArray(myComplaintsData.data) ? myComplaintsData.data : (myComplaintsData.complaints || []);
  assert(Array.isArray(complaintList), 'Citizen complaints array returned');
  const userComplaintInList = complaintList.find(c => c.complaintId === createdComplaintTicketId);
  assert(userComplaintInList != null, 'Submitted complaint found in citizen dashboard list from live MongoDB');

  // 9. Cleanup isolated test data
  console.log('\n--- 7. Isolated Cleanup ---');
  if (createdComplaintDocId) {
    await Complaint.findByIdAndDelete(createdComplaintDocId);
  }
  if (registeredUserId) {
    await User.findByIdAndDelete(registeredUserId);
  }
  const cleanComplaint = await Complaint.findById(createdComplaintDocId);
  const cleanUser = await User.findById(registeredUserId);
  assert(cleanComplaint === null && cleanUser === null, 'Test user and complaint cleanly removed from civicfix_phase26_test');

} catch (err) {
  assert(false, `Live API error occurred: ${err.message}`);
} finally {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
  await mongoose.connection.close();
}

console.log('\n====================================================');
console.log(`Summary: ${passed}/${total} Live HTTP API tests passed.`);
console.log('====================================================');

process.exit(passed === total ? 0 : 1);
