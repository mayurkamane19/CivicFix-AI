/**
 * CivicFix AI - Mini Phase 15.4: AI Image Analysis Regression Test Suite
 * Comprehensive regression tests verifying the 11 critical workflow points:
 * 1. Complaint submitted without an image
 * 2. Valid image successfully analyzed
 * 3. Invalid or unsupported image formats
 * 4. Image boundary & oversized buffer validation (5MB threshold)
 * 5. Unsuitable image detection & sanitization (non-civic/blurry)
 * 6. Gemini API failures, timeouts, quota limits & markdown code fence handling
 * 7. Resilient complaint submission when AI image analysis fails (non-blocking fallback)
 * 8. Image analysis persistence & schema validation
 * 9. Citizen tracking public serialization (toPublicJSON)
 * 10. Admin complaint details serialization (toAdminJSON)
 * 11. Safe handling of Pending, Failed, and Missing states
 */

import mongoose from 'mongoose';
import { Complaint } from './src/models/Complaint.js';
import { createComplaint } from './src/services/complaintService.js';
import {
  validateImageInput,
  buildImageAnalysisPrompt,
  validateAndSanitizeImageAnalysisOutput,
  analyzeComplaintImage
} from './src/services/imageAnalysisService.js';
import { setMockUploader, resetUploader, MAX_FILE_SIZE_BYTES } from './src/services/uploadService.js';

// Setup in-memory mock environment for Mongoose DB
Object.defineProperty(mongoose.connection, 'readyState', {
  value: 1,
  writable: true,
  configurable: true
});

Complaint.findOne = async () => null;
Complaint.find = () => ({
  sort: () => ({
    limit: () => ({
      lean: async () => []
    })
  })
});
Complaint.prototype.save = async function () {
  if (!this.createdAt) {
    this.createdAt = new Date();
  }
  return this;
};

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
console.log('🔍 CivicFix AI: Mini Phase 15.4 Image Analysis Regression');
console.log('==================================================\n');

// Sample test buffers
const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const validWebpBuffer = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)]);
const corruptedBuffer = Buffer.from('<html><body>Fake Not An Image</body></html>');

// Mock Cloudinary Uploader
let uploadCount = 0;
setMockUploader((buffer, originalname, format) => {
  uploadCount++;
  return Promise.resolve({
    secure_url: 'https://res.cloudinary.com/civicfix/image/upload/v999/test-issue.jpg',
    public_id: 'civicfix/complaints/test-issue-999',
    format: format || 'jpeg',
    bytes: buffer.length
  });
});

// -----------------------------------------------------------------------------
// 1. COMPLAINT SUBMITTED WITHOUT AN IMAGE
// -----------------------------------------------------------------------------
console.log('--- 1. Complaint Submitted Without Image ---');

let noImageAiCalled = false;
const mockAiClientNoCall = {
  models: {
    generateContent: async () => {
      noImageAiCalled = true;
      return { text: '{}' };
    }
  }
};

const noImageResult = await createComplaint({
  title: 'Broken bench in park',
  description: 'Wooden park bench has cracked slats and exposed nails.',
  category: 'Other',
  address: 'Central Community Park, Sector 4',
  latitude: 37.7749,
  longitude: -122.4194,
  imageAiClient: mockAiClientNoCall
});

assert(
  noImageResult && noImageResult.complaintId && noImageResult.complaintId.startsWith('CFX-'),
  '1.1 Complaint without image creates valid ticket ID successfully'
);
assert(
  noImageAiCalled === false,
  '1.2 Gemini vision model is never invoked when no image is uploaded'
);
assert(
  noImageResult.imageUrl === '',
  '1.3 imageUrl is an empty string when no photo is attached'
);
assert(
  noImageResult.imageAnalysis === null,
  '1.4 imageAnalysis serializes cleanly as null when no image exists'
);

// -----------------------------------------------------------------------------
// 2. VALID IMAGE SUCCESSFULLY ANALYZED
// -----------------------------------------------------------------------------
console.log('\n--- 2. Valid Image Successfully Analyzed ---');

