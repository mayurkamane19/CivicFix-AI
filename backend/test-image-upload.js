/**
 * CivicFix AI - Phase 5: Image Upload & Cloudinary Integration Test Suite
 * Tests media validation, magic byte detection, file size limits, MIME types,
 * Cloudinary status security, and rollback mechanics.
 */

import {
  validateImageBuffer,
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS
} from './src/services/uploadService.js';
import { isCloudinaryConfigured, getCloudinaryStatus } from './src/config/cloudinary.js';
import { Complaint } from './src/models/Complaint.js';
import { createComplaint } from './src/services/complaintService.js';

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
console.log('🖼️ CivicFix AI: Phase 5 Image Upload & Cloudinary Test Suite');
console.log('==================================================\n');

// -----------------------------------------------------------------------------
// 1. CLOUDINARY CONFIGURATION & STATUS SECURITY TESTS
// -----------------------------------------------------------------------------
console.log('--- 1. Cloudinary Configuration & Security Tests ---');

const isConfigured = isCloudinaryConfigured();
assert(
  typeof isConfigured === 'boolean',
  `isCloudinaryConfigured() safely returns a boolean (Current: ${isConfigured})`
);

const status = getCloudinaryStatus();
assert(
  typeof status === 'object' && status !== null,
  'getCloudinaryStatus() returns a structured diagnostic object'
);

assert(
  status.configured === isConfigured,
  'Configured status accurately reflects environment credentials presence'
);

assert(
  !('apiSecret' in status) && !('api_secret' in status),
  'Cloudinary diagnostic output NEVER exposes API secret'
);

// -----------------------------------------------------------------------------
// 2. BUFFER MAGIC NUMBER (SIGNATURE) VERIFICATION TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 2. Buffer Magic Bytes Signature Tests ---');

// Synthesize valid JPEG header (FF D8 FF E0 ...)
const validJpegBuffer = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from('JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00')
]);
const jpegResult = validateImageBuffer(validJpegBuffer);
assert(
  jpegResult.isValid && jpegResult.format === 'jpeg',
  'Authentic JPEG buffer signature (0xFF, 0xD8, 0xFF) correctly identified'
);

// Synthesize valid PNG header (89 50 4E 47 0D 0A 1A 0A ...)
const validPngBuffer = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52])
]);
const pngResult = validateImageBuffer(validPngBuffer);
assert(
  pngResult.isValid && pngResult.format === 'png',
  'Authentic PNG buffer signature (0x89, PNG...) correctly identified'
);

// Synthesize valid WebP header (RIFF....WEBPVP8 ...)
const validWebpBuffer = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
  Buffer.from('VP8 ')
]);
const webpResult = validateImageBuffer(validWebpBuffer);
assert(
  webpResult.isValid && webpResult.format === 'webp',
  'Authentic WebP buffer signature (RIFF...WEBP) correctly identified'
);

// Spoofed file (text pretending to be image)
const fakeImageBuffer = Buffer.from('<html><script>alert("hacked")</script></html>');
const fakeResult = validateImageBuffer(fakeImageBuffer);
assert(
  fakeResult.isValid === false && fakeResult.format === null,
  'Malicious spoofed text/HTML buffer disguised as image is rejected'
);

// Truncated buffer (< 12 bytes)
const shortBuffer = Buffer.from([0xff, 0xd8]);
const shortResult = validateImageBuffer(shortBuffer);
assert(
  shortResult.isValid === false,
  'Truncated or incomplete buffer (< 12 bytes) is rejected'
);

// Null or non-buffer
const nullResult = validateImageBuffer(null);
assert(
  nullResult.isValid === false,
  'Null / undefined input safely returns false without crashing'
);

// -----------------------------------------------------------------------------
// 3. FILE FILTER, SIZE LIMITS & MIME CONSTRAINTS TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 3. File Filter & Size Limit Tests ---');

assert(
  MAX_FILE_SIZE_BYTES === 5 * 1024 * 1024,
  `Max file size limit is strictly 5 MB (${MAX_FILE_SIZE_BYTES} bytes)`
);

