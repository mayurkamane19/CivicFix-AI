# CivicFix AI – AI-Powered Smart Public Issue Reporting & Management System

> **Phases 1–14 & Mini Phases 15.1–15.3: Foundation, MongoDB, Authentication, Issue Reporting, Cloudinary Media, Google Gemini AI, Duplicate Detection, Municipal Admin, Security Hardening, Status History, Officer Assignment System, Smart City Interactive GIS Map, Email Notification System, Advanced Municipal Analytics, AI Image Analysis Service, Complaint Workflow Integration & Frontend UI Presentation**  
> A clean, decoupled, and scalable full-stack civic technology architecture built with React.js (Vite), Node.js (Express.js), MongoDB (Mongoose ODM), JWT, bcrypt, Multer, Cloudinary, Google Gen AI SDK (`@google/genai`), tokenized Jaccard & Haversine duplicate detection, municipal operations dashboard, defense-in-depth application security, complaint status audit trails, departmental field officer work-order assignment, interactive Leaflet GIS smart city mapping, asynchronous resilient Nodemailer email outbox, high-performance MongoDB aggregation analytics, and Google Gemini multimodal image vision analysis.

---

## 1. Project Introduction

**CivicFix AI** is an intelligent public issue reporting and resolution tracking platform designed to bridge civic communities and municipal administrative authorities. The platform allows citizens to report public infrastructure issues (such as potholes, broken street lights, garbage accumulation, and drainage failures), provides transparent tracking, employs generative AI to provide automated municipal categorization, runs lightweight duplicate detection algorithms to highlight potential repeat reports, equips municipal staff with a full operations dashboard, and enforces strict application security standards.

### Current Implementation Status:
- **Phase 1 (Complete):** Core full-stack foundation, Express backend, React + Vite landing page, and live API health check.
- **Phase 2 (Complete):** MongoDB integration via Mongoose ODM, resilient database connection manager, User and Complaint schemas with strict validation, and database health reporting.
- **Phase 3 (Complete):** User registration, login authentication, bcrypt password hashing, JWT stateless authorization, protected profile endpoint (`/api/auth/me`), and responsive frontend Sign In & Citizen Registration pages.
- **Phase 4 (Complete):** Citizen hazard reporting (`POST /api/complaints`), public ticket tracking (`GET /api/complaints/track/:complaintId`), automated unique ticket ID generation (`CFX-YYYYMMDD-XXXX`), temporary guest submissions, and responsive frontend Report Issue & Track Complaint pages.
- **Phase 5 (Complete):** Cloud media storage integration with Cloudinary & Multer, in-memory buffer handling with magic byte signature verification (JPEG, PNG, WebP up to 5 MB), orphaned asset rollback cleanup on database failure, responsive image preview in Report Issue, and evidence inspection in Track Complaint.
- **Phase 6 (Complete):** Google Gemini AI integration (`@google/genai`), automated civic issue text analysis (suggested category, severity grading, executive summary, responsible municipal department, and field crew action), prompt-injection defense, dedicated analysis endpoint (`POST /api/complaints/:complaintId/analyze`), repeated analysis protection, non-blocking fallback persistence, and responsive frontend AI Advisory cards in Report Issue and Track Complaint.
- **Phase 7 (Complete):** Duplicate complaint detection engine with token-based Jaccard text similarity and geodesic Haversine distance proximity, configurable confidence grading (High $\ge 0.80$, Medium $\ge 0.60$), dedicated duplicate check API (`POST /api/complaints/:complaintId/check-duplicates`), self-exclusion guard, and responsive frontend "Similar Complaints Found" cards.
- **Phase 8 (Complete):** Municipal Admin Operations Command Center:
  - Aggregate operational metrics (`GET /api/admin/dashboard/stats`).
  - Server-side multi-criteria complaint filtering, searching (by ticket ID, title, or address), sorting (newest/oldest), and pagination (`GET /api/admin/complaints`).
  - Full complaint inspection (`GET /api/admin/complaints/:complaintId`) with AI advice, visual evidence, duplicate detection matches, and citizen submission details.
  - Validated status transitions (`PATCH /api/admin/complaints/:complaintId/status`) supporting `Pending`, `In Progress`, and `Resolved`.
  - Secure, controlled admin account provisioning CLI script (`backend/scripts/seedAdmin.js`, `npm run seed:admin`).