const mockPotholeAi = {
  models: {
    generateContent: async () => ({
      text: JSON.stringify({
        isUnclearOrUnsuitable: false,
        unsuitableReason: null,
        possibleIssueType: 'Road Surface Pothole',
        shortDescription: 'Deep circular cavity in asphalt roadway with visible gravel.',
        suggestedCategory: 'Road Damage',
        suggestedSeverity: 'High',
        confidence: 'High'
      })
    })
  }
};

const validImageComplaint = await createComplaint({
  title: 'Severe roadway pothole',
  description: 'Large crater in middle lane creating vehicle hazard.',
  category: 'Road Damage',
  address: '450 West Main St',
  latitude: 37.7749,
  longitude: -122.4194,
  file: {
    buffer: validJpegBuffer,
    originalname: 'pothole.jpg',
    mimetype: 'image/jpeg'
  },
  imageAiClient: mockPotholeAi
});

assert(
  validImageComplaint && validImageComplaint.complaintId.startsWith('CFX-'),
  '2.1 Complaint with valid image succeeds and returns CFX ticket ID'
);
assert(
  validImageComplaint.imageAnalysis !== null,
  '2.2 imageAnalysis subdocument is attached to public response'
);
assert(
  validImageComplaint.imageAnalysis.status === 'Completed',
  '2.3 imageAnalysis status is Completed'
);
assert(
  validImageComplaint.imageAnalysis.possibleIssueType === 'Road Surface Pothole',
  '2.4 possibleIssueType accurately parsed from model'
);
assert(
  validImageComplaint.imageAnalysis.suggestedSeverity === 'High',
  '2.5 suggestedSeverity accurately normalized'
);
assert(
  validImageComplaint.imageAnalysis.confidence === 'High',
  '2.6 confidence accurately normalized'
);

// -----------------------------------------------------------------------------
// 3. INVALID OR UNSUPPORTED IMAGE
// -----------------------------------------------------------------------------
console.log('\n--- 3. Invalid or Unsupported Image Formats ---');

const invalidMimeResult = validateImageInput(validJpegBuffer, 'application/pdf');
assert(
  invalidMimeResult.isValid === false && invalidMimeResult.error.includes('Unsupported MIME type'),
  '3.1 application/pdf MIME type rejected'
);

const corruptedResult = validateImageInput(corruptedBuffer, 'image/jpeg');
assert(
  corruptedResult.isValid === false && corruptedResult.error.includes('Corrupted or invalid image data'),
  '3.2 Corrupted buffer with fake JPEG MIME rejected by magic byte inspection'
);

let caughtCorruptSubmission = false;
try {
  await createComplaint({
    title: 'Testing corrupted upload',
    description: 'Attempting to upload a corrupted fake image buffer.',
    category: 'Garbage',
    address: '12 Market St',
    latitude: 37.7749,
    longitude: -122.4194,
    file: {
      buffer: corruptedBuffer,
      originalname: 'corrupt.jpg',
      mimetype: 'image/jpeg'
    }
  });
} catch (err) {
  caughtCorruptSubmission = true;
  assert(
    err.statusCode === 400 && err.message.includes('Invalid image file format'),
    '3.3 Corrupted buffer in createComplaint throws HTTP 400 Bad Request before Cloudinary or Gemini'
  );
}
assert(caughtCorruptSubmission === true, '3.4 createComplaint successfully blocked corrupted image');

// -----------------------------------------------------------------------------
// 4. IMAGE LARGER THAN ALLOWED SIZE (5MB BOUNDARY)
// -----------------------------------------------------------------------------
console.log('\n--- 4. Image Size Threshold & Oversized Buffer Tests ---');

// Exactly 5MB buffer (with valid JPEG header)
const exact5MbBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES);
exact5MbBuffer[0] = 0xff;
exact5MbBuffer[1] = 0xd8;
exact5MbBuffer[2] = 0xff;
const exact5MbResult = validateImageInput(exact5MbBuffer, 'image/jpeg');
assert(
  exact5MbResult.isValid === true,
  '4.1 Buffer of exactly 5MB passes size validation threshold'
);

// 5MB + 1024 bytes buffer
const oversizedBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1024);
oversizedBuffer[0] = 0xff;
oversizedBuffer[1] = 0xd8;
oversizedBuffer[2] = 0xff;
const oversizedResult = validateImageInput(oversizedBuffer, 'image/jpeg');
assert(
  oversizedResult.isValid === false && oversizedResult.error.includes('5MB'),
  '4.2 Buffer exceeding 5MB is rejected with 5MB limit notice'
);

