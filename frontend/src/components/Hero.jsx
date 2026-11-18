import React from 'react';
import StatusIndicator from './StatusIndicator';

export const Hero = ({
  backendStatus,
  backendData,
  backendError,
  onRefreshStatus,
  currentUser,
  onNavigateReport,
  onNavigateTrack,
  onNavigateLogin,
  onNavigateRegister
}) => {
  return (
    <section id="hero" className="hero-section">
      <div className="hero-container">
        {/* Live Badge */}
        <div className="hero-badge-wrapper">
          <span className="hero-pill-badge">
            <span className="hero-pill-dot"></span>
            Next-Gen Municipal Governance Platform
          </span>
        </div>

        {/* Hero Heading */}
        <h1 className="hero-title">
          Report Problems. <span className="highlight-text">Build Better Cities.</span>
        </h1>

        {/* Hero Description */}
        <p className="hero-description">
          CivicFix AI bridges citizens and city administrators with intelligent, automated issue reporting.
          Identify infrastructure breakdowns, report hazards instantly, and monitor civic resolutions with transparent real-time tracking.
        </p>

        {/* Action Buttons */}
        <div className="hero-actions">
          <button
            type="button"
            className="btn btn-primary btn-large"
            onClick={onNavigateReport}
          >
            <svg
              className="btn-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Report an Issue
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-large"
            onClick={() => onNavigateTrack('')}
          >
            <svg
              className="btn-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Track Existing Issue
          </button>
        </div>

        {/* Live Backend Connection Card */}
        <div className="hero-status-wrapper">
          <div className="backend-card">
            <div className="backend-card-header">
              <div className="backend-card-meta">
                <span className="meta-subtitle">INTEGRATION HEALTH CHECK</span>
                <h3 className="meta-title">Express API Communication</h3>
              </div>
              <StatusIndicator
                status={backendStatus}
                error={backendError}
                onRetry={onRefreshStatus}
                detailed={false}
              />
            </div>

            <div className="backend-card-body">
              <div className="metric-row">
                <div className="metric-item">
                  <span className="metric-label">Target Endpoint</span>
                  <code className="metric-code">http://localhost:5000/api/health</code>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Status Response</span>
                  <span className={`metric-status-text status-${backendStatus}`}>
                    {backendStatus === 'connected'
                      ? (backendData?.status || 'healthy').toUpperCase()
                      : backendStatus === 'checking'
                      ? 'VERIFYING'
                      : 'OFFLINE'}
                  </span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Database Status</span>
                  <span className={`metric-status-text status-${backendData?.database === 'connected' ? 'connected' : 'disconnected'}`}>
                    {backendStatus === 'connected'
                      ? (backendData?.database ? backendData.database.toUpperCase() : 'DISCONNECTED')
                      : 'OFFLINE'}
                  </span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">System Message</span>
                  <span className="metric-value">
                    {backendStatus === 'connected'
                      ? backendData?.message || 'CivicFix AI backend is running'
                      : backendStatus === 'checking'
                      ? 'Establishing handshake...'
                      : backendError || 'Server connection failed'}
                  </span>
                </div>
              </div>
            </div>

            <div className="backend-card-footer">
              <span className="api-hint-text">
                Phase 1 Foundation: Express.js server on Node.js communicating with Vite React frontend via CORS.
              </span>
              <button
                type="button"
                className="btn-retry"
                onClick={onRefreshStatus}
                disabled={backendStatus === 'checking'}
              >
                {backendStatus === 'checking' ? 'Checking...' : 'Ping Server'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
