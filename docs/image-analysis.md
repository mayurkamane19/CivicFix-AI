# CivicFix AI – Multimodal AI Image Analysis Documentation

## 1. Overview & Architecture

CivicFix AI incorporates multimodal generative artificial intelligence powered by the Google Gen AI SDK (`@google/genai`) to automatically analyze citizen-uploaded photographs of public infrastructure hazards.

The image analysis engine functions as an **advisory intelligence layer** designed to assist municipal dispatchers and field crews by:
- Identifying specific defect types (e.g., potholes, asphalt crumbling, garbage overflow, burst water pipes, damaged streetlights).
- Generating concise 1–2 sentence factual visual scene descriptions.
- Recommending municipal service categories and initial severity classifications.
- Detecting unclear, blurry, or non-civic photos (e.g., indoor living spaces, personal selfies, pets) and attaching advisory flags.

```
[ Citizen Image Upload ] (Multipart/form-data)
           │
           ▼
[ Multer In-Memory Storage ] (Max 5 MB RAM buffer)
           │
           ▼
[ Magic Byte Validation ] ──(Invalid)──> [ HTTP 400 Bad Request ]
           │
        (Valid)
           ▼
[ Cloudinary Stream ] ──> [ Persistent CDN URL ] (Single Upload Guarantee)
           │
           ▼
[ Google Gemini Vision ] (gemini-2.5-flash)
   ├── Inlined Base64 Image Buffer
   └── Structured System Prompt & Schema
           │
    ┌──────┴──────────────────────────┐
 (Success)                         (Failure / Timeout)
    │                                 │
    ▼                                 ▼
[ imageAnalysis.status = 'Completed' ] [ imageAnalysis.status = 'Failed' ]
[ Defect Type, Category, Severity ]   [ Sanitized Diagnostic Message ]
    │                                 │
    └──────────────┬──────────────────┘
                   ▼
     [ Atomic MongoDB Persistence ]
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
 [ Citizen Tracking API ]   [ Admin Operations API ]
 (toPublicJSON)             (toAdminJSON)
 - Status badge             - Status badge
 - Detected issue type      - Detected issue type
 - Visual description       - Visual description
 - Category & severity      - Category & severity
 - Unsuitable photo warning - Unsuitable photo warning
 - Internal errors OMITTED  - Internal errorMessage exposed
```

---

## 2. Supported Image Formats & Size Limits

To defend against extension-spoofed malicious files and denial-of-service payloads, all uploaded images undergo a strict two-layer validation pipeline prior to passing to external services:

| Property | Policy / Constraint | Validation Mechanism |
| :--- | :--- | :--- |
| **Max File Size** | 5 MB (`5 * 1024 * 1024` bytes) | Multer middleware bounds + buffer length verification (`MAX_FILE_SIZE_BYTES`) |
| **Allowed MIME Types** | `image/jpeg`, `image/png`, `image/webp` | Express file filter + MIME whitelist validation |
| **Magic Byte Inspection** | JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), WebP (`RIFF....WEBP`) | Binary header inspection (`validateImageBuffer` in `uploadService.js`) |
| **Storage Mode** | In-Memory (`multer.memoryStorage()`) | Zero local disk writes; shared between Cloudinary and Gemini |

If an image fails MIME or magic-byte verification, the request is rejected with `HTTP 400 Bad Request` before any Cloudinary upload or Gemini API invocation occurs.

---

## 3. Gemini Vision Integration & Failure Handling

### 3.1 Model & Configuration
- **Model:** `gemini-2.5-flash` (or configured default in `geminiService.js`).
- **Temperature:** `0.2` (low variance for consistent classification).
- **Output Format:** Strict structured JSON (`application/json`).
- **Client Fallback:** If `GEMINI_API_KEY` is unconfigured, the service returns `{ success: false, error: '...' }` gracefully without throwing unhandled exceptions.

### 3.2 Output Schema
The model returns structured analysis matching this contract:
```json
{
  "isUnclearOrUnsuitable": false,
  "unsuitableReason": null,
  "possibleIssueType": "Asphalt Pothole",
  "shortDescription": "Deep depression in asphalt roadway exposing sub-base aggregate.",
  "suggestedCategory": "Road Damage",
  "suggestedSeverity": "High",
  "confidence": "High"
}
```