// -----------------------------------------------------------------------------
// 5. UNSUITABLE IMAGE DETECTION (PET / BLURRY / INDOORS)
// -----------------------------------------------------------------------------
console.log('\n--- 5. Unsuitable Image Detection & Sanitization ---');

const unsuitableMockAi = {
  models: {
    generateContent: async () => ({
      text: JSON.stringify({
        isUnclearOrUnsuitable: true,
        unsuitableReason: 'Image shows an indoor sofa with a sleeping cat; no civic issue visible.',
        possibleIssueType: 'Pet / Indoor Living Room',
        shortDescription: 'Photograph taken indoors depicting a domestic animal with zero municipal context.',
        suggestedCategory: 'Other',
        suggestedSeverity: 'Low',
        confidence: 'High'
      })
    })
  }
};

const unsuitableComplaint = await createComplaint({
  title: 'Report with wrong photo',
  description: 'Accidentally attached a picture of my pet instead of street light.',
  category: 'Streetlight',
  address: '88 Oak Lane',
  latitude: 37.7749,
  longitude: -122.4194,
  file: {
    buffer: validJpegBuffer,
    originalname: 'cat.jpg',
    mimetype: 'image/jpeg'
  },
  imageAiClient: unsuitableMockAi
});

assert(
  unsuitableComplaint && unsuitableComplaint.complaintId.startsWith('CFX-'),
  '5.1 Unsuitable image complaint submission succeeds'
);
assert(
  unsuitableComplaint.imageAnalysis.isUnclearOrUnsuitable === true,
  '5.2 isUnclearOrUnsuitable is strictly true'
);
assert(
  unsuitableComplaint.imageAnalysis.unsuitableReason.includes('sleeping cat'),
  '5.3 unsuitableReason explains why photo is unsuitable'
);
assert(
  unsuitableComplaint.category === 'Streetlight',
  '5.4 Citizen-selected category is preserved and not altered by unsuitable image'
);

// -----------------------------------------------------------------------------
// 6. GEMINI API FAILURE, TIMEOUT, QUOTA LIMITS & MARKDOWN PARSING
// -----------------------------------------------------------------------------
console.log('\n--- 6. Gemini Failures, Timeouts, Quota Limits & Markdown Parsing ---');

// 6.1 Timeout simulation
const mockTimeoutClient = {
  models: {
    generateContent: async () => {
      const err = new Error('AI image analysis timed out after 20000ms');
      err.name = 'TimeoutError';
      throw err;
    }
  }
};
const timeoutResult = await analyzeComplaintImage(validJpegBuffer, 'image/jpeg', { client: mockTimeoutClient });
assert(
  timeoutResult.success === false && timeoutResult.error.includes('timed out'),
  '6.1 TimeoutError returns user-friendly timeout message'
);

// 6.2 Quota limit simulation (429)
const mock429Client = {
  models: {
    generateContent: async () => {
      const err = new Error('Resource exhausted: 429 quota exceeded');
      err.status = 429;
      throw err;
    }
  }
};
const quotaResult = await analyzeComplaintImage(validJpegBuffer, 'image/jpeg', { client: mock429Client });
assert(
  quotaResult.success === false && quotaResult.error.includes('quota limit reached'),
  '6.2 HTTP 429 Resource Exhausted returns quota notice'
);

// 6.3 Authentication failure simulation (401/403)
const mock401Client = {
  models: {
    generateContent: async () => {
      const err = new Error('API_KEY_INVALID: 401 Unauthorized');
      err.status = 401;
      throw err;
    }
  }
};
const authResult = await analyzeComplaintImage(validJpegBuffer, 'image/jpeg', { client: mock401Client });
assert(
  authResult.success === false && authResult.error.includes('authentication failed'),
  '6.3 API key authentication failure returns clear configuration instruction'
);

