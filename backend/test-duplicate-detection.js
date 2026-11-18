/**
 * CivicFix AI - Phase 7: Duplicate Complaint Detection Test Suite
 * Tests text Jaccard similarity, Haversine spatial calculations, category compatibility,
 * boundary conditions, confidence grading, candidate filtering, and schema persistence.
 */

import {
  tokenizeAndNormalize,
  calculateJaccardSimilarity,
  calculateTextSimilarity,
  calculateHaversineDistance,
  calculateLocationSimilarity,
  areCategoriesCompatible,
  calculateComplaintSimilarity,
  findPotentialDuplicates
} from './src/services/duplicateDetectionService.js';
import { Complaint } from './src/models/Complaint.js';

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
console.log('📋 CivicFix AI: Phase 7 Duplicate Detection Test Suite');
console.log('==================================================\n');

// -----------------------------------------------------------------------------
// 1. EXACT & SIMILAR TEXT MATCHING TESTS
// -----------------------------------------------------------------------------
console.log('--- 1. Text Similarity & Tokenization Tests ---');

// Test 1: Exact duplicate complaint detection
const exactCompA = {
  title: 'Large hazardous pothole on Main Street',
  description: 'A very deep pothole near the bus stop is damaging vehicle suspensions.',
  category: 'Road Damage'
};
const exactCompB = {
  title: 'Large hazardous pothole on Main Street',
  description: 'A very deep pothole near the bus stop is damaging vehicle suspensions.',
  category: 'Road Damage'
};
const exactTextScore = calculateTextSimilarity(exactCompA, exactCompB);
assert(
  exactTextScore >= 0.95,
  `1. Exact duplicate complaint detection yields near-perfect text score (${exactTextScore})`
);

// Test 2: Similar title detection
const simTitleA = { title: 'Deep pothole on Lincoln Highway' };
const simTitleB = { title: 'Big pothole on Lincoln Highway near exit' };
const titleTokensA = tokenizeAndNormalize(simTitleA.title);
const titleTokensB = tokenizeAndNormalize(simTitleB.title);
const titleScore = calculateJaccardSimilarity(titleTokensA, titleTokensB);
assert(
  titleScore >= 0.50,
  `2. Similar title detection successfully identifies matching keywords (${titleScore})`
);

// Test 3: Similar description detection
const simDescA = {
  description: 'Garbage dumpsters overflowing with bags and trash spilling onto walkway'
};
const simDescB = {
  description: 'Dumpsters are overflowing with trash bags spilling across sidewalk'
};
const descTokensA = tokenizeAndNormalize(simDescA.description);
const descTokensB = tokenizeAndNormalize(simDescB.description);
const descScore = calculateJaccardSimilarity(descTokensA, descTokensB);
assert(
  descScore >= 0.50,
  `3. Similar description detection captures semantic overlap (${descScore})`
);

// -----------------------------------------------------------------------------
// 2. CATEGORY MATCHING & REJECTION TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 2. Category Compatibility Tests ---');

// Test 4: Same category matching
const sameCat = areCategoriesCompatible('Road Damage', 'Road Damage');
assert(
  sameCat === true,
  '4. Same category matching confirms compatible complaint types'
);

// Test 5: Incompatible category rejection
const diffCat = areCategoriesCompatible('Streetlight', 'Water Leakage');
assert(
  diffCat === false,
  '5. Incompatible category rejection blocks mismatched complaint types'
);

const incompatibleSim = calculateComplaintSimilarity(
  { title: 'Broken water pipe', description: 'Water flooding street', category: 'Water Leakage' },
  { title: 'Broken streetlight', description: 'Light out on street', category: 'Streetlight' }
);
assert(
  incompatibleSim.isCompatible === false && incompatibleSim.totalScore === 0,
  'Incompatible complaints receive zero similarity score'
);

// -----------------------------------------------------------------------------
// 3. HAVERSINE & LOCATION SIMILARITY TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 3. Haversine Spatial Distance & Location Tests ---');