- **Phase 9 (Complete):** Authentication & Security Final Review:
  - **Explicit JWT Algorithm Enforcement:** Explicit `HS256` signing and verification (`algorithms: ['HS256']`) eliminating algorithm confusion vulnerabilities.
  - **Password Security & DoS Defense:** Minimum 8 characters, maximum 128 characters (preventing bcrypt CPU-exhaustion DoS), strict string type validation, and exclusion from output serialization (`toSafeObject()`).
  - **Account Enumeration Protection:** Constant-time generic error messages (`"Invalid email or password"`) for both non-existent users and incorrect credentials.
  - **Sliding-Window Rate Limiting:** In-memory rate limiting for `/api/auth/login` (10 requests / 15 min per IP) and `/api/auth/register` (10 requests / hour per IP).
  - **OWASP Defensive Headers:** Removal of `X-Powered-By`, enforcement of `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, and `Referrer-Policy: strict-origin-when-cross-origin`.
  - **Payload Size Guards:** Explicit `100kb` body-parser limits preventing memory exhaustion attacks.
  - **Centralized Error Sanitization:** Graceful mapping of Mongoose validation, syntax, and duplicate key errors without internal driver or stack leakage.
- **Phase 10 (Complete):** Complaint Status History & Audit Logs:
  - **Embedded Status History Schema:** Single-document atomic persistence (`statusHistory` subdocument array) recording `previousStatus`, `newStatus`, `changedBy` (User ref), `changedByName` (admin display name), `note` (optional, $\le 500$ chars), and `changedAt` timestamp.
  - **Atomic Audit Trail Recording:** Enhanced `PATCH /api/admin/complaints/:complaintId/status` to validate administrative notes, detect redundant updates (suppressing duplicate logs), and atomically record transition entries.
  - **Admin History Audit API:** Dedicated `GET /api/admin/complaints/:complaintId/history` endpoint protected by `protect` and `authorize('admin')` returning chronological transition logs with admin user IDs.
  - **Privacy-Preserving Public Tracking:** Safe public serialization (`toPublicJSON()`) that includes status milestones, timestamps, and notes while strictly omitting internal admin ObjectIds to prevent administrative user enumeration.
  - **Admin Operations UI Enhancements:** Interactive update modal (`ComplaintStatusUpdate.jsx`) with live 500-character counter, and a chronological "Status History & Audit Trail" panel (`AdminComplaintDetails.jsx`) with badges, actor metadata, and administrative notes.
  - **Citizen Tracking Timeline:** Modern visual milestone timeline (`TrackComplaintPage.jsx`) displaying submission date, current progress milestone, resolution notes, and honest empty states for legacy complaints.
- **Phase 11 (Complete):** Municipal Department & Officer Assignment System:
  - **Department Management:** Dedicated Mongoose `Department` model (unique `name`, uppercase `code`, description, `isActive` toggle with safe deactivation over destructive deletion) seeded with initial departments (Road Maintenance, Sanitation, Water Supply, Electrical, Drainage, General Maintenance).
  - **Officer Role & Controlled Provisioning:** Extended User model with `role: 'officer'` and `department` reference. Public registration strictly forces `citizen` role; officers are provisioned via secure CLI script (`npm run seed:officer`) enforcing active department association and bcrypt password hashing.
  - **Complaint Assignment Architecture:** Single-document atomic persistence for complaint assignments (`assignedDepartment`, `assignedOfficer`, `assignedAt`, `assignedBy`, and embedded `assignmentHistory` array recording previous/new department and officer, admin actor, and notes $\le 500$ chars).
  - **Municipal Admin APIs:** Added `GET /api/admin/departments`, `POST /api/admin/departments`, `PATCH /api/admin/departments/:departmentId`, `GET /api/admin/officers`, `PATCH /api/admin/complaints/:complaintId/assignment`, and `GET /api/admin/complaints/:complaintId/assignment-history` guarded by `protect, authorize('admin')`.
  - **Field Officer Portal & APIs:** Dedicated officer workspace mounted at `/api/officer` (`GET /dashboard/stats`, `GET /complaints`, `GET /complaints/:complaintId`, `PATCH /complaints/:complaintId/status`) guarded by `protect, authorize('officer')`. Enforces strict IDOR protection (officers can only inspect and update their assigned complaints; cannot revert resolved complaints to pending).
  - **Safe Public Citizen Tracking:** Public tracking serialization (`toPublicJSON()`) displays assigned department and officer names and milestone progress while strictly omitting internal MongoDB ObjectIds, emails, or security credentials.
  - **Frontend Interfaces:** Admin Department Management tab, Field Officer Registry tab, Complaint Assignment modal with confirmation review step, and a dedicated Field Officer Portal (`OfficerDashboard.jsx`).
- **Phase 12 (Complete):** Interactive Smart City Complaint Map & GIS Visualization:
  - **OpenStreetMap & Leaflet Integration:** Built with `leaflet@1.9.4` and `react-leaflet@4.2.1` using standard OpenStreetMap cartographic tile layers and proper licensing attribution.
  - **Geospatial Compound Indexing:** Added compound indexes on `location.latitude` and `location.longitude` in `Complaint` schema (`{ 'location.latitude': 1, 'location.longitude': 1 }` and `{ status: 1, 'location.latitude': 1, 'location.longitude': 1 }`) for high-performance spatial range queries.
  - **Spatial Clustering Engine:** Lightweight client-side Mercator grid clustering algorithm (`clusteringUtils.js`) that groups nearby complaints into count badges at macro zoom levels and dynamically expands into individual pins upon zooming in or clicking.
  - **Color-Coded Status Markers:** SVG pin markers styled by status—Pending (Amber Orange `#f59e0b`), In Progress (Royal Blue `#2563eb`), and Resolved (Emerald Green `#10b981`)—with AI severity tags in popups.
  - **Privacy-Preserving Public Mapping:** Location approximation algorithm rounds coordinates to 3 decimal places (~100m neighborhood precision), completely stripping citizen identity, phone numbers, email addresses, and internal notes from public feeds.
  - **Backend GIS REST APIs:**
    - `GET /api/admin/map/complaints`: Admin-protected endpoint with multi-criteria filtering (category, status, AI severity, department, officer, date range) returning exact coordinates.
    - `GET /api/officer/map/complaints`: Officer-protected endpoint strictly bound to `req.user._id` (IDOR prevention) for field routing.
    - `GET /api/complaints/map`: Public unauthenticated endpoint returning privacy-anonymized coordinates.
  - **Frontend GIS Views:**
    - Admin GIS Map tab in `AdminDashboard.jsx` with real-time filters and direct link to ticket action modals.
    - Officer GIS Workload toggle in `OfficerDashboard.jsx` for inspection and status transitions on-site.
    - Citizen Public Issue Map page (`PublicComplaintMapPage.jsx`) accessible from top and mobile navigation.
