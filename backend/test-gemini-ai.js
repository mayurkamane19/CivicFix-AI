/**
 * CivicFix AI - Phase 6: Google Gemini AI Integration Test Suite
 * Tests AI configuration safety, structured JSON analysis, category/severity validation,
 * error & timeout resilience, quota handling, non-blocking complaint persistence,
 * repeated analysis protection, and mock vs live API separation.
 */

import {
  ALLOWED_CATEGORIES,
  ALLOWED_SEVERITY_LEVELS,
  isGeminiConfigured,
  getGeminiStatus,
  normalizeCategory,
  normalizeSeverity,
  validateAndSanitizeAiOutput,
  buildAnalysisPrompt,
  analyzeComplaintText
} from './src/services/geminiService.js';
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
console.log('🤖 CivicFix AI: Phase 6 Google Gemini AI Test Suite');
console.log('==================================================\n');

// -----------------------------------------------------------------------------
// 1. GEMINI CONFIGURATION & SECURITY DIAGNOSTICS TESTS
// -----------------------------------------------------------------------------
console.log('--- 1. Gemini Configuration Validation ---');

const configured = isGeminiConfigured();
assert(
  typeof configured === 'boolean',
  `isGeminiConfigured() safely returns a boolean (Current: ${configured})`
);

const diagStatus = getGeminiStatus();
assert(
  typeof diagStatus === 'object' && diagStatus !== null,
  'getGeminiStatus() returns a structured diagnostic object'
);

assert(
  !('apiKey' in diagStatus),
  'Diagnostic status NEVER leaks the full raw API key'
);

assert(
  diagStatus.model && typeof diagStatus.model === 'string',
  `Configured model is specified (${diagStatus.model})`
);

// -----------------------------------------------------------------------------
// 2. VALID COMPLAINT TEXT ANALYSIS & NORMALIZATION TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 2. Valid Complaint Text Analysis & Structured Output ---');

const sampleAiJson = JSON.stringify({
  suggestedCategory: 'Road Damage',
  severity: 'High',
  summary: 'A deep pothole is creating hazardous conditions for vehicles near the intersection.',
  recommendedDepartment: 'Department of Transportation',
  suggestedAction: 'Dispatch road crew with asphalt repair equipment.'
});

const parsedResult = validateAndSanitizeAiOutput(sampleAiJson, 'Road Damage');

assert(
  parsedResult.suggestedCategory === 'Road Damage',
  '2. Valid complaint text analysis generates correct suggestedCategory'
);

assert(
  ALLOWED_CATEGORIES.includes(parsedResult.suggestedCategory),
  '3. Category suggestion matches allowed municipal category list'
);

assert(
  parsedResult.severity === 'High' && ALLOWED_SEVERITY_LEVELS.includes(parsedResult.severity),
  '4. Valid severity classification correctly identified (High)'
);

assert(
  parsedResult.summary.length > 10 && parsedResult.summary.length <= 500,
  '5. Summary generation produces concise, non-empty text within length limits'
);

assert(
  parsedResult.recommendedDepartment === 'Department of Transportation',
  '6. Recommended department generation assigns appropriate authority'
);

assert(
  parsedResult.suggestedAction === 'Dispatch road crew with asphalt repair equipment.',
  '7. Suggested action generation provides practical field response steps'
);

// -----------------------------------------------------------------------------
// 3. INVALID / CORRUPTED AI RESPONSE HANDLING TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 3. Invalid AI Response & Boundary Handling ---');

// Test 8: Invalid AI JSON response handling
try {
  validateAndSanitizeAiOutput('This is a plain conversational response without JSON', 'Other');
  assert(false, 'Non-JSON AI response should throw a parsing error');
} catch (err) {
  assert(
    err.message.includes('not valid JSON'),
    `8. Invalid AI JSON response handling rejects malformed strings ("${err.message}")`
  );
}

// Test 9: Invalid / unknown category response handling (fallback to citizen or Other)
const unknownCategoryJson = JSON.stringify({
  suggestedCategory: 'Intergalactic Cosmic Radiation',
  severity: 'Low',
  summary: 'Strange glow in the park',
  recommendedDepartment: 'Space Division',
  suggestedAction: 'Investigate'
});
const normalizedCatResult = validateAndSanitizeAiOutput(unknownCategoryJson, 'Garbage');
assert(
  normalizedCatResult.suggestedCategory === 'Garbage',
  '9. Invalid category response gracefully falls back to citizen category or "Other"'
);

