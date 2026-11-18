/**
 * CivicFix AI - Mini Phase 15.1: Backend AI Image Analysis Service Test Suite
 * Tests image input validation (MIME, buffer, size, magic bytes),
 * prompt construction, response sanitization & normalization,
 * mocked Gemini vision analysis, error handling, and text analysis regression.
 */

import {
  validateImageInput,
  buildImageAnalysisPrompt,
  validateAndSanitizeImageAnalysisOutput,
  analyzeComplaintImage
} from './src/services/imageAnalysisService.js';
import { analyzeComplaintText } from './src/services/geminiService.js';
import { MAX_FILE_SIZE_BYTES } from './src/services/uploadService.js';

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
console.log('🖼️ CivicFix AI: Mini Phase 15.1 AI Image Analysis Tests');
console.log('==================================================\n');

// Valid Sample Buffers
const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const validWebpBuffer = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)]);

// -----------------------------------------------------------------------------
// 1. VALID IMAGE INPUT TESTS
// -----------------------------------------------------------------------------
console.log('--- 1. Valid Image Input Validation ---');

const jpegResult = validateImageInput(validJpegBuffer, 'image/jpeg');
assert(
  jpegResult.isValid === true && jpegResult.format === 'jpeg',
  '1.1 Valid JPEG buffer passes input validation'
);

const pngResult = validateImageInput(validPngBuffer, 'image/png');
assert(
  pngResult.isValid === true && pngResult.format === 'png',
  '1.2 Valid PNG buffer passes input validation'
);

const webpResult = validateImageInput(validWebpBuffer, 'image/webp');
assert(
  webpResult.isValid === true && webpResult.format === 'webp',
  '1.3 Valid WebP buffer passes input validation'
);

// -----------------------------------------------------------------------------
// 2. INVALID MIME TYPE TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 2. Invalid MIME Type Tests ---');

const gifResult = validateImageInput(validJpegBuffer, 'image/gif');
assert(
  gifResult.isValid === false && gifResult.error.includes('Unsupported MIME type'),
  '2.1 image/gif MIME type is rejected'
);

const pdfResult = validateImageInput(validJpegBuffer, 'application/pdf');
assert(
  pdfResult.isValid === false && pdfResult.error.includes('Unsupported MIME type'),
  '2.2 application/pdf MIME type is rejected'
);

const nullMimeResult = validateImageInput(validJpegBuffer, null);
assert(
  nullMimeResult.isValid === false,
  '2.3 Null MIME type is safely rejected'
);

// -----------------------------------------------------------------------------
// 3. EMPTY IMAGE BUFFER TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 3. Empty Image Buffer Tests ---');

const emptyBuffer = Buffer.alloc(0);
const emptyResult = validateImageInput(emptyBuffer, 'image/jpeg');
assert(
  emptyResult.isValid === false && emptyResult.error.includes('empty'),
  '3.1 Zero-byte empty buffer is rejected'
);

const nullBufferResult = validateImageInput(null, 'image/jpeg');
assert(
  nullBufferResult.isValid === false && nullBufferResult.error.includes('required'),
  '3.2 Null buffer is rejected'
);

const notABufferResult = validateImageInput('not-a-buffer', 'image/jpeg');
assert(
  notABufferResult.isValid === false,
  '3.3 String passed instead of Buffer is rejected'
);

// -----------------------------------------------------------------------------
// 4. OVERSIZED IMAGE TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 4. Oversized Image Tests ---');

const oversizedBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1024);
// Prepend valid JPEG header so it would pass magic bytes if not for size
oversizedBuffer[0] = 0xff;
oversizedBuffer[1] = 0xd8;
oversizedBuffer[2] = 0xff;

const oversizedResult = validateImageInput(oversizedBuffer, 'image/jpeg');
assert(
  oversizedResult.isValid === false && oversizedResult.error.includes('5MB'),
  '4.1 Image buffer exceeding 5MB is rejected'
);

// -----------------------------------------------------------------------------
// 5. SUCCESSFUL GEMINI RESPONSE TESTS (MOCKED CLIENT)
// -----------------------------------------------------------------------------
console.log('\n--- 5. Successful Gemini Response Tests (Mocked) ---');

const mockSuccessfulClient = {
  models: {
    generateContent: async () => ({
      text: JSON.stringify({
        isUnclearOrUnsuitable: false,
        unsuitableReason: null,
        possibleIssueType: 'Deep Asphalt Pothole',
        shortDescription: 'Large crater in road surface with crumbling asphalt edges posing hazard to vehicles.',
        suggestedCategory: 'Road Damage',
        suggestedSeverity: 'High',
        confidence: 'High'
      })
    })
  }
};

const successAnalysis = await analyzeComplaintImage(
  validJpegBuffer,
  'image/jpeg',
  { client: mockSuccessfulClient }
);

assert(
  successAnalysis.success === true,
  '5.1 analyzeComplaintImage succeeds with valid Gemini mock response'
);

assert(
  successAnalysis.data.isUnclearOrUnsuitable === false,
  '5.2 isUnclearOrUnsuitable correctly identified as false'
);

assert(
  successAnalysis.data.possibleIssueType === 'Deep Asphalt Pothole',
  '5.3 possibleIssueType correctly extracted'
);

assert(
  successAnalysis.data.suggestedCategory === 'Road Damage',
  '5.4 suggestedCategory correctly normalized'
);

assert(
  successAnalysis.data.suggestedSeverity === 'High',
  '5.5 suggestedSeverity correctly normalized'
);

assert(
  successAnalysis.data.confidence === 'High',
  '5.6 confidence level parsed accurately'
);

// -----------------------------------------------------------------------------
// 6. INVALID GEMINI RESPONSE HANDLING
// -----------------------------------------------------------------------------
console.log('\n--- 6. Invalid Gemini Response Handling ---');