- **Phase 13 (Complete):** Email Notification System & Resilient Outbox:
  - **SMTP & Nodemailer Integration:** Configurable SMTP mail delivery via `nodemailer` with environment validation (`EMAIL_ENABLED`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `EMAIL_FROM_NAME`), graceful offline fallback, and mock transporter testing capabilities.
  - **Durable Notification Outbox Pattern:** Dedicated Mongoose `NotificationLog` model recording event type, complaint reference, recipient email, role, subject, delivery status (`Pending`, `Processing`, `Sent`, `Failed`), retry count, max retries, last error, sent timestamp, idempotency key, and metadata.
  - **Idempotent Delivery & Duplicate Suppression:** Deterministic idempotency keys (`SUBMISSION_${id}`, `STATUS_${id}_${status}_${idx}`, `RESOLVED_${id}`, `DEPT_${id}_${dept}_${idx}`, `OFFICER_${id}_${officer}_${idx}`) ensuring zero duplicate notifications even under network re-tries or concurrent updates.
  - **5 Branded Responsive Templates:** Professional HTML and plain-text templates with strict XSS sanitization (`escapeHtml`):
    1. *Complaint Submission Confirmation* (with tracking link and issue summary).
    2. *Status Change Notification* (reporting transition details and administrative note).
    3. *Departmental Assignment Alert* (notifying citizen of operational department routing).
    4. *Field Officer Work-Order Dispatch* (alerting designated officer with instructions and portal link).
    5. *Issue Resolution Notice* (confirming public hazard fix and resolution notes).
  - **Citizen Consent & Anti-Spam Controls:** Explicit opt-in checkbox on submission, user preference persistence (`GET /api/notifications/preferences`, `PATCH /api/notifications/preferences`), and suppression when notifications are disabled or email is missing.
  - **Operations Resilience & Error Boundary Isolation:** All email dispatches operate asynchronously via `setImmediate()` in the background; failures never break, delay, or roll back core civic operations (complaint creation, status transitions, or officer assignments).
  - **Admin Outbox Audit APIs & UI:**
    - `GET /api/admin/notifications`: Paginated audit log endpoint with delivery status, event type, date range, and complaint search filters.
    - Admin Dashboard Outbox tab (`NotificationManagement.jsx`): Interactive log viewer with stats badges, filter dropdowns, and retry failure inspection.
- **Phase 14 (Complete):** Advanced Municipal Analytics Dashboard:
  - **High-Performance MongoDB Aggregations:** Multi-stage pipelines using early `$match` filtering, `$group` mathematical calculations, and compound query optimization indexes (`{ createdAt: -1, status: 1 }`, `{ createdAt: -1, category: 1 }`).
  - **Summary KPI Cards:** Real-time metrics for Total Complaints, Pending Triage, In Progress, Resolved Issues, Resolution Rate (%), Average & Median Resolution Time, High/Critical AI Severity, and Potential Duplicates with period-over-period percentage comparisons against equivalent prior baseline.
  - **Intake & Resolution Velocity Trends:** Time-series daily and monthly intake trends with continuous gap-filling, dual line and area SVG representations, and interactive hover tooltips.
  - **Pipeline & Category Distribution:** SVG Donut chart for status breakdown, along with horizontal stacked volume bars showing category share and resolution percentages.
  - **Department & Field Officer Workload Analytics:** Departmental workload share, resolution rate, and turnaround times, alongside field officer queue auditing with strict IDOR data isolation.
  - **Turnaround Duration Histogram:** Categorized duration brackets (<24 hrs, 1–3 days, 3–7 days, >7 days), average and median calculations, and category/department breakdown.
  - **AI Severity Risk Matrix:** Risk grading distribution (Critical, High, Medium, Low, Unanalyzed) and cross-category risk matrix with coverage indicators.
  - **Spatial Hot Spot Clustering:** Approximate ~1.1 km neighborhood area clustering (rounded to 2 decimal places) for complaint density analysis while strictly protecting citizen residential privacy.
  - **Sanitized CSV Analytics Export:** Admin-only CSV export with defense against spreadsheet Formula Injection (`=`, `+`, `-`, `@`, `\t`, `\r` escaping).
  - **Dedicated Officer Analytics:** Personal performance and turnaround metrics view in Field Officer Workspace (`OfficerDashboard.jsx`) strictly bound to `req.user._id`.
- **Mini Phase 15.1 (Complete):** Backend AI Image Analysis Service:
  - **Reusable Multimodal Vision Service:** Created `backend/src/services/imageAnalysisService.js` utilizing Google Gen AI SDK (`@google/genai`) and configured vision model (`gemini-2.5-flash`).
  - **Strict Format & Buffer Validation:** Accepts in-memory buffer, strictly validates MIME types (`image/jpeg`, `image/png`, `image/webp`), enforces 5MB limit (`MAX_FILE_SIZE_BYTES`), and verifies magic byte signatures to prevent extension-spoofed malicious files.
  - **Civic Issue Identification & Suitability Guard:** Identifies specific issue types (e.g. pothole, broken curb, garbage heap, water leak), generates 1-2 sentence descriptions, categorizes into municipal departments, and classifies severity (`Low`, `Medium`, `High`, `Critical`). Automatically flags blurry, indoor, or non-civic images (e.g. pets, selfies) via `isUnclearOrUnsuitable: true`.
  - **Decoupled Architecture:** Pure backend service with zero frontend modifications or route exposures in this mini phase; fully tested in isolation via mocked transport.
