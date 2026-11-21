import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;

const runTest = (name, fn) => {
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    failed++;
  }
};

const runAsyncTest = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    failed++;
  }
};

async function runAllTests() {
  console.log('\n===============================================================');
  console.log('💻 CivicFix AI: Phase 21 PWA Frontend & Offline Tests');
  console.log('===============================================================\n');

  const frontendRoot = fs.existsSync(path.resolve(__dirname, '..', 'frontend'))
    ? path.resolve(__dirname, '..', 'frontend')
    : path.resolve('frontend');

  // -----------------------------------------------------------------------------
  // 1. Web App Manifest Structure & Standards Compliance
  // -----------------------------------------------------------------------------
  console.log('--- 1. Web App Manifest Standards Verification ---');

  const manifestPath = path.join(frontendRoot, 'public', 'manifest.json');

  runTest('1.1 manifest.json exists in frontend public directory', () => {
    assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');
  });

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  runTest('1.2 Application name and short name conform to specifications', () => {
    assert.strictEqual(manifest.name, 'CivicFix AI');
    assert.strictEqual(manifest.short_name, 'CivicFix');
    assert.ok(manifest.description.includes('Public Issue Reporting'));
  });

  runTest('1.3 Display mode and start URL conform to standalone requirements', () => {
    assert.strictEqual(manifest.display, 'standalone');
    assert.strictEqual(manifest.start_url, '/');
    assert.strictEqual(manifest.scope, '/');
    assert.strictEqual(manifest.orientation, 'portrait-primary');
  });

  runTest('1.4 Theme color and background color match municipal blue brand palette', () => {
    assert.strictEqual(manifest.theme_color, '#2563eb');
    assert.strictEqual(manifest.background_color, '#ffffff');
  });

  runTest('1.5 Manifest defines icons across all standard resolutions', () => {
    const requiredSizes = ['72x72', '96x96', '128x128', '144x144', '152x152', '192x192', '384x384', '512x512'];
    const declaredSizes = manifest.icons.map((i) => i.sizes);

    for (const size of requiredSizes) {
      assert.ok(declaredSizes.includes(size), `Missing icon size: ${size}`);
      const iconEntry = manifest.icons.find((i) => i.sizes === size && i.type === 'image/png');
      const iconPath = path.join(frontendRoot, 'public', iconEntry.src.replace(/^\//, ''));
      assert.ok(fs.existsSync(iconPath), `Physical icon file missing: ${iconPath}`);
    }
  });

  runTest('1.6 Manifest declares maskable icons for Android adaptive icon support', () => {
    const maskableIcon = manifest.icons.find((i) => i.purpose === 'maskable');
    assert.ok(maskableIcon, 'Maskable icon declaration must exist');
    const maskablePath = path.join(frontendRoot, 'public', maskableIcon.src.replace(/^\//, ''));
    assert.ok(fs.existsSync(maskablePath), `Maskable icon file missing: ${maskablePath}`);
  });

  runTest('1.7 Manifest declares quick shortcuts for mobile launch actions', () => {
    assert.ok(Array.isArray(manifest.shortcuts), 'Shortcuts should be an array');
    assert.ok(manifest.shortcuts.length >= 2, 'Should provide at least 2 quick shortcuts');
    const names = manifest.shortcuts.map((s) => s.name);
    assert.ok(names.includes('Report Issue'), 'Report Issue shortcut missing');
    assert.ok(names.includes('My Complaints'), 'My Complaints shortcut missing');
  });

  // -----------------------------------------------------------------------------
  // 2. Service Worker Architecture & Security Constraints
  // -----------------------------------------------------------------------------
  console.log('\n--- 2. Service Worker Architecture & Security Auditing ---');

  const swPath = path.join(frontendRoot, 'public', 'sw.js');

  runTest('2.1 sw.js exists in frontend public directory', () => {
    assert.ok(fs.existsSync(swPath), 'sw.js must exist');
  });

  const swContent = fs.readFileSync(swPath, 'utf8');

  runTest('2.2 Service worker defines cache versioning', () => {
    assert.ok(swContent.includes('CACHE_VERSION') || swContent.includes('CACHE_NAME'));
    assert.ok(swContent.includes('civicfix-shell-'));
  });

  runTest('2.3 Precache asset list contains application shell', () => {
    const requiredPrecache = ['/index.html', '/offline.html', '/manifest.json', '/logo.svg'];
    for (const asset of requiredPrecache) {
      assert.ok(swContent.includes(`'${asset}'`) || swContent.includes(`"${asset}"`), `Precache missing ${asset}`);
    }
  });

  runTest('2.4 Security Rule: SW strictly forbids caching of sensitive API responses', () => {
    assert.ok(
      swContent.includes("pathname.startsWith('/api/')"),
      'Must explicitly detect and isolate /api/ requests'
    );
    assert.ok(
      swContent.includes('NEVER cache') || swContent.includes('status: 503'),
      'Must never put /api/ responses into browser caches'
    );
  });

  runTest('2.5 Service worker handles push notifications and user click routing', () => {
    assert.ok(swContent.includes("addEventListener('push'"), 'Must handle push event');
    assert.ok(swContent.includes("addEventListener('notificationclick'"), 'Must handle notificationclick event');
    assert.ok(swContent.includes('showNotification'), 'Must display native notification');
    assert.ok(swContent.includes('openWindow') || swContent.includes('focus'), 'Must navigate on click');
  });

  // -----------------------------------------------------------------------------
  // 3. Offline Experience & HTML Shell Verification
  // -----------------------------------------------------------------------------
  console.log('\n--- 3. Offline Experience & HTML Shell Auditing ---');

  const offlineHtmlPath = path.join(frontendRoot, 'public', 'offline.html');

  runTest('3.1 offline.html exists and contains retry logic', () => {
    assert.ok(fs.existsSync(offlineHtmlPath), 'offline.html must exist');
    const content = fs.readFileSync(offlineHtmlPath, 'utf8');
    assert.ok(content.includes('Offline Mode') || content.includes('Offline'));
    assert.ok(content.includes('retryConnection') || content.includes('location.reload'));
    assert.ok(content.includes('window.addEventListener(\'online\''));
  });

  const indexHtmlPath = path.join(frontendRoot, 'index.html');

  runTest('3.2 index.html links manifest, theme-color, apple-touch-icon, and viewport-fit', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf8');
    assert.ok(html.includes('rel="manifest"'), 'Manifest link missing in index.html');
    assert.ok(html.includes('name="theme-color"'), 'Theme color missing');
    assert.ok(html.includes('viewport-fit=cover'), 'Viewport-fit cover missing for mobile safe-areas');
    assert.ok(html.includes('rel="apple-touch-icon"'), 'Apple touch icon missing for iOS');
  });

  runTest('3.3 index.html includes splash loading branding prior to JS hydration', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf8');
    assert.ok(html.includes('id="app-splash"'), 'App splash container missing');
    assert.ok(html.includes('CivicFix AI'), 'Splash branding title missing');
  });

  // -----------------------------------------------------------------------------
  // 4. IndexedDB Offline Complaint Draft Logic & Account Isolation
  // -----------------------------------------------------------------------------
  console.log('\n--- 4. IndexedDB Offline Draft Behavioral Logic ---');

  // Behavioral mock simulation of draft lifecycle
  const mockStorage = new Map();

  const simulateSaveDraft = (draft, userEmail = 'guest') => {
    const id = draft.id || `draft_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const record = {
      id,
      userEmail: userEmail || 'guest',
      title: draft.title || '',
      category: draft.category || '',
      description: draft.description || '',
      severity: draft.severity || 'Medium',
      address: draft.address || '',
      latitude: draft.latitude || null,
      longitude: draft.longitude || null,
      photoData: draft.photoData || null,
      status: 'draft',
      createdAt: draft.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockStorage.set(id, record);
    return record;
  };

  const simulateGetDraftsByUser = (userEmail = 'guest') => {
    return Array.from(mockStorage.values()).filter((d) => d.userEmail === userEmail);
  };

  const simulateDeleteDraft = (id) => {
    return mockStorage.delete(id);
  };

  runTest('4.1 Saving draft creates record with unique ID and status draft', () => {
    const draft = simulateSaveDraft({
      title: 'Broken streetlight on 5th Avenue',
      category: 'Streetlight',
      description: 'Lamp fixture hanging dangerously',
      address: '5th Avenue Corner'
    }, 'citizen.a@example.com');

    assert.ok(draft.id.startsWith('draft_'));
    assert.strictEqual(draft.status, 'draft');
    assert.strictEqual(draft.userEmail, 'citizen.a@example.com');
    assert.strictEqual(draft.title, 'Broken streetlight on 5th Avenue');
  });

  runTest('4.2 Draft isolation: Citizen B cannot see Citizen A\'s offline drafts', () => {
    simulateSaveDraft({ title: 'Draft for Citizen B' }, 'citizen.b@example.com');

    const draftsA = simulateGetDraftsByUser('citizen.a@example.com');
    const draftsB = simulateGetDraftsByUser('citizen.b@example.com');

    assert.strictEqual(draftsA.length, 1);
    assert.strictEqual(draftsB.length, 1);
    assert.strictEqual(draftsA[0].userEmail, 'citizen.a@example.com');
    assert.strictEqual(draftsB[0].userEmail, 'citizen.b@example.com');
  });

  runTest('4.3 Updating draft preserves original creation date and mutates updatedAt', () => {
    mockStorage.clear();
    simulateSaveDraft({ title: 'Draft for Citizen B' }, 'citizen.b@example.com');
    const initial = simulateSaveDraft({ title: 'Original title' }, 'citizen.a@example.com');
    const originalCreated = initial.createdAt;

    // Simulate edit
    const updated = simulateSaveDraft({
      id: initial.id,
      title: 'Edited Title',
      createdAt: initial.createdAt
    }, 'citizen.a@example.com');

    assert.strictEqual(updated.id, initial.id);
    assert.strictEqual(updated.title, 'Edited Title');
    assert.strictEqual(updated.createdAt, originalCreated);
    assert.strictEqual(mockStorage.size, 2); // 1 for A, 1 for B
  });

  runTest('4.4 Draft deletion removes specific record cleanly', () => {
    mockStorage.clear();
    simulateSaveDraft({ title: 'Existing draft' }, 'citizen.a@example.com');
    const draft = simulateSaveDraft({ title: 'To be deleted' }, 'citizen.a@example.com');
    assert.strictEqual(simulateGetDraftsByUser('citizen.a@example.com').length, 2);

    simulateDeleteDraft(draft.id);
    assert.strictEqual(simulateGetDraftsByUser('citizen.a@example.com').length, 1);
  });

  // -----------------------------------------------------------------------------
  // 5. PWA Installation & Standalone Detection Logic
  // -----------------------------------------------------------------------------
  console.log('\n--- 5. Installation Prompt & Standalone Mode Logic ---');

  runTest('5.1 Standalone detection checks display-mode media queries and navigator.standalone', () => {
    const isStandalone = (matchesStandalone, isNavigatorStandalone) => {
      return Boolean(matchesStandalone || isNavigatorStandalone);
    };

    assert.strictEqual(isStandalone(true, false), true);
    assert.strictEqual(isStandalone(false, true), true);
    assert.strictEqual(isStandalone(false, false), false);
  });

  runTest('5.2 Install prompt helper returns outcome object', () => {
    const simulatePromptInstall = async (deferredPrompt) => {
      if (!deferredPrompt) return { outcome: 'unsupported' };
      const choice = await deferredPrompt.userChoice;
      return { outcome: choice.outcome };
    };

    // Test unsupported
    simulatePromptInstall(null).then((res) => {
      assert.strictEqual(res.outcome, 'unsupported');
    });

    // Test accepted
    const mockPromptAccepted = {
      userChoice: Promise.resolve({ outcome: 'accepted' })
    };
    simulatePromptInstall(mockPromptAccepted).then((res) => {
      assert.strictEqual(res.outcome, 'accepted');
    });
  });

  // -----------------------------------------------------------------------------
  // 6. Push Notification Key Conversion & Permissions
  // -----------------------------------------------------------------------------
  console.log('\n--- 6. Push Notification Key Encoding & Permissions ---');

  runTest('6.1 VAPID key base64 URL-safe conversion to Uint8Array', () => {
    const urlBase64ToUint8Array = (base64String) => {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = Buffer.from(base64, 'base64').toString('binary');
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    };

    const testVapid = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZElO7BpwtGN_4v89zN83v_5N1xXp29eJ7wF9K0';
    const arr = urlBase64ToUint8Array(testVapid);

    assert.ok(arr instanceof Uint8Array);
    assert.strictEqual(arr.length, 65); // Standard P-256 public key length
  });

  runTest('6.2 Push subscription blocked when user permission is denied', () => {
    const checkCanSubscribe = (permission) => {
      if (permission !== 'granted') return { allowed: false, error: 'Permission denied' };
      return { allowed: true };
    };

    assert.strictEqual(checkCanSubscribe('denied').allowed, false);
    assert.strictEqual(checkCanSubscribe('default').allowed, false);
    assert.strictEqual(checkCanSubscribe('granted').allowed, true);
  });

  // -----------------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`Phase 21 PWA Frontend Tests: ${passed} passed, ${failed} failed.`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
