import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Footer from '../components/Footer';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import ReportIssuePage from './ReportIssuePage';
import TrackComplaintPage from './TrackComplaintPage';
import PublicComplaintMapPage from './PublicComplaintMapPage';
import AdminDashboard from './AdminDashboard';
import OfficerDashboard from './OfficerDashboard';
import UserProfile from '../components/UserProfile';
import { checkHealth, getMeApi, getStoredUser, clearSession } from '../services/api';

export const LandingPage = () => {
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking' | 'connected' | 'disconnected'
  const [backendData, setBackendData] = useState(null);
  const [backendError, setBackendError] = useState(null);

  // Authentication State & Client-Side View Navigation
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [currentView, setCurrentView] = useState('home'); // 'home' | 'report' | 'track' | 'login' | 'register' | 'profile'
  const [trackComplaintId, setTrackComplaintId] = useState('');

  // Verify backend health
  const verifyBackendConnection = useCallback(async () => {
    setBackendStatus('checking');
    setBackendError(null);

    const result = await checkHealth();

    if (result.success) {
      setBackendStatus('connected');
      setBackendData(result.data);
      setBackendError(null);
    } else {
      setBackendStatus('disconnected');
      setBackendData(null);
      setBackendError(result.error);
    }
  }, []);

  // Verify active user session on mount
  useEffect(() => {
    verifyBackendConnection();

    const verifySession = async () => {
      const res = await getMeApi();
      if (res.success && res.data) {
        setCurrentUser(res.data);
      } else {
        if (currentUser) {
          clearSession();
          setCurrentUser(null);
        }
      }
    };

    verifySession();
  }, [verifyBackendConnection]);

  // Auth Handlers
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      setCurrentView('admin');
    } else if (user.role === 'officer') {
      setCurrentView('officer');
    } else {
      setCurrentView('profile');
    }
  };

  const handleRegisterSuccess = (user) => {
    setCurrentUser(user);
    setCurrentView('profile');
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setCurrentView('home');
  };

  const handleNavigateTrack = (complaintId = '') => {
    setTrackComplaintId(complaintId);
    setCurrentView('track');
  };

  return (
    <div className="app-layout">
      {/* Top Navigation */}
      <Navbar
        backendStatus={backendStatus}
        backendError={backendError}
        onRefreshStatus={verifyBackendConnection}
        currentUser={currentUser}
        currentView={currentView}
        onNavigateHome={() => setCurrentView('home')}
        onNavigateReport={() => setCurrentView('report')}
        onNavigateTrack={handleNavigateTrack}
        onNavigateMap={() => setCurrentView('map')}
        onNavigateLogin={() => setCurrentView('login')}
        onNavigateRegister={() => setCurrentView('register')}
        onNavigateProfile={() => setCurrentView('profile')}
        onNavigateAdmin={() => setCurrentView('admin')}
        onNavigateOfficer={() => setCurrentView('officer')}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {currentView === 'report' && (
          <ReportIssuePage
            onNavigateTrack={handleNavigateTrack}
            onNavigateHome={() => setCurrentView('home')}
          />
        )}

        {currentView === 'track' && (
          <TrackComplaintPage
            initialComplaintId={trackComplaintId}
            onNavigateReport={() => setCurrentView('report')}
            onNavigateHome={() => setCurrentView('home')}
          />
        )}

        {currentView === 'map' && (
          <PublicComplaintMapPage
            onNavigateTrack={handleNavigateTrack}
            onNavigateReport={() => setCurrentView('report')}
          />
        )}

        {currentView === 'login' && (
          <LoginPage
            onLoginSuccess={handleLoginSuccess}
            onNavigateRegister={() => setCurrentView('register')}
            onNavigateHome={() => setCurrentView('home')}
          />
        )}

        {currentView === 'register' && (
          <RegisterPage
            onRegisterSuccess={handleRegisterSuccess}
            onNavigateLogin={() => setCurrentView('login')}
            onNavigateHome={() => setCurrentView('home')}
          />
        )}

        {currentView === 'profile' && currentUser && (
          <UserProfile
            user={currentUser}
            onLogout={handleLogout}
            onNavigateHome={() => setCurrentView('home')}
          />
        )}

        {currentView === 'admin' && (
          <AdminDashboard
            currentUser={currentUser}
            onNavigateHome={() => setCurrentView('home')}
            onNavigateLogin={() => setCurrentView('login')}
          />
        )}

        {currentView === 'officer' && (
          <OfficerDashboard
            currentUser={currentUser}
            onNavigateHome={() => setCurrentView('home')}
            onNavigateLogin={() => setCurrentView('login')}
          />
        )}

        {currentView === 'home' && (
          <>
            {/* Hero Section with Live Status Card */}
            <Hero
              backendStatus={backendStatus}
              backendData={backendData}
              backendError={backendError}
              onRefreshStatus={verifyBackendConnection}
              currentUser={currentUser}
              onNavigateReport={() => setCurrentView('report')}
              onNavigateTrack={handleNavigateTrack}
              onNavigateLogin={() => setCurrentView('login')}
              onNavigateRegister={() => setCurrentView('register')}
            />

            {/* Platform Pillars Section */}
            <section id="overview" className="section-features">
              <div className="section-container">
                <div className="section-header">
                  <span className="section-kicker">SMART CIVIC INFRASTRUCTURE</span>
                  <h2 className="section-title">Designed for Modern Cities &amp; Engaged Communities</h2>
                  <p className="section-subtitle">
                    A structured, scalable architecture built to turn community feedback into measurable urban improvements.
                  </p>
                </div>

                <div className="features-grid">
                  <div className="feature-card">
                    <div className="feature-icon-wrapper">
                      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                    </div>
                    <h3 className="feature-title">Rapid Issue Reporting</h3>
                    <p className="feature-desc">
                      Citizens report hazards with geolocation, structured categories, and instant complaint tracking numbers.
                    </p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon-wrapper">
                      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </div>
                    <h3 className="feature-title">Real-Time Ticket Tracking</h3>
                    <p className="feature-desc">
                      Track the resolution pipeline live from Pending, In Progress to Resolved with full municipal accountability.
                    </p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon-wrapper">
                      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="feature-title">Full Resolution Transparency</h3>
                    <p className="feature-desc">
                      End-to-end auditability and live resolution status keeps communities informed every step of the repair workflow.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Architecture Overview Section */}
            <section id="architecture" className="section-architecture">
              <div className="section-container">
                <div className="architecture-panel">
                  <div className="architecture-content">
                    <span className="section-kicker">PHASE 4 COMPLAINTS &amp; ISSUE TRACKING</span>
                    <h2 className="section-title">Decoupled Full-Stack Architecture with REST APIs</h2>
                    <p className="architecture-text">
                      The frontend React client communicates asynchronously with the Express backend service.
                      Complaints are validated, assigned standard municipal ticket identifiers (`CFX-YYYYMMDD-XXXX`), and persisted in MongoDB with public tracking endpoints.
                    </p>

                    <div className="endpoints-list">
                      <div className="endpoint-item">
                        <span className="badge-method">GET</span>
                        <span className="endpoint-path">/api/health</span>
                        <span className="endpoint-desc">Live system &amp; MongoDB availability monitoring</span>
                      </div>
                      <div className="endpoint-item">
                        <span className="badge-method">POST</span>
                        <span className="endpoint-path">/api/complaints</span>
                        <span className="endpoint-desc">Submit new civic issue report (Guest &amp; Citizen)</span>
                      </div>
                      <div className="endpoint-item">
                        <span className="badge-method">GET</span>
                        <span className="endpoint-path">/api/complaints/track/:complaintId</span>
                        <span className="endpoint-desc">Track resolution pipeline status by Ticket ID</span>
                      </div>
                      <div className="endpoint-item">
                        <span className="badge-method">POST</span>
                        <span className="endpoint-path">/api/auth/login</span>
                        <span className="endpoint-desc">Citizen &amp; Official sign in with JWT token issuance</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default LandingPage;
