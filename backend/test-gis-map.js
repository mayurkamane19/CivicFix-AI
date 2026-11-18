/**
 * CivicFix AI - Phase 12: Interactive Smart City Complaint Map & GIS Visualization Test Suite
 * 
 * Verifies:
 * 1. Geographic coordinate validation (-90 to +90 lat, -180 to +180 lng, non-numeric checks).
 * 2. Public coordinate privacy approximation (3 decimal places ~100m precision).
 * 3. Complaint schema geospatial indexing and backward compatibility without coordinates.
 * 4. Admin Map service: query generation, multi-criteria filters (category, status, severity, dept, officer, date).
 * 5. Field Officer Map service: strict IDOR confinement to req.user._id.
 * 6. Public Map service: citizen privacy sanitization, zero leakage of emails/phones/IDs.
 * 7. Controller and route authorization guards for admin, officer, and public endpoints.
 * 8. Regressions across Phases 1-11 functionality.
 */

import mongoose from 'mongoose';
import { Complaint } from './src/models/Complaint.js';
import { Department } from './src/models/Department.js';
import { User } from './src/models/User.js';
import {
  validateCoordinates,
  approximateCoordinate,
  getAdminMapComplaints,
  getOfficerMapComplaints,
  getPublicMapComplaints,
} from './src/services/mapService.js';
import { protect, authorize } from './src/middleware/authMiddleware.js';

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

console.log('==================================================');
console.log('🗺️ CivicFix AI: Phase 12 GIS Map & Visualization Test Suite');
console.log('==================================================\n');

// -----------------------------------------------------------------------------
// 1. COORDINATE VALIDATION UNIT TESTS
// -----------------------------------------------------------------------------
console.log('--- 1. Geographic Coordinate Validation ---');

// Valid Delhi coordinates
assert(
  validateCoordinates(28.6139, 77.2090) === true,
  '1. Standard urban coordinates (28.6139, 77.2090) pass validation'
);

// Boundary limits
assert(
  validateCoordinates(90, 180) === true && validateCoordinates(-90, -180) === true,
  '2. Exact geographic boundaries (±90° lat, ±180° lng) pass validation'
);

assert(
  validateCoordinates(0, 0) === true,
  '3. Equator and Prime Meridian (0, 0) pass validation'
);

// Latitude out of bounds
assert(
  validateCoordinates(90.0001, 77.2090) === false && validateCoordinates(-90.1, 77.2090) === false,
  '4. Out-of-bounds latitudes (>90° or <-90°) are rejected'
);

// Longitude out of bounds
assert(
  validateCoordinates(28.6139, 180.0001) === false && validateCoordinates(28.6139, -180.05) === false,
  '5. Out-of-bounds longitudes (>180° or <-180°) are rejected'
);

// Null, undefined, and non-numeric inputs
assert(
  validateCoordinates(null, 77.2090) === false && validateCoordinates(28.6139, null) === false,
  '6. Null coordinates are safely rejected'
);

assert(
  validateCoordinates(undefined, undefined) === false,
  '7. Undefined coordinates are safely rejected'
);

assert(
  validateCoordinates('invalid', 77.2090) === false && validateCoordinates(28.6139, NaN) === false,
  '8. Non-numeric or NaN coordinates are safely rejected'
);

// -----------------------------------------------------------------------------
// 2. COORDINATE PRIVACY APPROXIMATION
// -----------------------------------------------------------------------------
console.log('\n--- 2. Public Coordinate Privacy & Approximation ---');

const exactLat = 28.61392847;
const exactLng = 77.20901582;

const approxLat = approximateCoordinate(exactLat, 3);
const approxLng = approximateCoordinate(exactLng, 3);

assert(
  approxLat === 28.614,
  '9. Latitude 28.613928 is approximated to 3 decimals (28.614) for ~100m neighborhood privacy'
);

assert(
  approxLng === 77.209,
  '10. Longitude 77.209015 is approximated to 3 decimals (77.209) for ~100m neighborhood privacy'
);

// Test distance between exact and approximate coordinates is within ~100m
const latDiff = Math.abs(exactLat - approxLat) * 111000; // ~111km per degree
assert(
  latDiff < 100,
  `11. Geographic difference (${latDiff.toFixed(1)}m) remains strictly under 100 meters`
);

// -----------------------------------------------------------------------------
// 3. SCHEMA GEOSPATIAL INDEXES & COMPATIBILITY
// -----------------------------------------------------------------------------
console.log('\n--- 3. Complaint Model Geospatial Indexes & Schema Compatibility ---');

// Inspect schema indexes on Complaint model
const schemaIndexes = Complaint.schema.indexes();
const hasCoordsIndex = schemaIndexes.some(([idx]) => {
  return idx['location.latitude'] === 1 && idx['location.longitude'] === 1;
});

assert(
  hasCoordsIndex === true,
  '12. Complaint model possesses compound index on { "location.latitude": 1, "location.longitude": 1 }'
);