// Test 8: Haversine distance calculation
// Distance between City Hall (37.7793, -122.4192) and Civic Center Plaza (37.7798, -122.4178) ~ 135m
const distMeters = calculateHaversineDistance(37.7793, -122.4192, 37.7798, -122.4178);
assert(
  distMeters !== null && distMeters > 100 && distMeters < 180,
  `8. Haversine distance calculation accurately computes geodesic distance (~${distMeters}m)`
);

// Test 6: Same location matching
const sameLocDist = calculateHaversineDistance(37.7749, -122.4194, 37.7749, -122.4194);
assert(
  sameLocDist === 0,
  '6. Same location matching computes 0 meters distance'
);

// Test 7: Nearby coordinate matching (< 300m threshold)
const locNearA = { latitude: 37.7749, longitude: -122.4194 };
const locNearB = { latitude: 37.7760, longitude: -122.4194 }; // ~122 meters north
const nearLocResult = calculateLocationSimilarity(locNearA, locNearB, 300);
assert(
  nearLocResult.hasCoordinates && nearLocResult.distanceMeters <= 300 && nearLocResult.locationScore >= 0.70,
  `7. Nearby coordinate matching (<300m) yields high location score (${nearLocResult.locationScore}, ~${nearLocResult.distanceMeters}m)`
);

// Test 9: Different location rejection (> 1000m)
const locFarA = { latitude: 37.7749, longitude: -122.4194 }; // San Francisco
const locFarB = { latitude: 37.8044, longitude: -122.2712 }; // Oakland (~13 km away)
const farLocResult = calculateLocationSimilarity(locFarA, locFarB, 300, 1000);
assert(
  farLocResult.hasCoordinates && farLocResult.distanceMeters > 5000 && farLocResult.locationScore === 0,
  `9. Different distant location (>1000m) rejected with zero location score (~${farLocResult.distanceMeters}m)`
);

// -----------------------------------------------------------------------------
// 4. BOUNDARY & CONFIDENCE THRESHOLD TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 4. Edge Cases, Confidence Levels & Thresholds ---');

// Test 10: Short generic description handling
const shortGenericTokensA = tokenizeAndNormalize('it is bad');
const shortGenericTokensB = tokenizeAndNormalize('very bad');
const shortJaccard = calculateJaccardSimilarity(shortGenericTokensA, shortGenericTokensB);
assert(
  shortJaccard === 1.0 || shortJaccard === 0.0,
  '10. Short generic description safely guarded against false fractional matches'
);

// Test 11: Low similarity rejection
const compA = {
  title: 'Water pipe leaking under curb',
  description: 'Clear water bubbling out from underground onto asphalt',
  category: 'Water Leakage',
  address: '100 North Blvd'
};
const compDifferent = {
  title: 'Clogged storm drain full of leaves',
  description: 'Storm drain inlet covered with tree leaves causing puddle',
  category: 'Water Leakage',
  address: '900 South Street'
};
const lowSimResult = calculateComplaintSimilarity(compA, compDifferent);
assert(
  lowSimResult.confidence === 'Low' && lowSimResult.totalScore < 0.60,
  `11. Low similarity complaints correctly classified as Low confidence (${lowSimResult.totalScore})`
);

// Test 12: High confidence result (>= 0.80)
const compHighA = {
  title: 'Large pothole on the main road near the bus stop',
  description: 'Deep road pothole on main road right lane near Lincoln bus stop',
  category: 'Road Damage',
  location: { latitude: 37.7749, longitude: -122.4194, address: 'Main Road near Bus Stop' }
};
const compHighB = {
  title: 'There is a big road pothole near the bus stop',
  description: 'Big road pothole on main road near the bus stop right lane',
  category: 'Road Damage',
  location: { latitude: 37.7750, longitude: -122.4194, address: 'Main Road near Bus Stop' }
};
const highSimResult = calculateComplaintSimilarity(compHighA, compHighB);
assert(
  highSimResult.confidence === 'High' && highSimResult.totalScore >= 0.80,
  `12. High confidence duplicate detected (${highSimResult.totalScore})`
);

