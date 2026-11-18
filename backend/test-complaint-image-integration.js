/**
 * CivicFix AI - Mini Phase 15.2: Connect AI Image Analysis to Complaint Submission Test Suite
 * Tests end-to-end integration of image analysis in complaint submission workflow,
 * failure isolation, schema persistence, category preservation, IDOR/injection defense,
 * Cloudinary single-upload enforcement, and regression safety.
 */

import mongoose from 'mongoose';
import { Complaint } from './src/models/Complaint.js';
import { createComplaint } from './src/services/complaintService.js';
import { setMockUploader, resetUploader } from './src/services/uploadService.js';

// Standalone offline mock for Mongoose DB connection and model queries
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
console.log('🔗 CivicFix AI: Mini Phase 15.2 Image Analysis Integration');
console.log('==================================================\n');

// Valid Sample Buffers
const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const fakeCorruptedBuffer = Buffer.from('<html><body>Corrupt fake image</body></html>');

// Mock Gemini Image Analysis Responses
const sampleImageAiJson = JSON.stringify({
  isUnclearOrUnsuitable: false,
  unsuitableReason: null,
  possibleIssueType: 'Asphalt Pothole',
  shortDescription: 'Deep depression in asphalt road exposing aggregate sub-base.',
  suggestedCategory: 'Road Damage',
  suggestedSeverity: 'High',
  confidence: 'High'
});

const sampleTextAiJson = JSON.stringify({
  suggestedCategory: 'Garbage',
  severity: 'Medium',
  summary: 'Overflowing municipal dumpster on sidewalk.',
  recommendedDepartment: 'Department of Sanitation & Waste Management',
  suggestedAction: 'Dispatch waste collection crew.'
});

// Setup mock Cloudinary uploader (tracks invocations)
let cloudinaryUploadCount = 0;
setMockUploader((buffer, originalname, format) => {
  cloudinaryUploadCount++;
  return Promise.resolve({
    secure_url: 'https://res.cloudinary.com/civicfix/image/upload/v1234/test-pothole.jpg',
    public_id: 'civicfix/complaints/test-pothole-123',
    format: format || 'jpeg',
    bytes: buffer.length
  });
});

// -----------------------------------------------------------------------------
// 1 & 2. COMPLAINT SUBMISSION WITH VALID IMAGE & IMAGE ANALYSIS SAVED
// -----------------------------------------------------------------------------
console.log('--- 1 & 2. Complaint Submission with Image & Analysis Persistence ---');

let geminiVisionCallCount = 0;
const mockVisionClient = {
  models: {
    generateContent: async () => {
      geminiVisionCallCount++;
      return { text: sampleImageAiJson };
    }
  }
};

const mockTextClient = {
  models: {
    generateContent: async () => ({ text: sampleTextAiJson })
  }
};

const complaintWithImage = await createComplaint({
  title: 'Large crater near school crossing',
  description: 'Deep road damage creating vehicle hazard during morning peak traffic.',
  category: 'Road Damage',
  address: '450 Oak Avenue, Sector 4',
  file: {
    buffer: validJpegBuffer,
    originalname: 'crater.jpg',
    mimetype: 'image/jpeg'
  },
  aiClient: mockTextClient,
  imageAiClient: mockVisionClient
});

assert(
  complaintWithImage.complaintId && complaintWithImage.complaintId.startsWith('CFX-'),
  '1.1 Complaint submitted with valid image generates unique CFX ticket ID'
);

assert(
  complaintWithImage.imageUrl === 'https://res.cloudinary.com/civicfix/image/upload/v1234/test-pothole.jpg',
  '1.2 Image URL is saved and returned in public complaint representation'
);

assert(
  complaintWithImage.imageAnalysis && complaintWithImage.imageAnalysis.status === 'Completed',
  '2.1 imageAnalysis status is saved as "Completed"'
);

assert(
  complaintWithImage.imageAnalysis.possibleIssueType === 'Asphalt Pothole',
  '2.2 imageAnalysis extracts possibleIssueType accurately'
);

assert(
  complaintWithImage.imageAnalysis.suggestedCategory === 'Road Damage',
  '2.3 imageAnalysis suggestedCategory is normalized'
);

assert(
  complaintWithImage.imageAnalysis.suggestedSeverity === 'High',
  '2.4 imageAnalysis suggestedSeverity is normalized'
);