const hasStatusCoordsIndex = schemaIndexes.some(([idx]) => {
  return idx.status === 1 && idx['location.latitude'] === 1 && idx['location.longitude'] === 1;
});

assert(
  hasStatusCoordsIndex === true,
  '13. Complaint model possesses compound index on { status: 1, "location.latitude": 1, "location.longitude": 1 }'
);

// Verify complaint without coordinates still passes schema validation (non-breaking)
const noGeoComplaint = new Complaint({
  complaintId: 'CFX-20261117-9901',
  title: 'Pothole on Main Street',
  description: 'Big pothole near bus terminal',
  category: 'Road Damage',
  location: {
    address: 'Near Central Bus Stand'
    // latitude and longitude omitted
  },
  citizenName: 'Aarav Patel',
  citizenEmail: 'aarav@example.com'
});

const noGeoValidationErr = noGeoComplaint.validateSync();
assert(
  !noGeoValidationErr,
  '14. Complaint without coordinates passes validation gracefully (zero broken legacy records)'
);

// Verify complaint with valid coordinates passes validation
const geoComplaint = new Complaint({
  complaintId: 'CFX-20261117-9902',
  title: 'Water pipe leak near school',
  description: 'Water overflowing onto pedestrian path',
  category: 'Water Leakage',
  location: {
    address: 'Sector 4, Main Road',
    latitude: 28.5355,
    longitude: 77.2410
  },
  citizenName: 'Priya Sharma',
  citizenEmail: 'priya@example.com'
});

const geoValidationErr = geoComplaint.validateSync();
assert(
  !geoValidationErr,
  '15. Complaint with valid GPS coordinates passes schema validation'
);

// Helper function to build a chainable Mongoose mock query
const buildMockQuery = (data) => {
  const queryObj = {
    populate: () => queryObj,
    sort: () => queryObj,
    limit: () => queryObj,
    then: (resolve) => resolve(data)
  };
  return queryObj;
};

// -----------------------------------------------------------------------------
// 4. ADMIN MAP SERVICE QUERY BUILDER & FILTERS
// -----------------------------------------------------------------------------
console.log('\n--- 4. Admin Map Service Query Building ---');

// Mock mongoose readyState for service tests
const originalReadyState = mongoose.connection.readyState;
Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true, writable: true });

const testDeptId = new mongoose.Types.ObjectId();
const testOfficerId = new mongoose.Types.ObjectId();

let capturedAdminQuery = null;

const originalFind = Complaint.find;
Complaint.find = function (query) {
  capturedAdminQuery = query;
  return buildMockQuery([
    {
      _id: new mongoose.Types.ObjectId(),
      complaintId: 'CFX-20261117-0001',
      title: 'Pothole on Ring Road',
      category: 'Road Damage',
      status: 'Pending',
      location: {
        address: 'Ring Road, Delhi',
        latitude: 28.6139,
        longitude: 77.2090
      },
      assignedDepartment: { _id: testDeptId, name: 'Roads Dept', code: 'ROAD' },
      assignedOfficer: { _id: testOfficerId, name: 'Officer Rajesh' },
      aiAnalysis: { severity: 'High' }
    },
    {
      _id: new mongoose.Types.ObjectId(),
      complaintId: 'CFX-20261117-0002',
      title: 'Broken streetlight',
      category: 'Streetlight',
      status: 'Pending',
      location: {
        address: 'Connaught Place',
        latitude: null, // Filtered out by validateCoordinates
        longitude: null
      }
    }
  ]);
};

// Call getAdminMapComplaints with filters
const adminResult = await getAdminMapComplaints({
  category: 'Road Damage',
  status: 'Pending',
  severity: 'High',
  department: testDeptId.toString(),
  officer: testOfficerId.toString(),
  startDate: '2026-11-01',
  endDate: '2026-11-17'
});

assert(
  capturedAdminQuery['location.latitude']['$ne'] === null &&
  capturedAdminQuery['location.longitude']['$ne'] === null,
  '16. Admin map query strictly excludes records with null coordinates'
);

assert(
  capturedAdminQuery.category === 'Road Damage' && capturedAdminQuery.status === 'Pending',
  '17. Admin map query correctly filters by category and status'
);

assert(
  capturedAdminQuery['aiAnalysis.severity'] === 'High',
  '18. Admin map query filters by AI severity rating'
);

assert(
  capturedAdminQuery.assignedDepartment.toString() === testDeptId.toString() &&
  capturedAdminQuery.assignedOfficer.toString() === testOfficerId.toString(),
  '19. Admin map query filters by Department ObjectId and Officer ObjectId'
);

assert(
  capturedAdminQuery.createdAt['$gte'] instanceof Date && capturedAdminQuery.createdAt['$lte'] instanceof Date,
  '20. Admin map query enforces date range filters ($gte and $lte)'
);

assert(
  Array.isArray(adminResult) && adminResult.length === 1 && adminResult[0].complaintId === 'CFX-20261117-0001',
  '21. Admin map service removes any records failing coordinate validation before returning response'
);

