/**
 * CivicFix AI - Mini Phase 15.3: Frontend AI Image Analysis Display Test Suite
 * Verifies public tracking and admin details data structures for:
 * 1. Available image analysis rendering
 * 2. Admin details image analysis rendering
 * 3. Missing imageAnalysis graceful fallback (null / undefined)
 * 4. Failed analysis safe messaging without internal error exposure
 * 5. Unsuitable image warning flag and reason propagation
 * 6. Internal error details isolation
 * 7. Existing text AI analysis coexistence
 * 8. Existing complaint tracking backwards compatibility
 */

import mongoose from 'mongoose';
import { Complaint } from './src/models/Complaint.js';

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

console.log('==================================================');
console.log('🖼️  CivicFix AI: Mini Phase 15.3 Frontend Display Tests');
console.log('==================================================\n');

// -----------------------------------------------------------------------------
// 1. Available Image Analysis in Public Tracking Representation
// -----------------------------------------------------------------------------
console.log('--- 1. Citizen Tracking Public Serialization ---');

const completedDoc = new Complaint({
  complaintId: 'CFX-20261118-9101',
  title: 'Severe roadway crater',
  description: 'Deep pothole on high speed boulevard',
  category: 'Road Damage',
  location: { address: '100 North Blvd', latitude: 37.7749, longitude: -122.4194 },
  imageUrl: 'https://res.cloudinary.com/civicfix/image/upload/v1/pothole.jpg',
  imageAnalysis: {
    status: 'Completed',
    possibleIssueType: 'Asphalt Pothole',
    shortDescription: 'Deep depression exposing sub-base aggregate.',
    suggestedCategory: 'Road Damage',
    suggestedSeverity: 'High',
    confidence: 'High',
    isUnclearOrUnsuitable: false,
    unsuitableReason: null,
    analyzedAt: new Date()
  },
  aiAnalysis: {
    status: 'Completed',
    suggestedCategory: 'Road Damage',
    severity: 'High',
    summary: 'Hazardous asphalt failure on arterial road.',
    recommendedDepartment: 'Department of Transportation',
    suggestedAction: 'Cold-patch repair immediately.'
  }
});

const publicData = completedDoc.toPublicJSON();

assert(
  publicData.imageAnalysis !== null && publicData.imageAnalysis.status === 'Completed',
  '1.1 toPublicJSON() provides imageAnalysis with status "Completed"'
);

assert(
  publicData.imageAnalysis.possibleIssueType === 'Asphalt Pothole',
  '1.2 possibleIssueType is correctly exposed for Citizen Tracking'
);

assert(
  publicData.imageAnalysis.shortDescription === 'Deep depression exposing sub-base aggregate.',
  '1.3 shortDescription is correctly exposed for Citizen Tracking'
);

assert(
  publicData.imageAnalysis.suggestedCategory === 'Road Damage',
  '1.4 suggestedCategory is correctly exposed for Citizen Tracking'
);

assert(
  publicData.imageAnalysis.suggestedSeverity === 'High',
  '1.5 suggestedSeverity is correctly exposed for Citizen Tracking'
);

assert(
  publicData.imageAnalysis.confidence === 'High',
  '1.6 confidence level is correctly exposed for Citizen Tracking'
);

// -----------------------------------------------------------------------------
// 2. Admin Complaint Details Representation
// -----------------------------------------------------------------------------
console.log('\n--- 2. Admin Inspection Serialization ---');

const adminData = completedDoc.toAdminJSON();

assert(
  adminData.imageAnalysis !== null && adminData.imageAnalysis.status === 'Completed',
  '2.1 toAdminJSON() provides complete imageAnalysis subdocument'
);

assert(
  adminData.imageAnalysis.possibleIssueType === 'Asphalt Pothole',
  '2.2 Admin details receives possibleIssueType'
);

assert(
  adminData.imageAnalysis.suggestedCategory === 'Road Damage',
  '2.3 Admin details receives suggestedCategory'
);

assert(
  adminData.imageAnalysis.suggestedSeverity === 'High',
  '2.4 Admin details receives suggestedSeverity'
);

assert(
  adminData.imageAnalysis.confidence === 'High',
  '2.5 Admin details receives confidence level'
);

// -----------------------------------------------------------------------------
// 3. Missing imageAnalysis Data (No Image Uploaded)
// -----------------------------------------------------------------------------
console.log('\n--- 3. Missing Image Analysis Graceful Handling ---');

const noImageDoc = new Complaint({
  complaintId: 'CFX-20261118-9102',
  title: 'Street lamp out',
  description: 'Completely dark near alley entrance',
  category: 'Streetlight',
  location: { address: '200 Pine St' }
});