assert(
  complaintWithImage.imageAnalysis.confidence === 'High',
  '2.5 imageAnalysis confidence is captured'
);

assert(
  complaintWithImage.imageAnalysis.isUnclearOrUnsuitable === false,
  '2.6 imageAnalysis unsuitable flag is false for genuine hazard image'
);

// -----------------------------------------------------------------------------
// 3. COMPLAINT SUBMITTED WITHOUT IMAGE (GEMINI VISION SKIPPED)
// -----------------------------------------------------------------------------
console.log('\n--- 3. Complaint Submitted Without Image ---');

const visionCallsBeforeNoImg = geminiVisionCallCount;

const complaintWithoutImage = await createComplaint({
  title: 'Flickering street lamp',
  description: 'Lamp post flickers all night causing low visibility on corner.',
  category: 'Streetlight',
  address: 'Corner of 8th and Elm',
  aiClient: mockTextClient,
  imageAiClient: mockVisionClient
});

assert(
  geminiVisionCallCount === visionCallsBeforeNoImg,
  '3.1 Gemini image analysis vision model is NOT invoked when no image is uploaded'
);

assert(
  complaintWithoutImage.imageAnalysis === null,
  '3.2 imageAnalysis is null in response when no image is provided'
);

assert(
  complaintWithoutImage.imageUrl === '',
  '3.3 imageUrl defaults to empty string when no image is provided'
);

// -----------------------------------------------------------------------------
// 4. GEMINI FAILURE DOES NOT FAIL COMPLAINT SUBMISSION (BEST-EFFORT)
// -----------------------------------------------------------------------------
console.log('\n--- 4. Gemini Vision Failure Handling (Best-Effort) ---');

const mockFailingVisionClient = {
  models: {
    generateContent: async () => {
      throw new Error('Gemini 503: Service Unavailable or Quota Exceeded');
    }
  }
};

const complaintWithFailingVision = await createComplaint({
  title: 'Water pipe leak on sidewalk',
  description: 'Clean drinking water leaking onto sidewalk for 2 days.',
  category: 'Water Leakage',
  address: '12 River Road',
  file: {
    buffer: validJpegBuffer,
    originalname: 'leak.jpg',
    mimetype: 'image/jpeg'
  },
  aiClient: mockTextClient,
  imageAiClient: mockFailingVisionClient
});

assert(
  complaintWithFailingVision.complaintId && complaintWithFailingVision.status === 'Pending',
  '4.1 Complaint submission succeeds even when Gemini image analysis fails completely'
);

assert(
  complaintWithFailingVision.imageAnalysis && complaintWithFailingVision.imageAnalysis.status === 'Failed',
  '4.2 imageAnalysis status is cleanly marked as "Failed" without throwing'
);

// -----------------------------------------------------------------------------
// 5. INVALID IMAGE REJECTED BY EXISTING UPLOAD VALIDATION
// -----------------------------------------------------------------------------
console.log('\n--- 5. Invalid Image Buffer Rejection ---');

try {
  await createComplaint({
    title: 'Garbage dump near gate',
    description: 'Waste bags left piling up on corner.',
    category: 'Garbage',
    address: 'Sector 5 Main Gate',
    file: {
      buffer: fakeCorruptedBuffer,
      originalname: 'corrupt.jpg',
      mimetype: 'image/jpeg'
    }
  });
  assert(false, 'Corrupt image should be rejected with 400 Bad Request');
} catch (err) {
  assert(
    err.statusCode === 400 && err.message.includes('Invalid image file format'),
    '5.1 Corrupted image buffer throws HTTP 400 Bad Request prior to Gemini processing'
  );
}

// -----------------------------------------------------------------------------
// 6 & 7. ORIGINAL CATEGORY & DESCRIPTION REMAIN UNCHANGED
// -----------------------------------------------------------------------------
console.log('\n--- 6 & 7. Citizen Category & Description Preservation ---');

// AI returns "Road Damage" but citizen selected "Garbage"
const citizenOriginalCategory = 'Garbage';
const citizenOriginalDescription = 'Trash accumulation near sewer opening.';

