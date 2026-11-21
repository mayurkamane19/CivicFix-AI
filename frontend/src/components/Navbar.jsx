import React, { useState } from 'react';
import StatusIndicator from './StatusIndicator';
import NotificationCenter from './notifications/NotificationCenter';

export const Navbar = ({
  backendStatus,
  backendError,
  onRefreshStatus,
  currentUser,
  currentView,
  onNavigateHome,
  onNavigateReport,
  onNavigateTrack,
  onNavigateMap,
  onNavigateLogin,
  onNavigateRegister,
  onNavigateProfile,
  onNavigateCitizen,
  onNavigateMyComplaints,
  onNavigateAdmin,
  onNavigateMunicipal,
  onNavigateOfficer,
  onLogout
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="navbar-container">
      <div className="navbar-inner">
        {/* Brand Logo */}
        <button
          type="button"
          onClick={onNavigateHome}
          className="navbar-brand-btn"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          title="Return to Home"
        >
          <div className="navbar-brand">
            <div className="brand-icon-wrapper">
              <svg
                className="brand-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
                <path d="M12 2v4" stroke="#60a5fa" />
              </svg>
            </div>
            <div className="brand-text">
              <span className="brand-title">CivicFix</span>
              <span className="brand-badge">AI</span>
            </div>
          </div>
        </button>

        {/* Primary Navigation Links (Desktop) */}
        <nav className="navbar-links">
          <button
            type="button"
            onClick={onNavigateHome}
            className={`nav-link-btn ${currentView === 'home' ? 'nav-link-active' : ''}`}
          >
            Home
          </button>
          <button
            type="button"
            onClick={onNavigateReport}
            className={`nav-link-btn ${currentView === 'report' ? 'nav-link-active' : ''}`}
          >
            Report an Issue
          </button>
          <button
            type="button"
            onClick={() => onNavigateTrack('')}
            className={`nav-link-btn ${currentView === 'track' ? 'nav-link-active' : ''}`}
          >
            Track Complaint
          </button>
          <button
            type="button"
            onClick={onNavigateMap}
            className={`nav-link-btn ${currentView === 'map' ? 'nav-link-active' : ''}`}
          >
            🗺️ Public Map
          </button>
          {currentUser?.role === 'citizen' && (
            <>
              <button
                type="button"
                onClick={onNavigateCitizen}
                className={`nav-link-btn ${currentView === 'citizen' ? 'nav-link-active' : ''}`}
              >
                📊 Dashboard
              </button>
              <button
                type="button"
                onClick={onNavigateMyComplaints}
                className={`nav-link-btn ${currentView === 'my-complaints' ? 'nav-link-active' : ''}`}
              >
                📂 My Complaints
              </button>
            </>
          )}
          {currentUser?.role === 'admin' && (
            <>
              <button
                type="button"
                onClick={onNavigateAdmin}
                className={`nav-link-btn nav-link-admin ${currentView === 'admin' ? 'nav-link-active' : ''}`}
              >
                🛡️ Admin Portal
              </button>
              <button
                type="button"
                onClick={onNavigateMunicipal}
                className={`nav-link-btn nav-link-admin ${currentView === 'municipal' ? 'nav-link-active' : ''}`}
              >
                🏛️ Multi-Ward
              </button>
            </>
          )}
          {currentUser?.role === 'ward_admin' && (
            <button
              type="button"
              onClick={onNavigateMunicipal}
              className={`nav-link-btn nav-link-admin ${currentView === 'municipal' ? 'nav-link-active' : ''}`}
            >
              🏛️ Ward Portal
            </button>
          )}
          {currentUser?.role === 'officer' && (
            <button
              type="button"
              onClick={onNavigateOfficer}
              className={`nav-link-btn nav-link-admin ${currentView === 'officer' ? 'nav-link-active' : ''}`}
            >
              👷 Officer Portal
            </button>
          )}
          <a
            href="#architecture"
            className="nav-link"
            onClick={() => {
              if (currentView !== 'home') onNavigateHome();
            }}
          >
            Architecture
          </a>
        </nav>

        {/* Right Section: Status Indicator & Authentication State */}
        <div className="navbar-actions">
          <StatusIndicator
            status={backendStatus}
            error={backendError}
            onRetry={onRefreshStatus}
            detailed={false}
          />

          {currentUser ? (
            <div className="user-nav-group">
              <NotificationCenter
                currentUser={currentUser}
                onNavigateTrack={onNavigateTrack}
                onNavigateAdmin={onNavigateAdmin}
                onNavigateOfficer={onNavigateOfficer}
              />
              <button
                type="button"
                className="user-profile-pill"
                onClick={onNavigateProfile}
                title="View Authenticated Profile"
              >
                <span className="avatar-mini">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </span>
                <span className="user-nav-name">{currentUser.name}</span>
                <span className="user-nav-role">{currentUser.role}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={onLogout}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="auth-nav-buttons">
              <button
                type="button"
                className="btn btn-outline"
                onClick={onNavigateLogin}
              >
                Sign In
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onNavigateRegister}
              >
                Register
              </button>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          className="mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
            {mobileMenuOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          <nav className="mobile-nav-links">
            <button
              type="button"
              className="mobile-nav-link-btn"
              onClick={() => {
                onNavigateHome();
                setMobileMenuOpen(false);
              }}
            >
              Home
            </button>
            <button
              type="button"
              className="mobile-nav-link-btn"
              onClick={() => {
                onNavigateReport();
                setMobileMenuOpen(false);
              }}
            >
              Report an Issue
            </button>
            <button
              type="button"
              className="mobile-nav-link-btn"
              onClick={() => {
                onNavigateTrack('');
                setMobileMenuOpen(false);
              }}
            >
              Track Complaint
            </button>
            <button
              type="button"
              className="mobile-nav-link-btn"
              onClick={() => {
                onNavigateMap();
                setMobileMenuOpen(false);
              }}
            >
              🗺️ Public Issue Map
            </button>
            {currentUser?.role === 'citizen' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateCitizen?.();
                    setMobileMenuOpen(false);
                  }}
                  className={`mobile-nav-link-btn ${currentView === 'citizen' ? 'nav-link-active' : ''}`}
                >
                  📊 My Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateMyComplaints?.();
                    setMobileMenuOpen(false);
                  }}
                  className={`mobile-nav-link-btn ${currentView === 'my-complaints' ? 'nav-link-active' : ''}`}
                >
                  📂 My Complaints
                </button>
              </>
            )}
          {currentUser?.role === 'admin' && (
              <>
                <button
                  type="button"
                  className="mobile-nav-link-btn mobile-nav-admin"
                  onClick={() => {
                    onNavigateAdmin();
                    setMobileMenuOpen(false);
                  }}
                >
                  🛡️ Municipal Admin Portal
                </button>
                <button
                  type="button"
                  className="mobile-nav-link-btn mobile-nav-admin"
                  onClick={() => {
                    onNavigateMunicipal();
                    setMobileMenuOpen(false);
                  }}
                >
                  🏛️ Multi-Ward Command
                </button>
              </>
            )}
            {currentUser?.role === 'ward_admin' && (
              <button
                type="button"
                className="mobile-nav-link-btn mobile-nav-admin"
                onClick={() => {
                  onNavigateMunicipal();
                  setMobileMenuOpen(false);
                }}
              >
                🏛️ Ward Command Portal
              </button>
            )}
            {currentUser?.role === 'officer' && (
              <button
                type="button"
                className="mobile-nav-link-btn mobile-nav-admin"
                onClick={() => {
                  onNavigateOfficer();
                  setMobileMenuOpen(false);
                }}
              >
                👷 Field Officer Portal
              </button>
            )}
            <a
              href="#architecture"
              className="mobile-nav-link"
              onClick={() => {
                onNavigateHome();
                setMobileMenuOpen(false);
              }}
            >
              Architecture
            </a>
          </nav>
          <div className="mobile-menu-footer">
            <StatusIndicator
              status={backendStatus}
              error={backendError}
              onRetry={onRefreshStatus}
              detailed={false}
            />

            {currentUser ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                <button
                  type="button"
                  className="btn btn-outline full-width"
                  onClick={() => {
                    onNavigateProfile();
                    setMobileMenuOpen(false);
                  }}
                >
                  My Profile ({currentUser.name})
                </button>
                <button
                  type="button"
                  className="btn btn-secondary full-width"
                  onClick={() => {
                    onLogout();
                    setMobileMenuOpen(false);
                  }}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                <button
                  type="button"
                  className="btn btn-outline full-width"
                  onClick={() => {
                    onNavigateLogin();
                    setMobileMenuOpen(false);
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className="btn btn-primary full-width"
                  onClick={() => {
                    onNavigateRegister();
                    setMobileMenuOpen(false);
                  }}
                >
                  Register Citizen Account
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