### 3.3 Unsuitable Image Detection
If an uploaded photo does not depict civic infrastructure (e.g., an indoor room, pet, or selfie):
- `isUnclearOrUnsuitable` is set to `true`.
- `unsuitableReason` contains a human-readable explanation.
- `suggestedCategory` defaults safely to `'Other'`.
- `suggestedSeverity` defaults safely to `'Low'`.

### 3.4 Non-Blocking Resilience & Error Boundaries
Image analysis is wrapped in an isolated `try/catch` boundary in `complaintService.js`. If Gemini API experiences:
- **Rate Limiting / Quota Exhaustion (429):** Logged gracefully; `imageAnalysis.status` marked as `'Failed'`.
- **Request Timeout:** A 20-second timeout guard prevents hanging worker processes.
- **Service Outage / Network Drop:** Marked as `'Failed'` with a user-friendly status note.

**Core Principle:** A failure in AI image analysis **never** blocks complaint submission, rollback the database transaction, or disrupt Cloudinary media persistence.

---

## 4. Database Storage & API Serialization

### 4.1 Mongoose Schema Subdocument
Stored within the `Complaint` collection in MongoDB:
```javascript
imageAnalysis: {
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending',
    index: true
  },
  possibleIssueType: { type: String, trim: true, default: null },
  shortDescription: { type: String, trim: true, default: '' },
  suggestedCategory: { type: String, trim: true, default: null },
  suggestedSeverity: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical', null],
    default: null
  },
  confidence: {
    type: String,
    enum: ['High', 'Medium', 'Low', null],
    default: null
  },
  isUnclearOrUnsuitable: { type: Boolean, default: false },
  unsuitableReason: { type: String, trim: true, default: null },
  analyzedAt: { type: Date, default: null },
  errorMessage: { type: String, trim: true, default: null }
}
```

### 4.2 Public vs. Administrative Serialization

| Field | Citizen Public Tracking (`toPublicJSON`) | Admin Operations View (`toAdminJSON`) |
| :--- | :--- | :--- |
| `status` | Exposed (`Completed`, `Pending`, `Failed`) | Exposed |
| `possibleIssueType` | Exposed | Exposed |
| `shortDescription` | Exposed | Exposed |
| `suggestedCategory` | Exposed | Exposed |
| `suggestedSeverity` | Exposed | Exposed |
| `confidence` | Exposed | Exposed |
| `isUnclearOrUnsuitable` | Exposed | Exposed |
| `unsuitableReason` | Exposed | Exposed |
| `errorMessage` | **STRICTLY OMITTED** (Prevents system information leakage) | **Exposed** (Enables administrative diagnosis) |
| Missing Image State | Cleanly serializes as `null` | Cleanly serializes as `null` |

---

## 5. Citizen & Admin Frontend Display

### 5.1 Citizen Tracking Interface (`TrackComplaintPage.jsx`)
- Rendered conditionally when `complaintData.imageAnalysis` is present.
- Displays a dedicated card with an issue tag, visual description, suggested category, severity pill, and confidence indicator.
- If flagged as unsuitable, renders an amber warning banner:
  > **Image Advisory:** The uploaded photo was flagged as unclear, blurry, or non-civic.
- If analysis failed or is pending, renders an unobtrusive status note without raw error codes.
- Hides completely when no photo was submitted with the ticket.

### 5.2 Admin Operations Details (`AdminComplaintDetails.jsx`)
- Dedicated **"AI Image Analysis (Visual Assessment)"** panel alongside the existing text AI panel.
- Displays a side-by-side comparison between the citizen's declared category and the AI-suggested category.
- Displays diagnostic `errorMessage` when `status === 'Failed'` to facilitate troubleshooting.
- Prominent disclaimer footer reminding staff that AI findings are advisory aids and not certified determinations.

---

## 6. Relevant Test Commands

All test suites run in self-contained offline environments using mocked transports:

```powershell
cd backend

# 1. Run Focused Mini Phase 15.4 Regression Test Suite (39 tests)
npm run test:image-regression

# 2. Run Mini Phase 15.1 AI Vision Service Unit Tests (31 tests)
npm run test:image-ai

# 3. Run Mini Phase 15.2 Complaint Submission Integration Tests (22 tests)
npm run test:complaint-image

# 4. Run Mini Phase 15.3 Frontend Display & Serialization Tests (21 tests)
npm run test:frontend-display

# 5. Run All 16 Standard Backend Test Suites (426 tests)
npm test
```