// 6.4 Markdown code-fenced JSON parsing
const markdownFencedJson = '```json\n{"isUnclearOrUnsuitable":false,"possibleIssueType":"Drain Clog","suggestedCategory":"Drainage","suggestedSeverity":"Medium","confidence":"Medium"}\n```';
const parsedMarkdown = validateAndSanitizeImageAnalysisOutput(markdownFencedJson);
assert(
  parsedMarkdown.possibleIssueType === 'Drain Clog' && parsedMarkdown.suggestedCategory === 'Drainage',
  '6.4 Markdown code fences (```json ... ```) are cleanly stripped and parsed'
);

// -----------------------------------------------------------------------------
// 7. COMPLAINT SUBMISSION CONTINUES WHEN AI IMAGE ANALYSIS FAILS (NON-BLOCKING)
// -----------------------------------------------------------------------------
console.log('\n--- 7. Non-blocking Fallback When AI Image Analysis Fails ---');

const mockCrashingAi = {
  models: {
    generateContent: async () => {
      throw new Error('Fatal Gemini API gateway outage');
    }
  }
};

const resilientComplaint = await createComplaint({
  title: 'Burst water pipe flooding street',
  description: 'Clean water gushing from broken municipal pipe across road.',
  category: 'Water Leakage',
  address: '500 River Rd',
  latitude: 37.7749,
  longitude: -122.4194,
  file: {
    buffer: validJpegBuffer,
    originalname: 'water-pipe.jpg',
    mimetype: 'image/jpeg'
  },
  imageAiClient: mockCrashingAi
});

assert(
  resilientComplaint && resilientComplaint.complaintId.startsWith('CFX-'),
  '7.1 Complaint submission succeeds even when Gemini image model crashes completely'
);
assert(
  resilientComplaint.imageAnalysis.status === 'Failed',
  '7.2 imageAnalysis status is cleanly marked as Failed'
);
assert(
  resilientComplaint.imageUrl.includes('res.cloudinary.com'),
  '7.3 Cloudinary image URL was successfully preserved and returned'
);

// -----------------------------------------------------------------------------
// 8. IMAGE ANALYSIS PERSISTENCE & SCHEMA VALIDATION
// -----------------------------------------------------------------------------
console.log('\n--- 8. Image Analysis Mongoose Schema Persistence ---');

const testDoc = new Complaint({
  complaintId: 'CFX-20261119-1001',
  title: 'Garbage accumulation near dumpster',
  description: 'Uncollected refuse spreading across public walkway.',
  category: 'Garbage',
  location: { address: '12 Elm St', latitude: 37.7749, longitude: -122.4194 },
  imageUrl: 'https://res.cloudinary.com/civicfix/image/upload/v1/dumpster.jpg',
  imageAnalysis: {
    status: 'Completed',
    possibleIssueType: 'Overflowing Dumpster',
    shortDescription: 'Commercial garbage bin overflowing with discarded cardboard and waste bags.',
    suggestedCategory: 'Garbage',
    suggestedSeverity: 'Medium',
    confidence: 'High',
    isUnclearOrUnsuitable: false,
    unsuitableReason: null,
    analyzedAt: new Date(),
    errorMessage: null
  }
});

let schemaValidated = false;
try {
  await testDoc.validate();
  schemaValidated = true;
} catch (err) {
  schemaValidated = false;
}
assert(
  schemaValidated === true,
  '8.1 Valid Complaint document with imageAnalysis passes Mongoose schema validation'
);

// -----------------------------------------------------------------------------
// 9. CITIZEN TRACKING PUBLIC SERIALIZATION (toPublicJSON)
// -----------------------------------------------------------------------------
console.log('\n--- 9. Citizen Tracking Public Serialization (toPublicJSON) ---');

const publicView = testDoc.toPublicJSON();

assert(
  publicView.imageAnalysis !== null,
  '9.1 toPublicJSON() includes imageAnalysis subdocument'
);
assert(
  publicView.imageAnalysis.status === 'Completed',
  '9.2 toPublicJSON() exposes status Completed'
);
assert(
  publicView.imageAnalysis.possibleIssueType === 'Overflowing Dumpster',
  '9.3 toPublicJSON() exposes possibleIssueType'
);
assert(
  publicView.imageAnalysis.errorMessage === undefined,
  '9.4 toPublicJSON() strictly OMITS internal errorMessage for privacy and defense-in-depth'
);