- **Mini Phase 15.2 (Complete):** Connect AI Image Analysis to Complaint Submission:
  - **Workflow Integration:** Connected `imageAnalysisService.js` directly into `createComplaint` in `complaintService.js`.
  - **In-Memory Buffer Reuse:** Consumes the uploaded `file.buffer` and `file.mimetype` without disk writes or duplicate Cloudinary uploads (single-upload guarantee).
  - **Citizen Input Immutability:** Original citizen-selected `category` and `description` are strictly preserved and never overwritten by AI suggestions. AI deductions are safely stored in `complaint.imageAnalysis.suggestedCategory` and `shortDescription` for advisory reference.
  - **Client Injection Defense:** Client-provided `imageAnalysis` or `aiAnalysis` payloads in `req.body` are strictly ignored and never accepted from the frontend.
  - **Best-Effort Failure Isolation:** Image analysis failure (Gemini unavailable, rate-limited, or unconfigured) gracefully records `imageAnalysis.status = 'Failed'` without failing or rolling back the citizen's complaint submission.
  - **Public and Admin Schema Serialization:** Extended `Complaint` schema with `imageAnalysis` subdocument, indexed by status, and updated `toPublicJSON()` and `toAdminJSON()` methods to safely expose visual findings without leaking internal driver metadata or API keys.
- **Mini Phase 15.3 (Complete):** Display AI Image Analysis in Frontend:
  - **Citizen Tracking UI:** Compact, responsive "AI Image Analysis" section in `TrackComplaintPage.jsx` displaying detection status, detected issue type, visual description, suggested category, visual severity badge, confidence pill, and non-civic/unsuitable image advisory warning banner.
  - **Admin Inspection UI:** Dedicated "AI Image Analysis (Visual Assessment)" panel in `AdminComplaintDetails.jsx` with full visual metric breakdown, unsuitable image warnings, and explicit disclaimers designating findings as AI-generated suggestions rather than certified municipal determinations.
  - **Robust Failure & State Handling:** Gracefully handles missing image analysis (cleanly hidden if no photo was uploaded), Pending states ("queued or in progress"), and Failed states ("temporarily unavailable for this photo") without displaying raw API error messages, stack traces, or internal error keys.
  - **Zero-Trust Client Separation:** Purely displays sanitized server-provided data; frontend never initiates Gemini requests directly, never holds AI API credentials, and clearly separates text AI analysis from image AI analysis.

---

## 2. Technology Stack