const noImagePublic = noImageDoc.toPublicJSON();
const noImageAdmin = noImageDoc.toAdminJSON();

assert(
  noImagePublic.imageAnalysis === null,
  '3.1 toPublicJSON() safely returns null for imageAnalysis when no image is uploaded'
);

assert(
  noImageAdmin.imageAnalysis === null,
  '3.2 toAdminJSON() safely returns null for imageAnalysis when no image is uploaded'
);

// -----------------------------------------------------------------------------
// 4. Failed Analysis Safe Messaging & Error Isolation
// -----------------------------------------------------------------------------
console.log('\n--- 4. Failed Image Analysis Safe Handling ---');

const failedDoc = new Complaint({
  complaintId: 'CFX-20261118-9103',
  title: 'Flooded curb',
  description: 'Water standing at curb',
  category: 'Drainage',
  location: { address: '300 River Rd' },
  imageUrl: 'https://res.cloudinary.com/civicfix/image/upload/v1/flood.jpg',
  imageAnalysis: {
    status: 'Failed',
    possibleIssueType: null,
    shortDescription: '',
    suggestedCategory: null,
    suggestedSeverity: null,
    confidence: null,
    isUnclearOrUnsuitable: false,
    unsuitableReason: null,
    errorMessage: 'Internal Gemini Quota Exhaustion at genai_client.cc:142'
  }
});

const failedPublic = failedDoc.toPublicJSON();

assert(
  failedPublic.imageAnalysis !== null && failedPublic.imageAnalysis.status === 'Failed',
  '4.1 toPublicJSON() marks status as "Failed"'
);

assert(
  failedPublic.imageAnalysis.errorMessage === undefined,
  '4.2 toPublicJSON() strictly OMITS internal errorMessage preventing information leakage'
);

// -----------------------------------------------------------------------------
// 5. Unsuitable / Non-Civic Image Warning
// -----------------------------------------------------------------------------
console.log('\n--- 5. Unsuitable Image Warning Serialization ---');

const unsuitableDoc = new Complaint({
  complaintId: 'CFX-20261118-9104',
  title: 'Strange object on sidewalk',
  description: 'Unclear object on corner',
  category: 'Other',
  location: { address: '400 Market St' },
  imageUrl: 'https://res.cloudinary.com/civicfix/image/upload/v1/selfie.jpg',
  imageAnalysis: {
    status: 'Completed',
    possibleIssueType: 'Non-Civic Content',
    shortDescription: 'Photograph appears to be a personal selfie, not a municipal infrastructure hazard.',
    suggestedCategory: 'Other',
    suggestedSeverity: 'Low',
    confidence: 'Low',
    isUnclearOrUnsuitable: true,
    unsuitableReason: 'Image contains personal portrait with no visible public infrastructure defect.',
    analyzedAt: new Date()
  }
});

const unsuitablePublic = unsuitableDoc.toPublicJSON();
const unsuitableAdmin = unsuitableDoc.toAdminJSON();

assert(
  unsuitablePublic.imageAnalysis.isUnclearOrUnsuitable === true,
  '5.1 Public tracking exposes isUnclearOrUnsuitable=true for warning badge'
);

assert(
  unsuitablePublic.imageAnalysis.unsuitableReason.includes('personal portrait'),
  '5.2 Public tracking provides user-friendly unsuitableReason explanation'
);

assert(
  unsuitableAdmin.imageAnalysis.isUnclearOrUnsuitable === true &&
  unsuitableAdmin.imageAnalysis.unsuitableReason.includes('personal portrait'),
  '5.3 Admin details exposes isUnclearOrUnsuitable warning banner for municipal staff'
);

// -----------------------------------------------------------------------------
// 6. Text AI Analysis & Existing Complaint Tracking Coexistence
// -----------------------------------------------------------------------------
console.log('\n--- 6. Text AI Analysis & System Regressions ---');

assert(
  completedDoc.aiAnalysis && completedDoc.aiAnalysis.status === 'Completed',
  '6.1 Text aiAnalysis operates alongside imageAnalysis without interference'
);

assert(
  publicData.aiAnalysis && publicData.aiAnalysis.summary.includes('Hazardous asphalt failure'),
  '6.2 Public tracking provides both text AI analysis and image AI analysis cleanly'
);

assert(
  publicData.title === 'Severe roadway crater' &&
  publicData.status === 'Pending' &&
  publicData.address === '100 North Blvd',
  '6.3 Core complaint tracking attributes remain completely functional'
);

// =============================================================================
// SUMMARY REPORT
// =============================================================================
console.log('\n==================================================');
console.log(`Summary: ${passedTests}/${totalTests} Mini Phase 15.3 Frontend Data tests passed.`);
console.log('==================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
