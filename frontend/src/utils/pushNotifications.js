/**
 * CivicFix AI - Browser Web Push Notification Helper
 * Manages push permission requests, subscription via Service Worker PushManager,
 * and synchronization with the CivicFix backend.
 */

import { getPushPublicKeyApi, subscribePushApi, unsubscribePushApi } from '../services/api';

/**
 * Checks if Push notifications are supported in this browser
 */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Gets current notification permission state: 'default' | 'granted' | 'denied'
 */
export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Helper to convert base64 url-safe VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribes user to browser Web Push notifications (explicit user gesture)
 */
export async function subscribeToPushNotifications() {
  if (!isPushSupported()) {
    return { success: false, error: 'Push notifications are not supported by this browser.' };
  }

  // 1. Request user permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { success: false, error: 'Notification permission was not granted by user.' };
  }

  try {
    // 2. Fetch VAPID public key from backend
    const keyRes = await getPushPublicKeyApi();
    if (!keyRes.success || !keyRes.data?.publicKey) {
      return { success: false, error: keyRes.error || 'Could not retrieve VAPID public key from server.' };
    }

    const applicationServerKey = urlBase64ToUint8Array(keyRes.data.publicKey);

    // 3. Register with service worker PushManager
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    }

    // 4. Send subscription keys to backend
    const subJSON = subscription.toJSON();
    const serverRes = await subscribePushApi(subJSON);

    if (!serverRes.success) {
      return { success: false, error: serverRes.error || 'Failed to register subscription on server.' };
    }

    return { success: true, subscription: subJSON };
  } catch (err) {
    return { success: false, error: err.message || 'Error subscribing to push notifications.' };
  }
}

/**
 * Unsubscribes from browser Web Push notifications
 */
export async function unsubscribeFromPushNotifications() {
  if (!isPushSupported()) return { success: true };

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await unsubscribePushApi(endpoint);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Error unsubscribing.' };
  }
}

/**
 * Checks if there is an active push subscription
 */
export async function getCurrentPushSubscription() {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? subscription.toJSON() : null;
  } catch {
    return null;
  }
}

export default {
  isPushSupported,
  getNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getCurrentPushSubscription
};