// -----------------------------------------------------------------------------
// 10. ADMIN COMPLAINT DETAILS SERIALIZATION (toAdminJSON)
// -----------------------------------------------------------------------------
console.log('\n--- 10. Admin Complaint Details Serialization (toAdminJSON) ---');

const adminDoc = new Complaint({
  complaintId: 'CFX-20261119-1002',
  title: 'Failed image analysis ticket',
  description: 'Testing admin diagnostic error visibility.',
  category: 'Road Damage',
  location: { address: '44 Pine St', latitude: 37.7749, longitude: -122.4194 },
  imageUrl: 'https://res.cloudinary.com/civicfix/image/upload/v1/road.jpg',
  citizenEmail: 'citizen@example.com',
  imageAnalysis: {
    status: 'Failed',
    possibleIssueType: null,
    shortDescription: '',
    suggestedCategory: null,
    suggestedSeverity: null,
    confidence: null,
    isUnclearOrUnsuitable: false,
    unsuitableReason: null,
    analyzedAt: null,
    errorMessage: 'Google Gemini API quota limit reached. Image analysis cannot be completed right now.'
  }
});

const adminView = adminDoc.toAdminJSON();
const publicFailedView = adminDoc.toPublicJSON();

assert(
  adminView.imageAnalysis !== null && adminView.imageAnalysis.status === 'Failed',
  '10.1 toAdminJSON() exposes imageAnalysis status Failed'
);
assert(
  adminView.imageAnalysis.errorMessage.includes('quota limit reached'),
  '10.2 toAdminJSON() includes errorMessage to assist municipal staff diagnosing AI exceptions'
);
assert(
  publicFailedView.imageAnalysis.errorMessage === undefined,
  '10.3 toPublicJSON() on the same document completely conceals the errorMessage from citizens'
);

// -----------------------------------------------------------------------------
// 11. SAFE HANDLING OF PENDING, FAILED, AND MISSING STATES
// -----------------------------------------------------------------------------
console.log('\n--- 11. Safe Handling of Pending, Failed, and Missing States ---');

// 11.1 Pending with uploaded image
const pendingWithImageDoc = new Complaint({
  complaintId: 'CFX-20261119-1003',
  title: 'Pending image triage',
  description: 'Photo uploaded but AI background job has not processed yet.',
  category: 'Drainage',
  location: { address: '99 Willow Way', latitude: 37.7749, longitude: -122.4194 },
  imageUrl: 'https://res.cloudinary.com/civicfix/image/upload/v1/drain.jpg',
  imageAnalysis: {
    status: 'Pending'
  }
});
const pendingPublic = pendingWithImageDoc.toPublicJSON();
const pendingAdmin = pendingWithImageDoc.toAdminJSON();

assert(
  pendingPublic.imageAnalysis !== null && pendingPublic.imageAnalysis.status === 'Pending',
  '11.1 toPublicJSON() returns { status: "Pending" } when image is uploaded and pending'
);
assert(
  pendingAdmin.imageAnalysis !== null && pendingAdmin.imageAnalysis.status === 'Pending',
  '11.2 toAdminJSON() returns { status: "Pending" } when image is uploaded and pending'
);

// 11.2 Pending WITHOUT uploaded image (Clean null fallback)
const pendingNoImageDoc = new Complaint({
  complaintId: 'CFX-20261119-1004',
  title: 'Pending without image',
  description: 'No photo provided with this submission.',
  category: 'Streetlight',
  location: { address: '101 Birch St', latitude: 37.7749, longitude: -122.4194 },
  imageUrl: '',
  imageAnalysis: {
    status: 'Pending'
  }
});
const noImagePublic = pendingNoImageDoc.toPublicJSON();
const noImageAdmin = pendingNoImageDoc.toAdminJSON();

assert(
  noImagePublic.imageAnalysis === null,
  '11.3 toPublicJSON() returns null when no image exists (suppressing pending badge)'
);
assert(
  noImageAdmin.imageAnalysis === null,
  '11.4 toAdminJSON() returns null when no image exists (suppressing pending badge)'
);

// Clean up mock
resetUploader();

// =============================================================================
// SUMMARY REPORT
// =============================================================================
console.log('\n==================================================');
console.log(`Summary: ${passedTests}/${totalTests} Mini Phase 15.4 Image Analysis Regression tests passed.`);
console.log('==================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
