import React, { useState, useEffect } from 'react';
import './pwa.css';

/**
 * OfflineBanner
 * Real-time network connectivity detector with accessible alert banner
 * and automatic recovery notice.
 */
export const OfflineBanner = ({ onOpenDrafts, draftCount = 0 }) => {
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline && !showReconnected) {
    return null;
  }

  if (showReconnected) {
    return (
      <div className="pwa-network-banner pwa-banner-online" role="status" aria-live="polite">
        <div className="pwa-banner-inner">
          <span className="pwa-banner-icon">✓</span>
          <span className="pwa-banner-text">
            <strong>Connection Restored.</strong> You are back online.
          </span>
          {draftCount > 0 && onOpenDrafts && (
            <button className="pwa-banner-btn" onClick={onOpenDrafts}>
              Sync Saved Drafts ({draftCount}) →
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pwa-network-banner pwa-banner-offline" role="status" aria-live="polite">
      <div className="pwa-banner-inner">
        <span className="pwa-banner-icon">📡</span>
        <span className="pwa-banner-text">
          <strong>You are currently offline.</strong> New issue reports will be securely saved as local drafts.
        </span>
        {draftCount > 0 && onOpenDrafts && (
          <button className="pwa-banner-btn pwa-banner-btn-offline" onClick={onOpenDrafts}>
            View Drafts ({draftCount})
          </button>
        )}
      </div>
    </div>
  );
};

export default OfflineBanner;
