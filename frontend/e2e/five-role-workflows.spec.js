import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendNodeModules = path.resolve(__dirname, '../../backend/node_modules');

const mongoose = (await import(pathToFileURL(path.join(backendNodeModules, 'mongoose', 'index.js')).href)).default;
const bcryptModule = await import(pathToFileURL(path.join(backendNodeModules, 'bcrypt', 'bcrypt.js')).href);
const bcrypt = bcryptModule.default?.hash ? bcryptModule.default : (bcryptModule.hash ? bcryptModule : bcryptModule.default);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/civicfix_playwright_test';

const TEST_TIMESTAMP = Date.now();
const CITIZEN_EMAIL = `citizen_browser_${TEST_TIMESTAMP}@civicfix.city`;
const CITIZEN_PASSWORD = 'CitizenPassword123!';
const CITIZEN_NAME = 'Aarav Sharma';

const OFFICER_EMAIL = `officer_browser_${TEST_TIMESTAMP}@civicfix.city`;
const WARD_ADMIN_EMAIL = `wardadmin_browser_${TEST_TIMESTAMP}@civicfix.city`;
const DEPT_HEAD_EMAIL = `depthead_browser_${TEST_TIMESTAMP}@civicfix.city`;
const ADMIN_EMAIL = `admin_browser_${TEST_TIMESTAMP}@civicfix.city`;
const STAFF_PASSWORD = 'StaffPassword123!';

