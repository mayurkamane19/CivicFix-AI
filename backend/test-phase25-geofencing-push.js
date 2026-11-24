/**
 * Phase 25: GIS Geofencing & Web Push Notification Regression Tests
 * CivicFix AI - Municipal Geofencing & Push Lifecycle Verification
 */

import {
  validateGeoJSONGeometry,
  isPointInPolygonRing,
  isPointInPolygon,
  isPointInMultiPolygon,
  isPointInGeoJSON,
  detectWardForCoordinates
} from './src/utils/geofencing.js';
import { isPushConfigured, dispatchPushToUser } from './src/services/pushService.js';
import { PushSubscription } from './src/models/PushSubscription.js';
import mongoose from 'mongoose';

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
console.log('🧪 CivicFix AI: Phase 25 Geofencing & Push Test Suite');
console.log('====================================================\n');

console.log('--- 1. GeoJSON Geometry Structure Validation ---');
const validPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      [73.85, 18.52],
      [73.87, 18.52],
      [73.87, 18.54],
      [73.85, 18.54],
      [73.85, 18.52]
    ]
  ]
};

assert(validateGeoJSONGeometry(validPolygon).isValid === true, 'Valid GeoJSON Polygon is accepted');

const invalidType = { type: 'LineString', coordinates: [[0, 0], [1, 1]] };
assert(validateGeoJSONGeometry(invalidType).isValid === false, 'Invalid geometry type (LineString) is rejected');

const invalidCoordinates = {
  type: 'Polygon',
  coordinates: [[[200, 18.52], [73.87, 18.52], [73.87, 18.54]]]
};
assert(validateGeoJSONGeometry(invalidCoordinates).isValid === false, 'Out-of-range longitude (> 180) is rejected');

console.log('\n--- 2. Point-in-Polygon Raycasting Logic ---');
const ring = [
  [10, 10],
  [20, 10],
  [20, 20],
  [10, 20],
  [10, 10]
];

assert(isPointInPolygonRing(15, 15, ring) === true, 'Point strictly inside ring returns true');
assert(isPointInPolygonRing(5, 5, ring) === false, 'Point outside ring returns false');
assert(isPointInPolygonRing(25, 15, ring) === false, 'Point to the right of bounding box returns false');
assert(isPointInPolygonRing(10, 15, ring) === true, 'Point on vertical boundary edge returns true');

console.log('\n--- 3. Polygons With Holes (Interior Exclusion) ---');
const polygonWithHole = [
  // Outer boundary
  [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
  // Inner hole
  [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]]
];

assert(isPointInPolygon(1, 1, polygonWithHole) === true, 'Point in polygon but outside hole returns true');
assert(isPointInPolygon(5, 5, polygonWithHole) === false, 'Point inside interior hole returns false (exclusion verified)');
assert(isPointInPolygon(15, 15, polygonWithHole) === false, 'Point outside outer boundary returns false');

