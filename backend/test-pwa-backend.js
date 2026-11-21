import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { PushSubscription } from './src/models/PushSubscription.js';
import {
  getPushPublicKey,
  subscribePush,
  unsubscribePush
} from './src/controllers/notificationController.js';
import notificationRoutes from './src/routes/notificationRoutes.js';

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
  console.log('📲 CivicFix AI: Phase 21 PWA Backend & Push Subscription Tests');
  console.log('===============================================================\n');

  // -----------------------------------------------------------------------------
  // 1. PushSubscription Model Validation & Schema Constraints
  // -----------------------------------------------------------------------------
  console.log('--- 1. PushSubscription Schema & Model Validation ---');

  await runAsyncTest('1.1 Valid push subscription document passes schema validation', async () => {
    const sub = new PushSubscription({
      user: new mongoose.Types.ObjectId(),
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-token-12345',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0P6Y8=',
        auth: 'tBHItJI5svbpez7KI4CCXg=='
      },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)'
    });

    await sub.validate();
    assert.strictEqual(sub.endpoint, 'https://fcm.googleapis.com/fcm/send/test-endpoint-token-12345');
    assert.strictEqual(sub.keys.p256dh, 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0P6Y8=');
    assert.strictEqual(sub.keys.auth, 'tBHItJI5svbpez7KI4CCXg==');
  });

  await runAsyncTest('1.2 Missing user reference is rejected by schema validator', async () => {
    const sub = new PushSubscription({
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-token',
      keys: { p256dh: 'abc', auth: 'def' }
    });

    try {
      await sub.validate();
      assert.fail('Should have failed validation');
    } catch (err) {
      assert.ok(err.errors['user'], 'user error should exist');
    }
  });

  await runAsyncTest('1.3 Missing endpoint is rejected by schema validator', async () => {
    const sub = new PushSubscription({
      user: new mongoose.Types.ObjectId(),
      keys: { p256dh: 'abc', auth: 'def' }
    });

    try {
      await sub.validate();
      assert.fail('Should have failed validation');
    } catch (err) {
      assert.ok(err.errors['endpoint'], 'endpoint error should exist');
    }
  });

  await runAsyncTest('1.4 Missing keys (p256dh or auth) is rejected by schema validator', async () => {
    const sub = new PushSubscription({
      user: new mongoose.Types.ObjectId(),
      endpoint: 'https://example.com/push'
    });

    try {
      await sub.validate();
      assert.fail('Should have failed validation');
    } catch (err) {
      assert.ok(err.errors['keys.p256dh'] || err.errors['keys.auth']);
    }
  });

  // -----------------------------------------------------------------------------
  // 2. Controller Handlers: VAPID Key, Subscription & Validation
  // -----------------------------------------------------------------------------
  console.log('\n--- 2. Push Notification Controller Logic & Anti-IDOR ---');

  await runAsyncTest('2.1 getPushPublicKey returns 200 with valid VAPID public key', async () => {
    let responseData = null;
    let statusCode = null;

    const req = {};
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (payload) => {
            responseData = payload;
            return payload;
          }
        };
      }
    };

    await getPushPublicKey(req, res, () => {});

    assert.strictEqual(statusCode, 200);
    assert.strictEqual(responseData.success, true);
    assert.ok(responseData.publicKey, 'Public key should be present in response');
    assert.ok(responseData.publicKey.length > 20, 'Public key should be non-trivial');
  });

  await runAsyncTest('2.2 subscribePush rejects missing or non-HTTP endpoint with HTTP 400', async () => {
    let responseData = null;
    let statusCode = null;

    const req = {
      user: { _id: new mongoose.Types.ObjectId() },
      body: {
        endpoint: 'ftp://invalid-url',
        keys: { p256dh: 'key', auth: 'secret' }
      }
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (payload) => {
            responseData = payload;
            return payload;
          }
        };
      }
    };

    await subscribePush(req, res, () => {});

    assert.strictEqual(statusCode, 400);
    assert.strictEqual(responseData.success, false);
    assert.ok(responseData.message.includes('Valid push subscription endpoint'));
  });

  await runAsyncTest('2.3 subscribePush rejects missing keys object with HTTP 400', async () => {
    let responseData = null;
    let statusCode = null;

    const req = {
      user: { _id: new mongoose.Types.ObjectId() },
      body: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/12345'
      }
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (payload) => {
            responseData = payload;
            return payload;
          }
        };
      }
    };

    await subscribePush(req, res, () => {});

    assert.strictEqual(statusCode, 400);
    assert.strictEqual(responseData.success, false);
    assert.ok(responseData.message.includes('Push keys with valid p256dh and auth'));
  });

  await runAsyncTest('2.4 subscribePush registers valid subscription for authenticated user', async () => {
    let responseData = null;
    let statusCode = null;
    const mockUserId = new mongoose.Types.ObjectId();

    const originalFindOneAndUpdate = PushSubscription.findOneAndUpdate;
    PushSubscription.findOneAndUpdate = async (filter, update) => {
      assert.strictEqual(update.user.toString(), mockUserId.toString(), 'Must isolate to authenticated user');
      assert.strictEqual(update.endpoint, 'https://fcm.googleapis.com/fcm/send/mock-token');
      return {
        _id: new mongoose.Types.ObjectId(),
        endpoint: update.endpoint,
        user: update.user
      };
    };

    try {
      const req = {
        user: { _id: mockUserId },
        body: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/mock-token',
          keys: { p256dh: 'mock-p256dh-key', auth: 'mock-auth-key' },
          userAgent: 'Test Agent'
        }
      };
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              responseData = payload;
              return payload;
            }
          };
        }
      };

      await subscribePush(req, res, () => {});

      assert.strictEqual(statusCode, 201);
      assert.strictEqual(responseData.success, true);
      assert.ok(responseData.subscriptionId, 'Should return created subscriptionId');
    } finally {
      PushSubscription.findOneAndUpdate = originalFindOneAndUpdate;
    }
  });

  await runAsyncTest('2.5 unsubscribePush enforces Anti-IDOR (only deletes subscription for req.user._id)', async () => {
    let responseData = null;
    let statusCode = null;
    const mockUserId = new mongoose.Types.ObjectId();

    const originalFindOneAndDelete = PushSubscription.findOneAndDelete;
    let queryCaptured = null;
    PushSubscription.findOneAndDelete = async (query) => {
      queryCaptured = query;
      return { _id: new mongoose.Types.ObjectId(), endpoint: query.endpoint };
    };

    try {
      const req = {
        user: { _id: mockUserId },
        body: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/mock-token'
        }
      };
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              responseData = payload;
              return payload;
            }
          };
        }
      };

      await unsubscribePush(req, res, () => {});

      assert.strictEqual(statusCode, 200);
      assert.strictEqual(responseData.success, true);
      assert.strictEqual(queryCaptured.endpoint, 'https://fcm.googleapis.com/fcm/send/mock-token');
      assert.strictEqual(queryCaptured.user.toString(), mockUserId.toString(), 'Query must enforce ownership');
    } finally {
      PushSubscription.findOneAndDelete = originalFindOneAndDelete;
    }
  });

  await runAsyncTest('2.6 unsubscribePush handles already-removed subscription idempotently', async () => {
    let responseData = null;
    let statusCode = null;

    const originalFindOneAndDelete = PushSubscription.findOneAndDelete;
    PushSubscription.findOneAndDelete = async () => null;

    try {
      const req = {
        user: { _id: new mongoose.Types.ObjectId() },
        body: { endpoint: 'https://fcm.googleapis.com/fcm/send/nonexistent' }
      };
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              responseData = payload;
              return payload;
            }
          };
        }
      };

      await unsubscribePush(req, res, () => {});

      assert.strictEqual(statusCode, 200);
      assert.strictEqual(responseData.success, true);
      assert.strictEqual(responseData.unsubscribed, true);
    } finally {
      PushSubscription.findOneAndDelete = originalFindOneAndDelete;
    }
  });

  // -----------------------------------------------------------------------------
  // 3. Notification Router Mounting & Precedence Verification
  // -----------------------------------------------------------------------------
  console.log('\n--- 3. Notification Router Mounting & Precedence Verification ---');

  runTest('3.1 notificationRoutes exposes an Express router instance', () => {
    assert.strictEqual(typeof notificationRoutes, 'function');
    assert.ok(notificationRoutes.stack, 'Router stack should be populated');
  });

  runTest('3.2 Push endpoints are declared prior to wildcard /:notificationId route', () => {
    const routesFile = fs.readFileSync(path.join(__dirname, 'src', 'routes', 'notificationRoutes.js'), 'utf8');

    const pushSubscribeIndex = routesFile.indexOf("router.post('/push/subscribe'");
    const pushUnsubscribeIndex = routesFile.indexOf("router.post('/push/unsubscribe'");
    const wildcardParamIndex = routesFile.indexOf("router.patch('/:notificationId/read'");

    assert.ok(pushSubscribeIndex > 0, 'push/subscribe route must be defined');
    assert.ok(pushUnsubscribeIndex > 0, 'push/unsubscribe route must be defined');
    assert.ok(wildcardParamIndex > 0, ':notificationId wildcard route must be defined');

    assert.ok(
      pushSubscribeIndex < wildcardParamIndex,
      'Push routes must precede :notificationId to prevent parameter capture'
    );
    assert.ok(
      pushUnsubscribeIndex < wildcardParamIndex,
      'Push unsubscribe route must precede :notificationId'
    );
  });

  // -----------------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`Phase 21 PWA Backend Tests: ${passed} passed, ${failed} failed.`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
