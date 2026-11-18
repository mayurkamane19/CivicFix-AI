import React from 'react';

/**
 * StatusIndicator Component
 * Displays the real-time connectivity status between Frontend and Express Backend.
 * Supports three states: 'connected' (green), 'disconnected' (red), 'checking' (neutral).
 */
export const StatusIndicator = ({ status, error, onRetry, detailed = false }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          label: 'Backend Connected',
          dotClass: 'status-dot status-connected',
          badgeClass: 'status-badge badge-connected',
          description: 'Express API is active and healthy (port 5000)'
        };
      case 'disconnected':
        return {
          label: 'Backend Disconnected',
          dotClass: 'status-dot status-disconnected',
          badgeClass: 'status-badge badge-disconnected',
          description: error || 'Unable to reach backend at http://localhost:5000'
        };
      case 'checking':
      default:
        return {
          label: 'Checking API Status...',
          dotClass: 'status-dot status-checking',
          badgeClass: 'status-badge badge-checking',
          description: 'Contacting http://localhost:5000/api/health'
        };
    }
  };

  const config = getStatusConfig();

  if (!detailed) {
    return (
      <div className={`status-pill ${config.badgeClass}`} title={config.description}>
        <span className={config.dotClass}></span>
        <span className="status-label">{config.label}</span>
      </div>
    );
  }

  return (
    <div className={`status-card ${config.badgeClass}`}>
      <div className="status-card-header">
        <div className="status-header-info">
          <span className={config.dotClass}></span>
          <span className="status-title">{config.label}</span>
        </div>
        {onRetry && (
          <button
            type="button"
            className="status-refresh-btn"
            onClick={onRetry}
            disabled={status === 'checking'}
            title="Refresh backend status"
          >
            {status === 'checking' ? 'Testing...' : 'Test Connection'}
          </button>
        )}
      </div>
      <p className="status-detail-text">{config.description}</p>
    </div>
  );
};

export default StatusIndicator;