assert(
  ALLOWED_MIME_TYPES.includes('image/jpeg') &&
  ALLOWED_MIME_TYPES.includes('image/png') &&
  ALLOWED_MIME_TYPES.includes('image/webp'),
  'Allowed MIME types contain image/jpeg, image/png, and image/webp'
);

assert(
  ALLOWED_EXTENSIONS.includes('.jpg') &&
  ALLOWED_EXTENSIONS.includes('.jpeg') &&
  ALLOWED_EXTENSIONS.includes('.png') &&
  ALLOWED_EXTENSIONS.includes('.webp'),
  'Allowed file extensions contain .jpg, .jpeg, .png, and .webp'
);

assert(
  !ALLOWED_MIME_TYPES.includes('image/gif') && !ALLOWED_MIME_TYPES.includes('application/pdf'),
  'Non-permitted media formats (e.g. GIF, PDF, executables) are disallowed'
);

// -----------------------------------------------------------------------------
// 4. UNCONFIGURED CLOUDINARY ERROR HANDLING TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 4. Cloudinary Unconfigured Graceful Handling ---');

if (!isConfigured) {
  try {
    await uploadImageToCloudinary(validJpegBuffer, 'test.jpg');
    assert(false, 'Uploading without credentials should throw error');
  } catch (err) {
    assert(
      err.statusCode === 503,
      `Unconfigured upload throws HTTP 503 error (Message: "${err.message}")`
    );
  }
} else {
  console.log('  ℹ [SKIP] Live Cloudinary credentials present; skipping unconfigured check');
}

// -----------------------------------------------------------------------------
// 5. COMPLAINT MODEL IMAGE FIELD & SANITIZATION TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 5. Complaint Model Media Fields & Public Sanitization ---');

const complaintWithImage = new Complaint({
  title: 'Large water main break',
  description: 'Water gushing onto main boulevard, flooding street.',
  category: 'Water Leakage',
  location: { address: 'Corner of 4th and Main' },
  imageUrl: 'https://res.cloudinary.com/civicfix/image/upload/v1234/test.jpg',
  imagePublicId: 'civicfix/complaints/test123'
});

const validationError = complaintWithImage.validateSync();
assert(
  !validationError,
  'Complaint with imageUrl and imagePublicId passes Mongoose schema validation'
);

const publicJson = complaintWithImage.toPublicJSON();
assert(
  publicJson.imageUrl === 'https://res.cloudinary.com/civicfix/image/upload/v1234/test.jpg',
  'toPublicJSON() provides safe HTTPS image URL for frontend presentation'
);

assert(
  publicJson.imagePublicId === undefined,
  'toPublicJSON() preserves privacy by not exposing raw Cloudinary public_id'
);

// -----------------------------------------------------------------------------
// 6. COMPLAINT SUBMISSION SERVICE VALIDATION WITH MEDIA TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 6. Service Integration & Media Validation Tests ---');

// Test submitting with an invalid/corrupted file buffer
try {
  await createComplaint({
    title: 'Broken streetlight pole',
    description: 'Light is completely dark at busy intersection.',
    category: 'Streetlight',
    address: 'Oak St & 5th Ave',
    file: {
      buffer: fakeImageBuffer,
      originalname: 'corrupt.jpg'
    }
  });
  assert(false, 'Corrupt image file should be rejected with 400 Bad Request');
} catch (err) {
  assert(
    err.statusCode === 400,
    `Corrupt image buffer is rejected with HTTP 400 (Message: "${err.message}")`
  );
}

// Test rollback function exists and safely resolves null when given empty ID
const deleteEmptyResult = await deleteImageFromCloudinary('');
assert(
  deleteEmptyResult === null,
  'deleteImageFromCloudinary("") safely handles empty ID without crashing'
);

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n==================================================');
console.log(`Summary: ${passed}/${total} Phase 5 image upload tests passed.`);
console.log('==================================================');

if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
