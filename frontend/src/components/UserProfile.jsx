import React, { useState } from 'react';
import { updateNotificationPreferencesApi } from '../services/api';

export const UserProfile = ({ user, onLogout, onNavigateHome }) => {
  if (!user) {
    return null;
  }

  const [emailNotifications, setEmailNotifications] = useState(
    Boolean(user.emailNotificationsEnabled)
  );
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefFeedback, setPrefFeedback] = useState(null);

  const formattedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'Active Session';

  const handleToggleNotifications = async (e) => {
    const nextVal = e.target.checked;
    setEmailNotifications(nextVal);
    setSavingPrefs(true);
    setPrefFeedback(null);

    const res = await updateNotificationPreferencesApi(nextVal);
    setSavingPrefs(false);

    if (res.success) {
      setPrefFeedback({
        type: 'success',
        message: nextVal
          ? 'Email notification alerts enabled for your account.'
          : 'Email notifications disabled.'
      });
      user.emailNotificationsEnabled = nextVal;
    } else {
      // Revert on error
      setEmailNotifications(!nextVal);
      setPrefFeedback({
        type: 'error',
        message: res.error || 'Failed to update notification preferences'
      });
    }

    setTimeout(() => {
      setPrefFeedback(null);
    }, 4000);
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card profile-card">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="user-avatar-circle">
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <h2 className="profile-name">{user.name}</h2>
          <span className={`role-badge role-${user.role || 'citizen'}`}>
            {(user.role || 'citizen').toUpperCase()}
          </span>
        </div>

        {/* User Details Grid */}
        <div className="profile-details-grid">
          <div className="profile-item">
            <span className="profile-label">Email Address</span>
            <span className="profile-value">{user.email}</span>
          </div>

          <div className="profile-item">
            <span className="profile-label">Account Role</span>
            <span className="profile-value" style={{ textTransform: 'capitalize' }}>
              {user.role || 'Citizen'}
            </span>
          </div>

          <div className="profile-item">
            <span className="profile-label">Account Status</span>
            <span className="profile-value status-active-text">
              ● Active
            </span>
          </div>

          <div className="profile-item">
            <span className="profile-label">Member Since</span>
            <span className="profile-value">{formattedDate}</span>
          </div>
        </div>

        {/* Notification Preferences Card (Phase 13) */}
        <div className="security-notice-box" style={{ background: '#f8fafc', borderColor: '#e2e8f0', marginTop: '1.25rem' }}>
          <div className="security-notice-icon">📬</div>
          <div className="security-notice-content" style={{ width: '100%' }}>
            <h4 className="security-notice-title" style={{ color: '#1e293b' }}>Email Notification Preferences</h4>
            <p className="security-notice-desc">
              Manage automatic municipal alerts for complaint assignments, status changes, and resolutions.
            </p>

            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                id="user-profile-notif-toggle"
                type="checkbox"
                checked={emailNotifications}
                onChange={handleToggleNotifications}
                disabled={savingPrefs}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label
                htmlFor="user-profile-notif-toggle"
                style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
              >
                {emailNotifications ? 'Email alerts are active' : 'Email alerts are paused'}
                {savingPrefs && <span style={{ marginLeft: '8px', color: '#64748b', fontSize: '0.75rem' }}>(Saving...)</span>}
              </label>
            </div>

            {prefFeedback && (
              <div
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.8125rem',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: prefFeedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
                  color: prefFeedback.type === 'success' ? '#166534' : '#991b1b',
                  border: `1px solid ${prefFeedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`
                }}
              >
                {prefFeedback.message}
              </div>
            )}
          </div>
        </div>

        {/* Security Banner */}
        <div className="security-notice-box">
          <div className="security-notice-icon">🛡️</div>
          <div className="security-notice-content">
            <h4 className="security-notice-title">Authenticated Session Active</h4>
            <p className="security-notice-desc">
              Your identity is verified using encrypted JSON Web Tokens (JWT). All requests to protected civic APIs are authorized.
            </p>
          </div>
        </div>

        {/* Profile Actions */}
        <div className="profile-actions">
          <button
            type="button"
            className="btn btn-primary full-width"
            onClick={onNavigateHome}
          >
            Explore Civic Platform
          </button>
          <button
            type="button"
            className="btn btn-secondary full-width"
            onClick={onLogout}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