const mockMismatchedVisionClient = {
  models: {
    generateContent: async () => ({
      text: JSON.stringify({
        isUnclearOrUnsuitable: false,
        possibleIssueType: 'Damaged Road Pavement',
        shortDescription: 'Crumbling pavement near road gutter.',
        suggestedCategory: 'Road Damage', // Mismatch with citizen's category
        suggestedSeverity: 'Low',
        confidence: 'Medium'
      })
    })
  }
};

const preservedComplaint = await createComplaint({
  title: 'Trash near sewer',
  description: citizenOriginalDescription,
  category: citizenOriginalCategory,
  address: '22 Elm Street',
  file: {
    buffer: validJpegBuffer,
    originalname: 'trash.jpg',
    mimetype: 'image/jpeg'
  },
  imageAiClient: mockMismatchedVisionClient
});

assert(
  preservedComplaint.category === citizenOriginalCategory,
  '6.1 Original citizen-selected category is preserved and NOT overwritten by AI suggestion'
);

assert(
  preservedComplaint.description === citizenOriginalDescription,
  '7.1 Original citizen description is preserved and NOT overwritten by AI visual description'
);

assert(
  preservedComplaint.imageAnalysis.suggestedCategory === 'Road Damage',
  '7.2 AI suggestedCategory is recorded in imageAnalysis subdocument for advisory comparison'
);

// -----------------------------------------------------------------------------
// 8. FRONTEND CANNOT INJECT FAKE AI ANALYSIS RESULTS
// -----------------------------------------------------------------------------
console.log('\n--- 8. Frontend AI Result Injection Defense ---');

const injectionAttempt = await createComplaint({
  title: 'Clogged storm drain',
  description: 'Drain blocked with plastic bags.',
  category: 'Drainage',
  address: '9th Ave Culvert',
  // Malicious attacker attempts to bypass Gemini and inject verified Critical status
  imageAnalysis: {
    status: 'Completed',
    suggestedSeverity: 'Critical',
    possibleIssueType: 'Fabricated High Hazard'
  },
  aiAnalysis: {
    status: 'Completed',
    severity: 'Critical'
  }
});

// Since no file was uploaded, imageAnalysis should be null (ignoring injected payload)
assert(
  injectionAttempt.imageAnalysis === null,
  '8.1 Client-provided fake imageAnalysis is strictly ignored and not persisted'
);

// -----------------------------------------------------------------------------
// 9. IMAGE IS NOT UPLOADED TO CLOUDINARY TWICE
// -----------------------------------------------------------------------------
console.log('\n--- 9. Single Cloudinary Upload Verification ---');

const uploadCountBefore = cloudinaryUploadCount;

await createComplaint({
  title: 'Broken park bench and streetlight',
  description: 'Dark park entrance due to broken lamp pole.',
  category: 'Streetlight',
  address: 'City Central Park South Gate',
  file: {
    buffer: validJpegBuffer,
    originalname: 'park-lamp.jpg',
    mimetype: 'image/jpeg'
  },
  imageAiClient: mockVisionClient
});

assert(
  cloudinaryUploadCount === uploadCountBefore + 1,
  '9.1 Image buffer is uploaded to Cloudinary exactly once per complaint submission'
);

// -----------------------------------------------------------------------------
// 10, 11 & 12. FULL SYSTEM REGRESSION CHECKS
// -----------------------------------------------------------------------------
console.log('\n--- 10, 11 & 12. Full System Regressions ---');

// 10. Existing complaint submission regression
assert(
  complaintWithoutImage.status === 'Pending' && complaintWithoutImage.submissionDate,
  '10.1 Complaint submission maintains default status "Pending" and valid submissionDate'
);

// 11. Existing Gemini text analysis regression
assert(
  complaintWithImage.aiAnalysis && complaintWithImage.aiAnalysis.status === 'Completed',
  '11.1 Text aiAnalysis operates independently and co-exists alongside imageAnalysis'
);

// 12. Existing image upload regression
assert(
  complaintWithImage.imageUrl.startsWith('https://res.cloudinary.com') &&
  complaintWithImage.imagePublicId === undefined,
  '12.1 Public JSON provides HTTPS imageUrl while strictly concealing internal Cloudinary publicId'
);

// Reset mock uploader
resetUploader();

// =============================================================================
// SUMMARY REPORT
// =============================================================================
console.log('\n==================================================');
console.log(`Summary: ${passedTests}/${totalTests} Mini Phase 15.2 Integration tests passed.`);
console.log('==================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