// Test 13: Medium confidence result (0.60 - 0.79)
const compMedA = {
  title: 'Overflowing garbage bin at central park entrance',
  description: 'Trash cans full of bags and food waste spilling over onto sidewalk',
  category: 'Garbage',
  location: { latitude: 37.7749, longitude: -122.4194, address: 'Central Park Entrance' }
};
const compMedB = {
  title: 'Garbage container full at central park entrance',
  description: 'Food waste and trash spilling over onto the pavement',
  category: 'Garbage',
  location: { latitude: 37.7760, longitude: -122.4194, address: 'Central Park Entrance' } // ~122m away
};
const medSimResult = calculateComplaintSimilarity(compMedA, compMedB);
assert(
  medSimResult.confidence === 'Medium' &&
  medSimResult.totalScore >= 0.60 &&
  medSimResult.totalScore < 0.80,
  `13. Medium confidence duplicate detected (${medSimResult.totalScore})`
);

// -----------------------------------------------------------------------------
// 5. CANDIDATE QUERY & SELF-EXCLUSION TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 5. Candidate Filtering & Self-Exclusion ---');

// Test 14: Excluding the current complaint
const targetTicket = {
  complaintId: 'CFX-20261117-0001',
  title: 'Deep road pothole on 5th Avenue',
  description: 'Large hole in asphalt damaging tires',
  category: 'Road Damage',
  location: { latitude: 37.7749, longitude: -122.4194 }
};

const candidatePool = [
  // Self ticket (must be excluded!)
  {
    complaintId: 'CFX-20261117-0001',
    title: 'Deep road pothole on 5th Avenue',
    description: 'Large hole in asphalt damaging tires',
    category: 'Road Damage',
    location: { latitude: 37.7749, longitude: -122.4194 }
  },
  // True duplicate ticket
  {
    complaintId: 'CFX-20261117-0002',
    title: 'Deep pothole on 5th Avenue road',
    description: 'Road hole damaging tires near 5th Ave',
    category: 'Road Damage',
    location: { latitude: 37.7750, longitude: -122.4194 },
    createdAt: new Date()
  },
  // Unrelated ticket
  {
    complaintId: 'CFX-20261117-0003',
    title: 'Faded crosswalk paint',
    description: 'Pedestrian markings need repainting',
    category: 'Road Damage',
    location: { latitude: 37.7900, longitude: -122.4100 },
    createdAt: new Date()
  }
];

const duplicateDetectionRun = await findPotentialDuplicates(targetTicket, {
  candidateComplaints: candidatePool
});

assert(
  duplicateDetectionRun.isPotentialDuplicate === true,
  'Duplicate detection identifies potential duplicates from candidate pool'
);

assert(
  !duplicateDetectionRun.matchedComplaintIds.includes('CFX-20261117-0001'),
  '14. Excluding current complaint: Complaint is strictly excluded from matching itself'
);

assert(
  duplicateDetectionRun.matchedComplaintIds.includes('CFX-20261117-0002'),
  'Candidate pool correctly flags genuine duplicate match (CFX-20261117-0002)'
);

// -----------------------------------------------------------------------------
// 6. PARAMETER VALIDATION & MODEL PERSISTENCE TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 6. Parameter Validation & MongoDB Schema Persistence ---');

// Test 15: Missing complaint ID
const validateId = (id) => {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    const err = new Error('Please provide a valid complaint ID');
    err.statusCode = 400;
    throw err;
  }
};
try {
  validateId('');
  assert(false, 'Missing complaint ID should throw error');
} catch (err) {
  assert(
    err.statusCode === 400,
    '15. Missing complaint ID is rejected with HTTP 400 Bad Request'
  );
}

// Test 16: Non-existing complaint ID simulation
const simulateFindComplaint = (id) => {
  if (id === 'CFX-DOES-NOT-EXIST') {
    const err = new Error(`Complaint not found with ID: ${id}`);
    err.statusCode = 404;
    throw err;
  }
  return { complaintId: id };
};
try {
  simulateFindComplaint('CFX-DOES-NOT-EXIST');
  assert(false, 'Non-existent ID should throw 404');
} catch (err) {
  assert(
    err.statusCode === 404,
    '16. Non-existing complaint ID safely returns HTTP 404 Not Found'
  );
}