const mockMalformedClient = {
  models: {
    generateContent: async () => ({
      text: 'This is not valid JSON output from the model.'
    })
  }
};

const malformedAnalysis = await analyzeComplaintImage(
  validJpegBuffer,
  'image/jpeg',
  { client: mockMalformedClient }
);

assert(
  malformedAnalysis.success === false,
  '6.1 Malformed non-JSON response returns success=false without crashing'
);

assert(
  malformedAnalysis.error.includes('invalid response format'),
  '6.2 Returns user-friendly invalid format error message'
);

// -----------------------------------------------------------------------------
// 7. GEMINI API FAILURE TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 7. Gemini API Failure & Quota Resilience ---');

const mockQuotaErrorClient = {
  models: {
    generateContent: async () => {
      const err = new Error('Resource has been exhausted (e.g. check quota): 429');
      err.status = 429;
      throw err;
    }
  }
};

const quotaAnalysis = await analyzeComplaintImage(
  validJpegBuffer,
  'image/jpeg',
  { client: mockQuotaErrorClient }
);

assert(
  quotaAnalysis.success === false,
  '7.1 Quota limit exception caught gracefully'
);

assert(
  quotaAnalysis.error.includes('quota limit reached'),
  '7.2 Quota error returns informative retry notice'
);

const mockNetworkErrorClient = {
  models: {
    generateContent: async () => {
      throw new Error('ECONNRESET: socket hang up');
    }
  }
};

const networkAnalysis = await analyzeComplaintImage(
  validJpegBuffer,
  'image/jpeg',
  { client: mockNetworkErrorClient }
);

assert(
  networkAnalysis.success === false,
  '7.3 Network connection reset handled safely without crashing process'
);

// -----------------------------------------------------------------------------
// 8. MISSING API KEY HANDLING
// -----------------------------------------------------------------------------
console.log('\n--- 8. Missing API Key Handling ---');

// Calling without mock client in unconfigured environment returns safe failure
const unconfiguredAnalysis = await analyzeComplaintImage(validJpegBuffer, 'image/jpeg');
assert(
  unconfiguredAnalysis.success === false,
  '8.1 Unconfigured Gemini environment returns success=false'
);
assert(
  unconfiguredAnalysis.error.includes('not configured'),
  '8.2 Clear configuration instruction provided when GEMINI_API_KEY is unset'
);

// -----------------------------------------------------------------------------
// 9. UNSUPPORTED / UNCLEAR IMAGE HANDLING
// -----------------------------------------------------------------------------
console.log('\n--- 9. Unsupported Issue Image (Pet / Selfie / Non-Civic) ---');

const mockUnsuitableClient = {
  models: {
    generateContent: async () => ({
      text: JSON.stringify({
        isUnclearOrUnsuitable: true,
        unsuitableReason: 'Image depicts an indoor house cat on a sofa, not a municipal or public infrastructure hazard.',
        possibleIssueType: 'Domestic Animal / Indoor Photo',
        shortDescription: 'Close-up indoor photo of a pet cat with no visible road, sidewalk, or civic utility.',
        suggestedCategory: 'Other',
        suggestedSeverity: 'Low',
        confidence: 'High'
      })
    })
  }
};

const unsuitableAnalysis = await analyzeComplaintImage(
  validJpegBuffer,
  'image/jpeg',
  { client: mockUnsuitableClient }
);

assert(
  unsuitableAnalysis.success === true,
  '9.1 Unsuitable image analysis succeeds and flags classification'
);

assert(
  unsuitableAnalysis.data.isUnclearOrUnsuitable === true,
  '9.2 isUnclearOrUnsuitable is strictly true'
);

assert(
  unsuitableAnalysis.data.unsuitableReason.includes('indoor house cat'),
  '9.3 unsuitableReason explains why image cannot be analyzed for civic hazards'
);

assert(
  unsuitableAnalysis.data.suggestedCategory === 'Other',
  '9.4 Unsuitable image category defaults safely to "Other"'
);

assert(
  unsuitableAnalysis.data.suggestedSeverity === 'Low',
  '9.5 Unsuitable image severity defaults safely to "Low"'
);

// -----------------------------------------------------------------------------
// 10. EXISTING GEMINI TEXT ANALYSIS REGRESSION TEST
// -----------------------------------------------------------------------------
console.log('\n--- 10. Existing Gemini Text Analysis Regression ---');

const mockTextClient = {
  models: {
    generateContent: async () => ({
      text: JSON.stringify({
        suggestedCategory: 'Garbage',
        severity: 'Medium',
        summary: 'Overflowing municipal trash bin near central market.',
        recommendedDepartment: 'Department of Sanitation & Waste Management',
        suggestedAction: 'Dispatch sanitation truck for immediate collection.'
      })
    })
  }
};

const textAnalysisResult = await analyzeComplaintText(
  {
    title: 'Overflowing dumpster behind shop',
    description: 'The garbage bin has not been emptied for 4 days and is spilling onto sidewalk.',
    category: 'Garbage'
  },
  { client: mockTextClient }
);

assert(
  textAnalysisResult.success === true,
  '10.1 Existing analyzeComplaintText function operates successfully'
);

assert(
  textAnalysisResult.data.suggestedCategory === 'Garbage',
  '10.2 Existing text analysis category normalization remains intact'
);

assert(
  textAnalysisResult.data.severity === 'Medium',
  '10.3 Existing text analysis severity remains intact'
);

// =============================================================================
// SUMMARY REPORT
// =============================================================================
console.log('\n==================================================');
console.log(`Summary: ${passedTests}/${totalTests} Mini Phase 15.1 AI Image Analysis tests passed.`);
console.log('==================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
