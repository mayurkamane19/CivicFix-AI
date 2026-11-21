/**
 * CivicFix AI - Service Worker Registration & PWA Installation Manager
 */

let deferredPrompt = null;
const installListeners = new Set();
const updateListeners = new Set();

/**
 * Registers the service worker with the browser
 */
export const registerServiceWorker = () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Check for updates
        reg.addEventListener('updatefound', () => {
          const installingWorker = reg.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New version available.');
              updateListeners.forEach((listener) => listener(reg));
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[PWA] Service worker registration failed:', err);
      });

    // Auto-reload when new service worker takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] Controller changed, app updated.');
    });
  });

  // Capture beforeinstallprompt event for custom install UI
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notifyInstallStateChanged(true);
  });

  // Track when app is installed
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyInstallStateChanged(false);
    console.log('[PWA] CivicFix AI successfully installed to home screen/desktop.');
  });
};

/**
 * Checks if running as an installed standalone PWA
 */
export const isStandaloneApp = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    window.navigator.standalone === true
  );
};

/**
 * Checks if the browser has made the install prompt available
 */
export const isInstallPromptAvailable = () => {
  return Boolean(deferredPrompt);
};

/**
 * Triggers the browser native installation prompt
 * @returns {Promise<{outcome: 'accepted' | 'dismissed' | 'unsupported'}>}
 */
export const promptInstall = async () => {
  if (!deferredPrompt) {
    return { outcome: 'unsupported' };
  }

  deferredPrompt.prompt();
  const choiceResult = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notifyInstallStateChanged(false);

  return { outcome: choiceResult.outcome };
};

/**
 * Subscribe to installability changes (e.g. beforeinstallprompt fired)
 */
export const onInstallStateChange = (callback) => {
  installListeners.add(callback);
  callback(Boolean(deferredPrompt));
  return () => installListeners.delete(callback);
};

function notifyInstallStateChanged(available) {
  installListeners.forEach((fn) => fn(available));
}

/**
 * Subscribe to service worker update events
 */
export const onServiceWorkerUpdate = (callback) => {
  updateListeners.add(callback);
  return () => updateListeners.delete(callback);
};

export default {
  registerServiceWorker,
  isStandaloneApp,
  isInstallPromptAvailable,
  promptInstall,
  onInstallStateChange,
  onServiceWorkerUpdate
};