let createdTicketId = '';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const hashedPassword = await bcrypt.hash(STAFF_PASSWORD, 10);

  // 1. Provision Department (find or create)
  let dept = await db.collection('departments').findOne({ name: 'Road Maintenance & Infrastructure' });
  let deptId;
  if (!dept) {
    const deptRes = await db.collection('departments').insertOne({
      name: 'Road Maintenance & Infrastructure',
      code: `ROAD_${TEST_TIMESTAMP.toString().slice(-4)}`,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    deptId = deptRes.insertedId;
  } else {
    deptId = dept._id;
  }

  // 2. Provision Ward with GeoJSON boundaries (find or create)
  let ward = await db.collection('wards').findOne({ name: 'Shivajinagar Central Ward' });
  let wardId;
  if (!ward) {
    const wardRes = await db.collection('wards').insertOne({
      name: 'Shivajinagar Central Ward',
      code: `SHIV_${TEST_TIMESTAMP.toString().slice(-4)}`,
      number: Math.floor(100 + Math.random() * 800),
      zone: 'Central Zone',
      center: { latitude: 18.5204, longitude: 73.8567 },
      boundaries: {
        type: 'Polygon',
        coordinates: [
          [
            [73.83, 18.51],
            [73.86, 18.51],
            [73.86, 18.55],
            [73.83, 18.55],
            [73.83, 18.51]
          ]
        ]
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    wardId = wardRes.insertedId;
  } else {
    wardId = ward._id;
  }

  // 3. Provision Staff Users with isActive: true
  await db.collection('users').insertMany([
    {
      name: 'Inspector Vikram Patil',
      email: OFFICER_EMAIL,
      password: hashedPassword,
      role: 'officer',
      badgeNumber: 'OFF-7842',
      department: deptId,
      ward: wardId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: 'Ward Officer Deshmukh',
      email: WARD_ADMIN_EMAIL,
      password: hashedPassword,
      role: 'ward_admin',
      ward: wardId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: 'Director Kulkarni',
      email: DEPT_HEAD_EMAIL,
      password: hashedPassword,
      role: 'department_head',
      department: deptId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: 'Chief Municipal Officer',
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]);
});

test.afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    const db = mongoose.connection.db;
    await db.collection('users').deleteMany({
      email: { $in: [CITIZEN_EMAIL, OFFICER_EMAIL, WARD_ADMIN_EMAIL, DEPT_HEAD_EMAIL, ADMIN_EMAIL] }
    });
    await db.collection('departments').deleteMany({ code: { $regex: `ROAD_${TEST_TIMESTAMP.toString().slice(-4)}` } });
    await db.collection('wards').deleteMany({ code: { $regex: `SHIV_${TEST_TIMESTAMP.toString().slice(-4)}` } });
    if (createdTicketId) {
      await db.collection('complaints').deleteOne({ complaintId: createdTicketId });
    }
    await mongoose.disconnect();
  }
});

// -----------------------------------------------------------------------------
// WORKFLOW 1: CITIZEN REGISTRATION, LOGIN & PROFILE
// -----------------------------------------------------------------------------
test('Workflow 1: Citizen registers, logs in, and views Citizen Dashboard', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');
  await expect(page.locator('.brand-title')).toHaveText('CivicFix');

  // Navigate to Registration
  await page.click('button:has-text("Register")');
  await expect(page.locator('.auth-title')).toHaveText('Citizen Registration');

  // Fill Registration Form
  await page.fill('#register-name', CITIZEN_NAME);
  await page.fill('#register-email', CITIZEN_EMAIL);
  await page.fill('#register-password', CITIZEN_PASSWORD);
  await page.fill('#register-confirm', CITIZEN_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for success alert and redirect to Citizen Dashboard
  await expect(page.locator('.alert-success')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(1600);

  // Verify Citizen Dashboard is rendered in browser
  await expect(page.locator('.user-nav-name')).toHaveText(CITIZEN_NAME);
  await expect(page.locator('.user-nav-role')).toHaveText('citizen');

  expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);

  // Sign out cleanly
  await page.click('button:has-text("Sign Out")');
});

// -----------------------------------------------------------------------------
// WORKFLOW 2: CITIZEN REPORT ISSUE & PUBLIC TRACKING
// -----------------------------------------------------------------------------
test('Workflow 2: Citizen files complaint and tracks via public Tracking portal', async ({ page }) => {
  await page.goto('/');

  // Navigate to Report Issue
  await page.click('button:has-text("Report an Issue")');
  await expect(page.locator('.auth-title')).toHaveText('Report a Public Issue');

  // Fill Complaint Form
  await page.fill('#complaint-title', 'Severe roadway crater on Fergusson College Road');
  await page.selectOption('#complaint-category', 'Road Damage');
  await page.fill('#complaint-description', 'Dangerous open pothole exceeding 2 feet in diameter disrupting peak hour traffic.');
  await page.fill('#complaint-address', 'Near FC Main Gate, Shivajinagar');
  await page.fill('#complaint-lat', '18.5204');
  await page.fill('#complaint-lng', '73.8567');

  await page.click('button[type="submit"]');

  // Verify Complaint Confirmation Card
  await expect(page.locator('.auth-title:has-text("Issue Reported Successfully!")')).toBeVisible({ timeout: 8000 });
  const ticketElement = page.locator('.complaint-id-code');
  await expect(ticketElement).toBeVisible();
  createdTicketId = (await ticketElement.textContent()).trim();
  expect(createdTicketId).toMatch(/^CFX-\d{8}-\d{4}$/);

  // Navigate to Track Complaint Page
  await page.click('button:has-text("Track Complaint")');
  await expect(page.locator('.auth-title')).toHaveText('Track Public Complaint');

  // Track the generated Ticket ID
  await page.fill('.track-input', createdTicketId);
  await page.click('.track-search-btn');

  // Verify Complaint Tracking Card renders
  await expect(page.locator('.track-result-panel')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.track-ticket-id')).toContainText(createdTicketId);
  await expect(page.locator('.status-pill-large')).toContainText('Pending');
});

// -----------------------------------------------------------------------------
// WORKFLOW 3: FIELD OFFICER LOGIN & WORKSPACE QUEUE
// -----------------------------------------------------------------------------
test('Workflow 3: Field Officer logs in and views prioritized workspace', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Navigate to Login
  await page.click('button:has-text("Sign In")');
  await expect(page.locator('.auth-title')).toHaveText('Citizen & Official Sign In');

  // Log in as Officer
  await page.fill('#login-email', OFFICER_EMAIL);
  await page.fill('#login-password', STAFF_PASSWORD);
  await page.click('button[type="submit"]');

  // Verify Officer Portal
  await expect(page.locator('.user-nav-role')).toHaveText('officer');
  await expect(page.locator('.officer-badge-pill')).toContainText('FIELD DISPATCH WORKSPACE');
  await expect(page.locator('.admin-dashboard-title')).toContainText('Welcome');
});

// -----------------------------------------------------------------------------
// WORKFLOW 4: WARD ADMINISTRATOR LOGIN & BOUNDARY SCOPING
// -----------------------------------------------------------------------------
test('Workflow 4: Ward Administrator logs in and views scoped municipal dashboard', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Log in as Ward Admin
  await page.click('button:has-text("Sign In")');
  await page.fill('#login-email', WARD_ADMIN_EMAIL);
  await page.fill('#login-password', STAFF_PASSWORD);
  await page.click('button[type="submit"]');

  // Verify Ward Portal
  await expect(page.locator('.user-nav-role')).toHaveText('ward_admin');
  await expect(page.locator('.municipal-dashboard-container')).toBeVisible();
  await expect(page.locator('.municipal-tabs-nav')).toBeVisible();
});