### Frontend
- **Framework:** [React 18](https://react.dev/)
- **Build Tool / Bundler:** [Vite 5](https://vitejs.dev/)
- **Language:** JavaScript (ES Modules)
- **Styling:** Custom Vanilla CSS (Modern SaaS theme, responsive typography, CSS design tokens, AI & duplicate badges, admin dashboard cards, responsive tables & modals)
- **HTTP Client:** Fetch API with AbortController timeout resilience, `FormData` multipart support, & Bearer JWT authorization
- **State & Views:** Session management (`localStorage`), dynamic view navigation (Home, Report Issue, Track Complaint, Sign In, Register, Profile, Municipal Admin Portal)

### Backend
- **Runtime:** [Node.js](https://nodejs.org/) (v24+)
- **Web Framework:** [Express.js](https://expressjs.com/) (v4.21+)
- **Database ODM:** [Mongoose](https://mongoosejs.com/) (v9.1+)
- **Security & RBAC:** [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) (`HS256`), [bcrypt](https://github.com/kelektiv/node.bcrypt.js) (10 salt rounds), OWASP defense headers, sliding-window rate limiters
- **Duplicate Detection Engine:** Native lightweight token Jaccard similarity & Haversine formula (zero external dependencies)
- **Generative AI:** [Google Gen AI SDK](https://www.npmjs.com/package/@google/genai) (`@google/genai` v3.4+)
- **Email Notifications & Outbox:** [Nodemailer](https://nodemailer.com/) (v6.10+) with configurable SMTP, retry backoff, and mock transport testing
- **Media Upload & Storage:** [Multer](https://github.com/expressjs/multer) (in-memory buffering), [Cloudinary](https://cloudinary.com/) (secure CDN storage)
- **Cross-Origin Handling:** `cors`
- **Environment Management:** `dotenv`
- **Development Monitor:** `nodemon`

---

## 3. Project Structure

```
civicfix-ai/
├── backend/
│   ├── scripts/
│   │   ├── seedAdmin.js          # Provision municipal administrator accounts via CLI
│   │   ├── seedDepartments.js    # Seed default municipal operational departments
│   │   └── seedOfficer.js        # Provision departmental field officer accounts
│   ├── src/
│   │   ├── config/               # Database, Cloudinary, and environment configs
│   │   ├── controllers/          # Express route controllers (Auth, Complaints, Admin, Analytics, etc.)
│   │   ├── middleware/           # RBAC auth, rate limiting, security headers, upload middleware
│   │   ├── models/               # Mongoose schemas (User, Complaint, Department, NotificationLog)
│   │   ├── routes/               # Express API routes
│   │   ├── services/             # Core business logic (AI, Duplicates, Email, GIS Map, Analytics)
│   │   ├── utils/                # Sanitization, JWT, and API response utilities
│   │   ├── app.js                # Express application configuration
│   │   └── server.js             # Server startup and database bootstrap
│   ├── test-*.js                 # 16 automated backend test suites (426 tests total)
│   ├── .env.example              # Sanitized backend environment template
│   └── package.json              # Backend dependencies and test scripts
├── frontend/
│   ├── public/                   # Static public assets (SVG favicon and logo)
│   ├── src/
│   │   ├── assets/               # Branding assets
│   │   ├── components/
│   │   │   ├── admin/            # Municipal admin management tables, modals, details
│   │   │   ├── analytics/        # SVG charts, KPI cards, date range pickers, risk matrix
│   │   │   ├── map/              # Leaflet GIS interactive map, clustering, markers, popups
│   │   │   └── ...               # Navbar, Hero, Footer, Status indicators
│   │   ├── pages/                # Application views (Home, Report, Track, Admin, Officer, Auth)
│   │   ├── services/             # API client services with timeout resilience
│   │   ├── App.css               # Vanilla CSS design system and responsive tokens
│   │   ├── App.jsx               # Application root and route controller
│   │   ├── index.css             # Base reset and typography
│   │   └── main.jsx              # React DOM entry point
│   ├── .env.example              # Frontend environment template
│   ├── index.html                # Vite HTML shell
│   ├── package.json              # Frontend dependencies and build scripts
│   └── vite.config.js            # Vite build configuration
├── .gitignore                    # Root Git exclusion rules
└── README.md                     # Complete project documentation and specifications
```

---

## 4. Security Architecture & Threat Model

```
       [ Citizen / Official Client ]
                     │
                     ▼
          ┌─────────────────────┐
          │   Security Headers  │  --> X-Content-Type-Options: nosniff
          │   (OWASP Baseline)  │  --> X-Frame-Options: DENY
          └──────────┬──────────┘  --> Remove X-Powered-By
                     │
                     ▼
          ┌─────────────────────┐
          │  CORS & Rate Limits │  --> Whitelisted origins only
          │  (Sliding Window)   │  --> Max 10 attempts / 15 min per IP
          └──────────┬──────────┘
                     │
                     ▼
          ┌─────────────────────┐
          │  Payload Validation │  --> Strict type checks (string)
          │  (100kb Max Bounds) │  --> Password length: 8 - 128 chars (Anti-DoS)
          └──────────┬──────────┘
                     │
                     ▼
          ┌─────────────────────┐
          │  JWT Authentication │  --> Explicit algorithm: HS256
          │  & RBAC Guard       │  --> Database identity check & isActive check
          └──────────┬──────────┘  --> authorize('admin') returns 403 for citizens
                     │
                     ▼
          ┌─────────────────────┐
          │   MongoDB Database  │  --> Passwords hashed via bcrypt (10 rounds)
          │   (Mongoose ODM)    │  --> toSafeObject() strips password hash
          └─────────────────────┘
```

---

## 5. API Endpoints

### Public & Citizen Endpoints
| Method | Endpoint | Access | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | Public | None | Root welcome message |
| `GET` | `/api/health` | Public | None | Live system & MongoDB availability status |
| `POST` | `/api/auth/register` | Public | 10 / hr | Register new citizen account (locked to `citizen` role) |
| `POST` | `/api/auth/login` | Public | 10 / 15 min | Authenticate user and receive JWT Bearer token |
| `GET` | `/api/auth/me` | Protected (JWT) | None | Get authenticated user profile (`citizen` or `admin`) |
| `POST` | `/api/complaints` | Public / Citizen | None | Submit new public complaint with optional image upload |
| `GET` | `/api/complaints/track/:complaintId` | Public | None | Track complaint status, timeline, AI advice & duplicates |
| `POST` | `/api/complaints/:complaintId/analyze` | Public | 1 / 10s | Trigger or re-fetch Google Gemini AI text analysis |
| `POST` | `/api/complaints/:complaintId/check-duplicates` | Public | 1 / 5s | Trigger or re-fetch duplicate detection results |

### Municipal Administration Endpoints (Admin Only)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/dashboard/stats` | **Admin Only** (`protect, authorize('admin')`) | Operational KPI metrics (total, pending, in progress, resolved, critical/high AI severity) |
| `GET` | `/api/admin/complaints` | **Admin Only** (`protect, authorize('admin')`) | Server-side filtered, searched, sorted, and paginated complaints registry |
| `GET` | `/api/admin/complaints/:complaintId` | **Admin Only** (`protect, authorize('admin')`) | Detailed complaint inspection record with AI and duplicate evidence |
| `GET` | `/api/admin/complaints/:complaintId/history` | **Admin Only** (`protect, authorize('admin')`) | Chronological status transition history and audit trail |
| `PATCH` | `/api/admin/complaints/:complaintId/status` | **Admin Only** (`protect, authorize('admin')`) | Transition complaint status (`Pending`, `In Progress`, `Resolved`) with optional note ($\le 500$ chars) and audit logging |
| `GET` | `/api/admin/departments` | **Admin Only** (`protect, authorize('admin')`) | Retrieve all municipal departments |
| `POST` | `/api/admin/departments` | **Admin Only** (`protect, authorize('admin')`) | Create new municipal department (unique name and code) |
| `PATCH` | `/api/admin/departments/:departmentId` | **Admin Only** (`protect, authorize('admin')`) | Update department details or toggle active/inactive status |
| `GET` | `/api/admin/officers` | **Admin Only** (`protect, authorize('admin')`) | Retrieve field officers list filtered by department |
| `PATCH` | `/api/admin/complaints/:complaintId/assignment` | **Admin Only** (`protect, authorize('admin')`) | Assign or reassign complaint to department and officer |
| `GET` | `/api/admin/complaints/:complaintId/assignment-history` | **Admin Only** (`protect, authorize('admin')`) | Chronological work order assignment audit trail |
| `GET` | `/api/admin/map/complaints` | **Admin Only** (`protect, authorize('admin')`) | Geospatial complaints layer with exact coordinates and admin filters |
| `GET` | `/api/admin/notifications` | **Admin Only** (`protect, authorize('admin')`) | Notification outbox delivery log audit trail with status and event filters |
| `GET` | `/api/admin/analytics/overview` | **Admin Only** (`protect, authorize('admin')`) | Summary KPIs, resolution rate, status distribution, and period-over-period deltas |
| `GET` | `/api/admin/analytics/trends` | **Admin Only** (`protect, authorize('admin')`) | Time-series daily/monthly intake and resolution volume with gap-filling |
| `GET` | `/api/admin/analytics/categories` | **Admin Only** (`protect, authorize('admin')`) | Category distribution, percentage share, and category resolution rates |
| `GET` | `/api/admin/analytics/departments` | **Admin Only** (`protect, authorize('admin')`) | Department workload comparison, turnaround times, and resolution rates |
| `GET` | `/api/admin/analytics/officers` | **Admin Only** (`protect, authorize('admin')`) | Field officer workload queues and performance metrics |
| `GET` | `/api/admin/analytics/resolution` | **Admin Only** (`protect, authorize('admin')`) | Turnaround duration histogram (<24h, 1-3d, 3-7d, >7d), median and averages |
| `GET` | `/api/admin/analytics/severity` | **Admin Only** (`protect, authorize('admin')`) | AI severity risk distribution and cross-category risk matrix |
| `GET` | `/api/admin/analytics/geography` | **Admin Only** (`protect, authorize('admin')`) | Privacy-preserved (~1.1 km) neighborhood hot spot clusters |
| `GET` | `/api/admin/analytics/export` | **Admin Only** (`protect, authorize('admin')`) | Sanitized CSV export with spreadsheet formula injection defense |

### Field Officer Endpoints (Officer Only)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/officer/dashboard/stats` | **Officer Only** (`protect, authorize('officer')`) | Assigned work order metrics (total, pending, in progress, resolved) |
| `GET` | `/api/officer/complaints` | **Officer Only** (`protect, authorize('officer')`) | Paginated complaints strictly assigned to authenticated officer |
| `GET` | `/api/officer/complaints/:complaintId` | **Officer Only** (`protect, authorize('officer')`) | Inspection details for an assigned complaint (enforces IDOR ownership) |
| `PATCH` | `/api/officer/complaints/:complaintId/status` | **Officer Only** (`protect, authorize('officer')`) | Update assigned status (`In Progress`, `Resolved`) with progress note |
| `GET` | `/api/officer/map/complaints` | **Officer Only** (`protect, authorize('officer')`) | Field officer GIS complaint markers bound to assigned user |
| `GET` | `/api/officer/analytics/overview` | **Officer Only** (`protect, authorize('officer')`) | Field officer personal turnaround and category workload metrics (strictly self-scoped) |

### Citizen Notification Preferences (Authenticated Users)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notifications/preferences` | Authenticated | Retrieve user email notification opt-in preference |
| `PATCH` | `/api/notifications/preferences` | Authenticated | Update user email notification opt-in preference |

---

## 6. Controlled Account & Department Provisioning

To prevent unauthorized privilege escalation, **public user registration strictly assigns `role: 'citizen'`**. Municipal administrators and departmental field officers can only be provisioned through controlled backend CLI scripts.

### 5.1 Seeding Default Municipal Departments
```powershell
cd backend
npm run seed:departments
```

### 5.2 Provisioning Municipal Administrator Accounts (PowerShell)
```powershell
cd backend

# Option A: Provision using environment variables in PowerShell (Recommended)
$env:ADMIN_NAME="Chief Municipal Officer"
$env:ADMIN_EMAIL="admin@civicfix.gov"
$env:ADMIN_PASSWORD="<YourStrongPassword123!>"
npm run seed:admin

# Option B: Provision using CLI arguments
npm run seed:admin -- --name="Chief Municipal Officer" --email="admin@civicfix.gov" --password="<YourStrongPassword123!>"
```

### 5.3 Provisioning Field Officer Accounts (PowerShell)
```powershell
cd backend

# Provision officer assigned to an active department (e.g. ROAD, SAN, WATER, ELEC, DRAIN, GEN)
$env:OFFICER_NAME="Officer John Martinez"
$env:OFFICER_EMAIL="officer.martinez@civicfix.gov"
$env:OFFICER_PASSWORD="<YourStrongPassword123!>"
$env:OFFICER_DEPT_CODE="ROAD"
npm run seed:officer
```

**Security Rules:**
- Passwords must be between 8 and 128 characters long and are automatically hashed with `bcrypt` (10 salt rounds) before persistence.
- Officers must be assigned to an active municipal department.
- Plain-text passwords and secret keys are never printed in terminal logs.
- Provisioning scripts run on demand via CLI—**never** automatically during server startup.

---

## 7. Installation & Development Setup

### 7.1 Prerequisites
- **Node.js:** v20+ (tested on Node v24.16.0)
- **npm:** v10+ (tested on npm 11.13.0)
- **PowerShell / Bash:** Windows 11, macOS, or Linux
- **MongoDB:** MongoDB Community Server (v6+) or MongoDB Atlas cluster

### 7.2 Database Setup (MongoDB Local & Atlas)

#### Option A: Local MongoDB Community Server
Ensure MongoDB is running locally on port 27017:
```powershell
# Verify MongoDB service status (Windows)
Get-Service -Name MongoDB
# Connect URI in backend/.env:
MONGODB_URI=mongodb://localhost:27017/civicfix_ai
```

#### Option B: MongoDB Atlas Cloud
Create a free tier (M0) cluster on [MongoDB Atlas](https://www.mongodb.com/atlas):
1. In Security > Database Access, create a database user with read/write privileges.
2. In Security > Network Access, whitelist your deployment IP (or `0.0.0.0/0` for development).
3. Copy your connection string and configure `MONGODB_URI` in `backend/.env`:
```ini
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/civicfix_ai?retryWrites=true&w=majority
```

### 7.3 Environment Configuration

Both `backend/.env.example` and `frontend/.env.example` templates are provided in the repository. Create local `.env` files from these templates:

```powershell
# Backend configuration
Copy-Item backend/.env.example backend/.env

# Frontend configuration
Copy-Item frontend/.env.example frontend/.env
```

#### Backend Environment Variables (`backend/.env`)
```ini
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/civicfix_ai
JWT_SECRET=<your_strong_secret_key_at_least_32_characters_long>
JWT_EXPIRES_IN=1d

# Optional Cloudinary Storage (Phase 5)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Optional Google Gemini AI (Phase 6 & 15)
GEMINI_API_KEY=

# Optional SMTP Email Notifications (Phase 13)
EMAIL_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=notifications@civicfix.gov
EMAIL_FROM_NAME="CivicFix AI Notifications"
```

#### Frontend Environment Variables (`frontend/.env`)
```ini
VITE_API_URL=http://localhost:5000
```

### 7.4 Start Development Servers

#### 1. Start Backend Development Server
```powershell
cd backend
npm install
npm run dev
# Server running at http://localhost:5000
```

#### 2. Start Frontend Development Server
```powershell
cd frontend
npm install
npm run dev
# Vite server running at http://localhost:5173
```

---

## 8. Automated Test Suites (426 / 426 Passed across 16 Suites)

All 16 test suites run self-contained mocked in-memory and unit verifications without requiring live third-party cloud credentials or paid APIs.

### Run All 16 Test Suites in Sequence
```powershell
cd backend
npm test
# Executes all 16 test suites sequentially (426 tests total)
```

### Run Individual Test Suites
```powershell
cd backend

# Phase 2 & 3: Schema validation (13 tests)
npm run test:models

# Phase 3: Password hashing, JWT & RBAC (17 tests)
npm run test:auth

# Phase 4: Complaint submission & ID generation (17 tests)
npm run test:complaints

# Phase 5: Cloudinary upload & magic byte verification (20 tests)
npm run test:upload

# Phase 6: Gemini AI integration & prompt defense (27 tests)
npm run test:ai

# Phase 7: Jaccard & Haversine duplicate detection (24 tests)
npm run test:duplicates

# Phase 8: Admin dashboard, filtering, pagination & status updates (39 tests)
npm run test:admin

# Phase 9: Authentication & Security final audit (27 tests)
npm run test:security

# Phase 10: Complaint status history & audit logs (28 tests)
npm run test:history

# Phase 11: Department & Field Officer assignment system (42 tests)
npm run test:assignment

# Phase 12: GIS Map & Spatial Clustering verification (30 tests)
npm run test:map

# Phase 13: Resilient Email Notification System & Outbox (30 tests)
npm run test:notifications

# Phase 14: Advanced Municipal Analytics & Turnaround Intelligence (38 tests)
npm run test:analytics

# Mini Phase 15.1: Backend AI Image Analysis Service (31 tests)
npm run test:image-ai

# Mini Phase 15.2: AI Image Analysis Complaint Integration (22 tests)
npm run test:complaint-image

# Mini Phase 15.3: Frontend AI Image Analysis Display Data & Serialization (21 tests)
npm run test:frontend-display
```

---

## 9. Analytics & AI Architecture Methodology

### 9.1 KPI Summary Metrics & Period-over-Period Deltas
- **Resolution Rate:** $\frac{\text{Resolved Complaints}}{\text{Total Complaints}} \times 100$, rounded to 1 decimal place. If total complaints is 0, the rate cleanly returns 0.0% to guard against division-by-zero.
- **Period-over-Period Percentage Change:** $\frac{\text{Current Period Count} - \text{Previous Period Count}}{\text{Previous Period Count}} \times 100$. When the previous baseline is 0 and current > 0, the delta explicitly returns `null` ("N/A") to distinguish genuine zero-delta from an undefined baseline.
- **Turnaround Duration:** Measured strictly from ticket creation (`createdAt`) to the first recorded transition to `'Resolved'` in the atomic `statusHistory` audit trail (or `updatedAt` for legacy tickets). Unresolved tickets are strictly excluded from turnaround metrics.

### 9.2 Date Range Filters & Continuous Time-Series
- Supported presets: `7d` (Last 7 Days), `30d` (Last 30 Days), `90d` (Last 90 Days), `180d` (Last 6 Months), `all` (All-time), and `custom` (inclusive start and end dates).
- Trend aggregation fills missing calendar days with zero values (`submitted: 0, pending: 0, inProgress: 0, resolved: 0`) to guarantee continuous, unbroken time-series curves.

### 9.3 Geographic Privacy Preservation
- Complaint GPS coordinates are grouped using 2-decimal rounding (`$round: ['$location.latitude', 2]`, `$round: ['$location.longitude', 2]`), clustering reports into ~1.1 km neighborhood areas.
- Public and analytics responses completely omit exact residential house coordinates, citizen names, and contact details.

### 9.4 Spreadsheet Formula Injection Defense (CSV Export)
- Any exported cell starting with dangerous spreadsheet formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) is automatically sanitized by prepending a single quote (`'`), neutralizing executable commands in Microsoft Excel, LibreOffice, and Google Sheets.

### 9.5 Multimodal AI Image Analysis Service (Mini Phase 15.1)
- **Service Module:** `backend/src/services/imageAnalysisService.js`.
- **Accepted Formats:** `image/jpeg`, `image/png`, `image/webp` up to 5 MB (`MAX_FILE_SIZE_BYTES`).
- **Validation Pipeline:** Magic bytes header signature verification against extension spoofing; rejected non-image and corrupted buffers before reaching model.
- **Multimodal Prompting:** Inlines image buffer as Base64 in `@google/genai` request along with structured civic safety instructions and optional citizen issue text.
- **Response Schema:**
  ```json
  {
    "isUnclearOrUnsuitable": false,
    "unsuitableReason": null,
    "possibleIssueType": "Pothole / Road Crack / Garbage",
    "shortDescription": "1-2 sentence visual description",
    "suggestedCategory": "Road Damage | Garbage | Water Leakage | Streetlight | Drainage | Other",
    "suggestedSeverity": "Low | Medium | High | Critical",
    "confidence": "High | Medium | Low"
  }
  ```
- **Error Handling & Fallbacks:** Returns `{ success: false, error: '...', data: null }` on model or network failures without crashing the backend process.

### 9.6 Complaint Workflow Image Analysis Integration (Mini Phase 15.2)
- **Integration Target:** Connected directly to complaint submission workflow (`createComplaint` in `backend/src/services/complaintService.js`).
- **Selective Execution:** Gemini vision multimodal analysis is triggered only when a valid image buffer is uploaded (`file && file.buffer`). If no image is provided, image analysis is skipped and `imageAnalysis` serializes as `null`.
- **Single Cloudinary Upload Guarantee:** The uploaded image is streamed once to Cloudinary in Step 7. The in-memory buffer (`file.buffer`) is concurrently reused for Gemini vision in Step 10b, eliminating duplicate uploads or local disk persistence.
- **Citizen Input Immutability:** The citizen's declared `category` and `description` are never modified or overwritten by AI vision output. AI deductions are safely stored in `complaint.imageAnalysis.suggestedCategory` and `complaint.imageAnalysis.shortDescription` for advisory and auditing purposes.
- **Client AI Result Injection Defense:** Client-supplied `imageAnalysis` and `aiAnalysis` properties in `req.body` are strictly ignored by the service layer, preventing malicious privilege escalation or spoofed AI classifications.
- **Failure Boundary Isolation:** Wrapped in a decoupled `try/catch` block. If Google Gemini API is unconfigured, rate-limited, or unavailable, `imageAnalysis.status` is saved as `'Failed'` with a sanitized error message, allowing the citizen's complaint ticket to be submitted and tracked successfully.
- **Public & Admin Serialization:**
  - `toPublicJSON()`: Safely presents `imageAnalysis` (or `null` if no image was uploaded), exposing the advisory visual findings while omitting internal database driver fields and API credentials.
  - `toAdminJSON()`: Exposes full `imageAnalysis` details, including `errorMessage` when status is `Failed`, enabling municipal staff to diagnose AI vision exceptions.

### 9.7 Frontend Visual AI Advisory Presentation (Mini Phase 15.3)
- **Citizen Tracking Interface (`TrackComplaintPage.jsx`):** Renders compact "AI Image Analysis" card when image analysis data exists. Shows status badge, detected hazard type, 1-2 sentence visual scene description, suggested municipal category, severity pill, and confidence tag. Displays a prominent advisory warning banner when an image is flagged as unclear or non-civic (`isUnclearOrUnsuitable: true`).
- **Admin Complaint Inspection (`AdminComplaintDetails.jsx`):** Dedicated "AI Image Analysis (Visual Assessment)" panel providing side-by-side comparison of visual findings against citizen inputs. Explicitly informs municipal staff with disclaimer badges stating all visual findings are automated suggestions rather than verified determinations.
- **Graceful Error & State Isolation:** Displays user-friendly notices for pending analysis or temporary unavailability without exposing raw error strings, stack traces, or internal driver fields. Completely hides the section when no image was uploaded.
- **Distinct AI Presentation:** Clear separation between text-based Gemini analysis (executive summaries and dispatch advice) and image-based Gemini vision analysis (visual defect type and scene description).

---

## 10. Security Limitations & Production Considerations

1. **In-Memory Rate Limiting:** The current rate limiter uses an in-memory sliding window store. For multi-instance, clustered, or serverless deployments, an external centralized distributed cache (e.g., Redis) is recommended to synchronize rate counters across replicas.
2. **Session Storage in Frontend:** The frontend stores JWT access tokens in `localStorage`. While `localStorage` provides persistent sessions across page reloads without complex domain cookie configuration, it is susceptible to XSS if an XSS vulnerability exists. In enterprise production deployments, migrating to HTTP-only, `SameSite=Strict`, `Secure` cookies with CSRF tokens provides additional protection against client-side script token theft.
3. **Multi-Factor Authentication (MFA):** Administrator accounts currently authenticate with email and bcrypt-hashed password; adding Time-based One-Time Password (TOTP) MFA is recommended for high-security government production deployments.
4. **Environment Isolation:** Never commit `.env` files to source control. Production environments should supply secrets via managed secrets managers (e.g., AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, or Kubernetes Secrets).

---

## 11. Contributing Guidelines

We welcome community feedback and contributions! To contribute to CivicFix AI:

1. **Fork the Repository:** Create your own branch (`git checkout -b feature/your-feature-name`).
2. **Adhere to Code Standards:**
   - Keep controllers, models, and services cleanly decoupled.
   - Enforce explicit schemas and validation across all API boundaries.
   - Preserve defense-in-depth security patterns (sanitized errors, OWASP headers, explicit JWT algorithms).
3. **Run Automated Test Suites:** Ensure all 16 test suites pass before submitting code:
   ```powershell
   npm --prefix backend test
   ```
4. **Verify Frontend Production Build:** Ensure the Vite production bundle builds with zero errors:
   ```powershell
   npm --prefix frontend run build
   ```
5. **Submit a Pull Request:** Open a detailed pull request describing the changes and test results.

---

## 12. License & Legal Disclaimer

### License
This project is licensed under the [MIT License](LICENSE).

### Disclaimer
CivicFix AI is designed as a civic technology platform to facilitate municipal communication and issue triage. Automated suggestions generated by Google Gemini AI (category recommendations, severity grading, and multimodal image defect assessments) are intended strictly as advisory aids for municipal personnel and do not constitute certified municipal inspections or legal determinations. Municipal authorities maintain sole discretionary authority over work order prioritization, officer assignments, and field resolutions.
