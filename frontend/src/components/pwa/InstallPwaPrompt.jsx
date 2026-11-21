import React, { useState, useEffect } from 'react';
import {
  isStandaloneApp,
  isInstallPromptAvailable,
  promptInstall,
  onInstallStateChange
} from '../../utils/serviceWorkerRegistration';
import './pwa.css';

/**
 * InstallPwaPrompt
 * Surfaces a clean, non-intrusive installation banner for mobile and desktop browsers.
 * Hides automatically if running in standalone mode or dismissed by user.
 */
export const InstallPwaPrompt = () => {
  const [canInstall, setCanInstall] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if already in standalone display mode
    const standalone = isStandaloneApp();
    setIsStandalone(standalone);

    if (standalone) return;

    // Check for iOS Safari
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent.toLowerCase() : '';
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);
    if (isIosDevice && isSafari && !standalone) {
      setIsIOS(true);
    }

    // Subscribe to browser install prompt availability
    const unsubscribe = onInstallStateChange((available) => {
      setCanInstall(available);
    });

    return () => unsubscribe();
  }, []);

  if (isStandalone || isDismissed || (!canInstall && !isIOS)) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    const { outcome } = await promptInstall();
    if (outcome === 'accepted') {
      setIsDismissed(true);
    }
  };

  return (
    <aside className="pwa-install-bar" aria-label="Install CivicFix AI Application">
      <div className="pwa-install-inner">
        <div className="pwa-install-brand">
          <img src="/icons/icon-72.png" alt="CivicFix AI" className="pwa-install-icon" />
          <div>
            <div className="pwa-install-title">Install CivicFix AI</div>
            <div className="pwa-install-desc">Install as a native app for faster issue reporting &amp; offline support</div>
          </div>
        </div>

        <div className="pwa-install-actions">
          <button
            type="button"
            className="pwa-btn pwa-btn-primary"
            onClick={handleInstallClick}
          >
            📲 Install App
          </button>
          <button
            type="button"
            className="pwa-btn pwa-btn-ghost"
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss installation prompt"
          >
            ✕
          </button>
        </div>
      </div>

      {showIOSInstructions && (
        <div className="pwa-ios-modal-overlay" onClick={() => setShowIOSInstructions(false)}>
          <div className="pwa-ios-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pwa-ios-modal-header">
              <h3>Install on iOS Safari</h3>
              <button className="pwa-btn-close" onClick={() => setShowIOSInstructions(false)}>✕</button>
            </div>
            <ol className="pwa-ios-steps">
              <li>Tap the <strong>Share</strong> button <span style={{ fontSize: '1.2rem' }}>⎋</span> in Safari's bottom toolbar.</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong> <span style={{ fontSize: '1.2rem' }}>➕</span>.</li>
              <li>Tap <strong>Add</strong> in the top-right corner.</li>
            </ol>
            <button className="pwa-btn pwa-btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => setShowIOSInstructions(false)}>
              Got it!
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

export default InstallPwaPrompt;