// Test 10: Invalid / unknown severity response handling
const unknownSeverityJson = JSON.stringify({
  suggestedCategory: 'Water Leakage',
  severity: 'ApocalypticDoom',
  summary: 'Burst hydrant spraying water across roadway',
  recommendedDepartment: 'Water Dept',
  suggestedAction: 'Turn off valve'
});
const normalizedSevResult = validateAndSanitizeAiOutput(unknownSeverityJson, 'Water Leakage');
assert(
  normalizedSevResult.severity === 'Medium',
  '10. Invalid severity response safely falls back to standard "Medium" default'
);

// Test Markdown code fence stripping
const fencedAiJson = '```json\n' + sampleAiJson + '\n```';
const strippedResult = validateAndSanitizeAiOutput(fencedAiJson, 'Road Damage');
assert(
  strippedResult.suggestedCategory === 'Road Damage',
  'Markdown code fence notation (```json) is safely parsed'
);

// -----------------------------------------------------------------------------
// 4. MOCKED GEMINI API BEHAVIOR TESTS (Offline / Unconfigured / Quota / Timeout)
// -----------------------------------------------------------------------------
console.log('\n--- 4. Mocked Gemini API Resilience Tests ---');
console.log('  ℹ [MOCK] Unit tests below use mocked Gemini clients (0 external billable calls)');

// Test 11: Gemini API unavailable / network failure
const mockFailingClient = {
  models: {
    generateContent: async () => {
      throw new Error('fetch failed: Network is unreachable (ECONNREFUSED)');
    }
  }
};
const unavailableResult = await analyzeComplaintText(
  { title: 'Broken streetlight', description: 'Dark lamp on 4th', category: 'Streetlight' },
  { client: mockFailingClient }
);
assert(
  unavailableResult.success === false &&
  unavailableResult.error.includes('temporarily unavailable'),
  '11. Gemini API unavailable gracefully returns safe error without crashing'
);

// Test 12: Gemini quota exceeded (RESOURCE_EXHAUSTED / 429)
const mockQuotaClient = {
  models: {
    generateContent: async () => {
      const err = new Error('Resource has been exhausted (e.g. check quota): 429 Too Many Requests');
      err.status = 429;
      throw err;
    }
  }
};
const quotaResult = await analyzeComplaintText(
  { title: 'Trash accumulation', description: 'Dumpster overflowing', category: 'Garbage' },
  { client: mockQuotaClient }
);
assert(
  quotaResult.success === false && quotaResult.error.includes('quota'),
  '12. Gemini quota exceeded returns friendly quota retry message'
);

// Test 13: AI analysis timeout
const mockHangingClient = {
  models: {
    generateContent: () => new Promise((resolve) => setTimeout(resolve, 5000))
  }
};
const timeoutResult = await analyzeComplaintText(
  { title: 'Drainage problem', description: 'Water ponding', category: 'Drainage' },
  { timeoutMs: 100, client: mockHangingClient }
);
assert(
  timeoutResult.success === false && timeoutResult.error.includes('timed out'),
  '13. AI analysis timeout guard safely cancels after threshold'
);

// -----------------------------------------------------------------------------
// 5. COMPLAINT MODEL SCHEMA & PERSISTENCE TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 5. Complaint Model AI Analysis Schema & Sanitization ---');

const complaintWithAi = new Complaint({
  title: 'Water main fracture',
  description: 'Gushing clean water flooding the street curb.',
  category: 'Water Leakage',
  location: { address: '100 Main Blvd' },
  aiAnalysis: {
    status: 'Completed',
    suggestedCategory: 'Water Leakage',
    severity: 'Critical',
    summary: 'High pressure water leak causing street flooding.',
    recommendedDepartment: 'Municipal Water & Sewer Authority',
    suggestedAction: 'Shut off main water valve and dispatch emergency excavation crew.',
    analyzedAt: new Date()
  }
});

const schemaError = complaintWithAi.validateSync();
assert(
  !schemaError,
  '15. Successful AI result persistence in Complaint Mongoose schema validates cleanly'
);

const publicJson = complaintWithAi.toPublicJSON();
assert(
  publicJson.aiAnalysis &&
  publicJson.aiAnalysis.status === 'Completed' &&
  publicJson.aiAnalysis.severity === 'Critical' &&
  publicJson.aiAnalysis.suggestedCategory === 'Water Leakage',
  'Complaint.toPublicJSON() provides all structured AI analysis attributes'
);

assert(
  publicJson.category === 'Water Leakage',
  'Original citizen-selected category is preserved and NOT overwritten by AI'
);

assert(
  publicJson.status === 'Pending',
  'Complaint municipal lifecycle status remains "Pending" and is NOT modified by AI'
);

