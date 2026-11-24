/**
 * Phase 25: Real Web Push Notification Dispatch Service
 * CivicFix AI - Municipal Push Notification Engine
 */

import { PushSubscription } from '../models/PushSubscription.js';
import { getDatabaseStatus } from '../config/db.js';

/**
 * Checks if VAPID keys are configured in environment
 * @returns {boolean}
 */
export const isPushConfigured = () => {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  return Boolean(pub && pub.trim() && priv && priv.trim());
};

/**
 * Dispatches a Web Push notification to all active browser subscriptions of a specific user.
 * Automatically cleans up expired/unregistered subscriptions (HTTP 404/410).
 * Non-blocking: never aborts primary database operations if push delivery encounters error.
 * 
 * @param {string} userId - Target User ID
 * @param {object} payload - Notification payload { title, message, complaintId, url }
 * @returns {Promise<{ dispatched: number, failed: number, cleaned: number, unconfigured?: boolean }>}
 */
export const dispatchPushToUser = async (userId, payload = {}) => {
  if (!userId) {
    return { dispatched: 0, failed: 0, cleaned: 0 };
  }

  if (getDatabaseStatus() !== 'connected') {
    return { dispatched: 0, failed: 0, cleaned: 0, offline: true };
  }

  // 1. Fetch all active subscriptions for the recipient
  let subscriptions = [];
  try {
    subscriptions = await PushSubscription.find({ user: userId });
  } catch (dbErr) {
    console.warn(`[Push Service] Could not retrieve subscriptions for user ${userId}:`, dbErr.message);
    return { dispatched: 0, failed: 0, cleaned: 0 };
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { dispatched: 0, failed: 0, cleaned: 0 };
  }

  const payloadString = JSON.stringify({
    title: payload.title || 'CivicFix AI Municipal Update',
    message: payload.message || payload.body || 'New update regarding your municipal report.',
    complaintId: payload.complaintId || null,
    url: payload.url || (payload.complaintId ? `/track?id=${payload.complaintId}` : '/'),
    timestamp: Date.now()
  });

  // 2. Check if web-push package and VAPID keys are present
  const configured = isPushConfigured();
  if (!configured) {
    console.log(`[Push Service] Outbound push skipped for user ${userId}: VAPID keys not configured in environment.`);
    return { dispatched: 0, failed: 0, cleaned: 0, unconfigured: true };
  }

  let webpush = null;
  try {
    const webpushModule = await import('web-push');
    webpush = webpushModule.default?.setVapidDetails ? webpushModule.default : webpushModule;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:notifications@civicfix.ai',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } catch {
    console.log(`[Push Service] Notice: 'web-push' library not available in runtime; simulated push recorded.`);
    return { dispatched: 0, failed: 0, cleaned: 0, libraryMissing: true };
  }

  let dispatched = 0;
  let failed = 0;
  let cleaned = 0;

  for (const sub of subscriptions) {
    try {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth
        }
      };

      await webpush.sendNotification(pushSubscription, payloadString);
      dispatched++;
    } catch (pushErr) {
      failed++;
      // Auto-pruning: HTTP 404 (Not Found) or 410 (Gone) indicates revoked or expired subscription
      if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
        try {
          await PushSubscription.findByIdAndDelete(sub._id);
          cleaned++;
          console.log(`[Push Service] Removed expired subscription ${sub._id} (${pushErr.statusCode})`);
        } catch (cleanErr) {
          console.warn(`[Push Service] Error cleaning expired subscription ${sub._id}:`, cleanErr.message);
        }
      } else {
        console.warn(`[Push Service] Push delivery failed for subscription ${sub._id}:`, pushErr.message);
      }
    }
  }

  return { dispatched, failed, cleaned };
};

export default {
  isPushConfigured,
  dispatchPushToUser
};