console.log('\n--- 4. MultiPolygon Geometry Support ---');
const multiPolygonCoords = [
  // Island 1
  [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
  // Island 2
  [[[10, 10], [12, 10], [12, 12], [10, 12], [10, 10]]]
];

assert(isPointInMultiPolygon(1, 1, multiPolygonCoords) === true, 'Point in first polygon of MultiPolygon returns true');
assert(isPointInMultiPolygon(11, 11, multiPolygonCoords) === true, 'Point in second polygon of MultiPolygon returns true');
assert(isPointInMultiPolygon(5, 5, multiPolygonCoords) === false, 'Point between MultiPolygon islands returns false');

console.log('\n--- 5. Municipal Ward Detection for Coordinates ---');
const mockWards = [
  {
    _id: new mongoose.Types.ObjectId(),
    name: 'Shivajinagar Ward',
    code: 'SHIV_01',
    isActive: true,
    boundaries: {
      type: 'Polygon',
      coordinates: [
        [
          [73.84, 18.52],
          [73.86, 18.52],
          [73.86, 18.54],
          [73.84, 18.54],
          [73.84, 18.52]
        ]
      ]
    }
  },
  {
    _id: new mongoose.Types.ObjectId(),
    name: 'Kothrud Ward',
    code: 'KOTH_02',
    isActive: true,
    boundaries: {
      type: 'Polygon',
      coordinates: [
        [
          [73.80, 18.49],
          [73.83, 18.49],
          [73.83, 18.51],
          [73.80, 18.51],
          [73.80, 18.49]
        ]
      ]
    }
  },
  {
    _id: new mongoose.Types.ObjectId(),
    name: 'Deactivated Ward',
    code: 'DEACT_03',
    isActive: false,
    boundaries: {
      type: 'Polygon',
      coordinates: [
        [
          [73.87, 18.52],
          [73.89, 18.52],
          [73.89, 18.54],
          [73.87, 18.54],
          [73.87, 18.52]
        ]
      ]
    }
  }
];

// Test 5.1: Point inside Ward 1
const res1 = detectWardForCoordinates(18.53, 73.85, mockWards);
assert(res1.status === 'MATCHED', 'Status is MATCHED for point inside Shivajinagar Ward');
assert(res1.matchedWard?.code === 'SHIV_01', 'Correct ward code SHIV_01 is resolved');

// Test 5.2: Point inside Ward 2
const res2 = detectWardForCoordinates(18.50, 73.81, mockWards);
assert(res2.status === 'MATCHED', 'Status is MATCHED for point inside Kothrud Ward');
assert(res2.matchedWard?.code === 'KOTH_02', 'Correct ward code KOTH_02 is resolved');

// Test 5.3: Point outside all wards
const resOutside = detectWardForCoordinates(19.00, 72.85, mockWards);
assert(resOutside.status === 'OUTSIDE_BOUNDARIES', 'Status is OUTSIDE_BOUNDARIES for coordinates outside all wards');
assert(resOutside.matchedWard === null, 'No ward is assigned when coordinates are outside municipal limits');

// Test 5.4: Point inside deactivated ward
const resDeact = detectWardForCoordinates(18.53, 73.88, mockWards);
assert(resDeact.status === 'OUTSIDE_BOUNDARIES', 'Deactivated wards are strictly ignored during geofencing');

// Test 5.5: Invalid latitude/longitude coordinates
const resInvalid = detectWardForCoordinates(100.5, 73.85, mockWards);
assert(resInvalid.status === 'INVALID_COORDINATES', 'Latitude > 90 returns INVALID_COORDINATES status');

console.log('\n--- 6. Web Push Notification Engine ---');
assert(typeof isPushConfigured === 'function', 'isPushConfigured helper is exported');
assert(typeof isPushConfigured() === 'boolean', 'isPushConfigured returns boolean');

// Model validation
const subDoc = new PushSubscription({
  user: new mongoose.Types.ObjectId(),
  endpoint: 'https://fcm.googleapis.com/fcm/send/fake-test-token',
  keys: {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0P684xh0',
    auth: 'tBHItJI5svbpez7KI4CCXg'
  }
});

assert(subDoc.endpoint.startsWith('https://'), 'PushSubscription stores valid HTTPS endpoint');
assert(subDoc.keys.p256dh.length > 10, 'PushSubscription stores p256dh public key');
assert(subDoc.keys.auth.length > 5, 'PushSubscription stores auth secret');

// Safe dispatch call without throwing
const dispatchResult = await dispatchPushToUser(null, { title: 'Test' });
assert(dispatchResult.dispatched === 0, 'Null userId returns 0 dispatched without throwing');

console.log('\n====================================================');
console.log(`Summary: ${passed}/${total} Phase 25 geofencing & push tests passed.`);
console.log('====================================================');

process.exit(passed === total ? 0 : 1);