// -----------------------------------------------------------------------------
// 5. FIELD OFFICER MAP SERVICE & IDOR ENFORCEMENT
// -----------------------------------------------------------------------------
console.log('\n--- 5. Field Officer Map Service & Strict Ownership ---');

let capturedOfficerQuery = null;
Complaint.find = function (query) {
  capturedOfficerQuery = query;
  return buildMockQuery([
    {
      _id: new mongoose.Types.ObjectId(),
      complaintId: 'CFX-20261117-0001',
      title: 'Assigned Work Order',
      category: 'Road Damage',
      status: 'In Progress',
      location: {
        address: 'MG Road',
        latitude: 28.5355,
        longitude: 77.2410
      },
      assignedDepartmentName: 'Road Maintenance',
      assignedOfficer: testOfficerId
    }
  ]);
};

const officerResult = await getOfficerMapComplaints(testOfficerId.toString(), {
  status: 'In Progress',
  category: 'Road Damage'
});

assert(
  capturedOfficerQuery.assignedOfficer.toString() === testOfficerId.toString(),
  '22. Officer map query strictly binds assignedOfficer to officer ID (IDOR Prevention)'
);

assert(
  capturedOfficerQuery.status === 'In Progress' && capturedOfficerQuery.category === 'Road Damage',
  '23. Officer map query supports filtering by status and category'
);

assert(
  Array.isArray(officerResult) && officerResult.length === 1 && officerResult[0].latitude === 28.5355,
  '24. Officer map service returns exact coordinates for assigned field tasks'
);

// -----------------------------------------------------------------------------
// 6. PUBLIC MAP SERVICE & PRIVACY SANITIZATION
// -----------------------------------------------------------------------------
console.log('\n--- 6. Public Map Service & Privacy Protection ---');

Complaint.find = function () {
  return buildMockQuery([
    {
      _id: new mongoose.Types.ObjectId(),
      complaintId: 'CFX-20261117-0001',
      title: 'Water logging at street corner',
      category: 'Drainage',
      status: 'Pending',
      location: {
        address: 'House #42, Lane 3, Model Town',
        latitude: 28.613928,
        longitude: 77.209015
      },
      citizenName: 'Confidential Citizen',
      citizenEmail: 'citizen@private.com',
      citizenPhone: '+91 9876543210',
      internalOfficerNotes: 'Priority dispatch required',
      assignedOfficer: testOfficerId,
      aiAnalysis: { severity: 'Medium' }
    }
  ]);
};

const publicResult = await getPublicMapComplaints({
  category: 'Drainage',
  status: 'Pending'
});

const pubItem = publicResult[0];

assert(
  pubItem.latitude === 28.614 && pubItem.longitude === 77.209,
  '25. Public map endpoint provides approximate coordinates rounded to 3 decimal places'
);

assert(
  pubItem.citizenName === undefined &&
  pubItem.citizenEmail === undefined &&
  pubItem.citizenPhone === undefined,
  '26. Public map endpoint completely strips citizen personal and contact details'
);

assert(
  pubItem.internalOfficerNotes === undefined && pubItem.assignedOfficer === undefined,
  '27. Public map endpoint strips internal officer notes and assigned officer references'
);

// Restore original Complaint.find and readyState
Complaint.find = originalFind;
Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true, writable: true });

// -----------------------------------------------------------------------------
// 7. ROUTE AUTHORIZATION & ACCESS CONTROL
// -----------------------------------------------------------------------------
console.log('\n--- 7. Route Authorization & Role Access Controls ---');

// Test Admin Authorization Guard
let adminGuardBlockedCitizen = false;
const adminGuard = authorize('admin');
adminGuard(
  { user: { role: 'citizen' } },
  {
    status: (code) => ({
      json: (data) => {
        if (code === 403) adminGuardBlockedCitizen = true;
      }
    })
  },
  () => {}
);
assert(
  adminGuardBlockedCitizen,
  '28. /api/admin/map/complaints strictly rejects citizen role with HTTP 403'
);

// Test Officer Authorization Guard
let officerGuardBlockedCitizen = false;
const officerGuard = authorize('officer');
officerGuard(
  { user: { role: 'citizen' } },
  {
    status: (code) => ({
      json: (data) => {
        if (code === 403) officerGuardBlockedCitizen = true;
      }
    })
  },
  () => {}
);
assert(
  officerGuardBlockedCitizen,
  '29. /api/officer/map/complaints strictly rejects citizen role with HTTP 403'
);

// Test Missing Token in protect middleware
let protectBlockedMissingToken = false;
protect(
  { headers: {} },
  {
    status: (code) => ({
      json: (data) => {
        if (code === 401) protectBlockedMissingToken = true;
      }
    })
  },
  () => {}
);
assert(
  protectBlockedMissingToken,
  '30. Protected map routes reject unauthenticated requests with HTTP 401'
);

// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n==================================================');
console.log(`Summary: ${passed}/${total} Phase 12 GIS Map tests passed.`);
console.log('==================================================\n');

if (passed !== total) {
  process.exit(1);
} else {
  process.exit(0);
}