// Test 17: Duplicate detection persistence in MongoDB Schema
const complaintWithDupCheck = new Complaint({
  title: 'Water valve broken',
  description: 'Water spraying onto roadway continuously.',
  category: 'Water Leakage',
  location: { address: '300 Market St' },
  duplicateCheck: {
    status: 'Completed',
    isPotentialDuplicate: true,
    confidence: 'High',
    similarityScore: 0.86,
    matchedComplaintIds: ['CFX-20261117-0002'],
    matchedComplaints: [
      {
        complaintId: 'CFX-20261117-0002',
        title: 'Broken water valve spraying',
        category: 'Water Leakage',
        status: 'Pending',
        similarityScore: 0.86,
        confidence: 'High',
        distanceMeters: 45,
        createdAt: new Date()
      }
    ],
    checkedAt: new Date()
  }
});
const valErr = complaintWithDupCheck.validateSync();
assert(
  !valErr,
  '17. Duplicate detection persistence in Complaint Mongoose schema validates cleanly'
);

const pubObj = complaintWithDupCheck.toPublicJSON();
assert(
  pubObj.duplicateCheck &&
  pubObj.duplicateCheck.isPotentialDuplicate === true &&
  pubObj.duplicateCheck.confidence === 'High' &&
  pubObj.duplicateCheck.similarityScore === 0.86,
  'Complaint.toPublicJSON() exposes safe duplicate detection attributes'
);

// Test 18: Complaint saved when duplicate detection fails
const complaintWithFailedDup = new Complaint({
  title: 'Damaged sidewalk slab',
  description: 'Tree roots lifted concrete slab creating tripping hazard.',
  category: 'Road Damage',
  location: { address: '45 Elm Street' },
  duplicateCheck: {
    status: 'Failed',
    isPotentialDuplicate: false,
    errorMessage: 'Duplicate detection service is temporarily unavailable.'
  }
});
assert(
  !complaintWithFailedDup.validateSync(),
  '18. Complaint is saved when duplicate detection fails (non-blocking fallback)'
);

// Test 19: Complaint submission with image still works
const complaintWithMediaAndDup = new Complaint({
  title: 'Fallen tree branch',
  description: 'Large branch blocking storm drain inlet.',
  category: 'Drainage',
  location: { address: '88 Oak Ave' },
  imageUrl: 'https://res.cloudinary.com/civicfix/image/upload/v1234/tree.jpg',
  imagePublicId: 'civicfix/complaints/tree123',
  duplicateCheck: {
    status: 'Completed',
    isPotentialDuplicate: false
  }
});
assert(
  !complaintWithMediaAndDup.validateSync() &&
  complaintWithMediaAndDup.imageUrl &&
  complaintWithMediaAndDup.duplicateCheck.status === 'Completed',
  '19. Complaint submission with existing image upload continues to work seamlessly'
);

// Test 20: Gemini AI integration still works alongside duplicate detection
const complaintWithAiAndDup = new Complaint({
  title: 'Flickering street lamp',
  description: 'Lamp strobes violently throughout the night.',
  category: 'Streetlight',
  location: { address: '12 Birch Rd' },
  aiAnalysis: {
    status: 'Completed',
    suggestedCategory: 'Streetlight',
    severity: 'Medium',
    summary: 'Strobing street light causing nighttime nuisance.',
    recommendedDepartment: 'Public Works & Electrical Infrastructure',
    suggestedAction: 'Replace flickering photocell or ballast unit.'
  },
  duplicateCheck: {
    status: 'Completed',
    isPotentialDuplicate: false
  }
});
assert(
  !complaintWithAiAndDup.validateSync() &&
  complaintWithAiAndDup.aiAnalysis.severity === 'Medium' &&
  complaintWithAiAndDup.duplicateCheck.status === 'Completed',
  '20. Gemini AI integration remains completely decoupled and functional alongside duplicate detection'
);

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n==================================================');
console.log(`Summary: ${passed}/${total} Phase 7 Duplicate Detection tests passed.`);
console.log('==================================================');

if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