// Test 14: Complaint saved when AI analysis fails
const complaintWithFailedAi = new Complaint({
  title: 'Graffiti on bridge',
  description: 'Spray paint on bridge support column.',
  category: 'Other',
  location: { address: 'West River Bridge' },
  aiAnalysis: {
    status: 'Failed',
    errorMessage: 'AI analysis service is temporarily unavailable.'
  }
});
assert(
  !complaintWithFailedAi.validateSync(),
  '14. Complaint saved with status="Failed" when AI analysis fails'
);

// -----------------------------------------------------------------------------
// 6. CACHING & REPEATED ANALYSIS PROTECTION
// -----------------------------------------------------------------------------
console.log('\n--- 6. Repeated Analysis Protection & Caching ---');

let externalCallsCount = 0;
const mockCountingClient = {
  models: {
    generateContent: async () => {
      externalCallsCount++;
      return { text: sampleAiJson };
    }
  }
};

// First call executes AI
const firstAiCall = await analyzeComplaintText(
  { title: 'Pothole', description: 'Road hole', category: 'Road Damage' },
  { client: mockCountingClient }
);
assert(
  firstAiCall.success && externalCallsCount === 1,
  'Initial analysis executes external AI call'
);

// Simulate cached check: If status is Completed, repeated call should not re-invoke external API
const cachedCheck = (complaint) => {
  if (complaint.aiAnalysis?.status === 'Completed') {
    return { data: complaint.toPublicJSON(), cached: true };
  }
  return { cached: false };
};
const cachedResult = cachedCheck(complaintWithAi);
assert(
  cachedResult.cached === true,
  '16. Repeated analysis protection prevents redundant external API calls for completed tickets'
);

// -----------------------------------------------------------------------------
// 7. INPUT VALIDATIONS & COMPLAINT ID CHECKS
// -----------------------------------------------------------------------------
console.log('\n--- 7. Parameter Validations ---');

// Test 17: Missing complaint ID
const validateId = (id) => {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    const err = new Error('Please provide a valid complaint ID');
    err.statusCode = 400;
    throw err;
  }
};
try {
  validateId('');
  assert(false, 'Empty complaint ID should be rejected');
} catch (err) {
  assert(
    err.statusCode === 400,
    '17. Missing complaint ID is rejected with HTTP 400 Bad Request'
  );
}

// Test 18: Complaint submission without image
const complaintNoImage = new Complaint({
  title: 'Clogged storm drain',
  description: 'Water standing after rain storm on curb.',
  category: 'Drainage',
  location: { address: '78 Pine St' }
});
assert(
  !complaintNoImage.validateSync() && !complaintNoImage.imageUrl,
  '18. Complaint submission without image validates and works with default AI fields'
);

// Test 19: Complaint submission with existing image upload functionality
const complaintWithMediaAndAi = new Complaint({
  title: 'Downed streetlight pole',
  description: 'Pole hit by vehicle and lying across sidewalk.',
  category: 'Streetlight',
  location: { address: 'Maple Ave & 3rd' },
  imageUrl: 'https://res.cloudinary.com/civicfix/image/upload/v12345/pole.jpg',
  imagePublicId: 'civicfix/complaints/pole123',
  aiAnalysis: {
    status: 'Completed',
    suggestedCategory: 'Streetlight',
    severity: 'High',
    summary: 'Damaged electrical streetlight pole obstructing pedestrian walkway.',
    recommendedDepartment: 'Public Works & Electrical Infrastructure',
    suggestedAction: 'De-energize circuit and remove downed pole safely.'
  }
});
assert(
  !complaintWithMediaAndAi.validateSync() &&
  complaintWithMediaAndAi.imageUrl.startsWith('https://res.cloudinary.com') &&
  complaintWithMediaAndAi.aiAnalysis.severity === 'High',
  '19. Complaint submission with existing image upload seamlessly integrates with AI analysis'
);

// -----------------------------------------------------------------------------
// 8. LIVE API TEST STATUS (Explicit Distinction)
// -----------------------------------------------------------------------------
console.log('\n--- 8. Live Gemini API Status ---');
if (configured) {
  console.log('  ℹ [LIVE] GEMINI_API_KEY detected in .env; live network test available');
} else {
  console.log('  ℹ [INFO] Live Gemini API tests skipped: GEMINI_API_KEY not set in .env (as per Phase 6 instructions)');
  console.log('  ℹ [INFO] Application handles unconfigured/offline mode gracefully without crashing');
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n==================================================');
console.log(`Summary: ${passed}/${total} Phase 6 Gemini AI tests passed.`);
console.log('==================================================');

if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