// -----------------------------------------------------------------------------
// WORKFLOW 5: DEPARTMENT HEAD LOGIN & SCOPED WORKSPACE ACCESS
// -----------------------------------------------------------------------------
test('Workflow 5: Department Head logs in and views department-scoped portal', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Log in as Department Head
  await page.click('button:has-text("Sign In")');
  await page.fill('#login-email', DEPT_HEAD_EMAIL);
  await page.fill('#login-password', STAFF_PASSWORD);
  await page.click('button[type="submit"]');

  // Verify Department Head session and Portal
  await expect(page.locator('.user-nav-role')).toHaveText('department_head');
  await expect(page.locator('.admin-dashboard-page')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.admin-badge-pill')).toContainText('MUNICIPAL OPERATIONS');
  await expect(page.locator('button:has-text("🏢 Dept Portal")')).toBeVisible();
});

// -----------------------------------------------------------------------------
// WORKFLOW 6: SUPER ADMIN LOGIN & SYSTEM OVERVIEW
// -----------------------------------------------------------------------------
test('Workflow 6: Super Administrator logs in and views city-wide analytics', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Log in as Admin
  await page.click('button:has-text("Sign In")');
  await page.fill('#login-email', ADMIN_EMAIL);
  await page.fill('#login-password', STAFF_PASSWORD);
  await page.click('button[type="submit"]');

  // Verify Admin Portal
  await expect(page.locator('.user-nav-role')).toHaveText('admin');
  await expect(page.locator('.admin-dashboard-page')).toBeVisible();
  await expect(page.locator('.admin-badge-pill')).toContainText('MUNICIPAL OPERATIONS');
});

// -----------------------------------------------------------------------------
// WORKFLOW 7: MOBILE RESPONSIVE RENDERING & TOUCH NAVIGATION
// -----------------------------------------------------------------------------
test('Workflow 7: Mobile view displays responsive hamburger menu and layout', async ({ page }) => {
  // Mobile viewport (Pixel 5: 393 x 851)
  await page.setViewportSize({ width: 393, height: 851 });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Verify mobile toggle button is visible
  const mobileToggle = page.locator('.mobile-toggle');
  await expect(mobileToggle).toBeVisible();

  // Click hamburger toggle to open mobile menu
  await mobileToggle.click();
  await expect(page.locator('.mobile-menu')).toBeVisible();

  // Verify mobile menu options
  await expect(page.locator('.mobile-nav-link-btn:has-text("Report an Issue")')).toBeVisible();
  await expect(page.locator('.mobile-nav-link-btn:has-text("Track Complaint")')).toBeVisible();
});
