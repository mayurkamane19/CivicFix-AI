import React, { useState, useEffect } from 'react';
import { getMeApi, updateMyProfileApi, setStoredUser } from '../services/api';
import {
  isPushSupported,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getCurrentPushSubscription
} from '../utils/pushNotifications';
import './CitizenProfilePage.css';

/**
 * CitizenProfilePage — Profile and notification preference settings
 */
const CitizenProfilePage = ({
  currentUser,
  onUpdateUser,
  onNavigateDashboard,
  onNavigateHome
}) => {
  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [email] = useState(currentUser?.email || '');
  const [role] = useState(currentUser?.role || 'citizen');

  // Notification preferences
  const [prefs, setPrefs] = useState({
    emailNotifications: true,
    complaintStatus: true,
    slaReminders: true,
    feedbackReminders: true,
    resolutionAlerts: true
  });

  const [saving, setSaving] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', text }

  // Push notification support & subscription state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [togglingPush, setTogglingPush] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const res = await getMeApi();
      if (res.success && res.data) {
        setName(res.data.name || '');
        setPhone(res.data.phone || '');
        if (res.data.notificationPreferences) {
          setPrefs((prev) => ({
            ...prev,
            ...res.data.notificationPreferences
          }));
        }
      }

      // Check push notification capability
      const supported = isPushSupported();
      setPushSupported(supported);
      if (supported) {
        const activeSub = await getCurrentPushSubscription();
        setPushEnabled(Boolean(activeSub));
      }
    };
    loadProfile();
  }, []);

  const handleTogglePush = async () => {
    setTogglingPush(true);
    setToast(null);

    if (pushEnabled) {
      const res = await unsubscribeFromPushNotifications();
      setTogglingPush(false);
      if (res.success) {
        setPushEnabled(false);
        setToast({ type: 'success', text: 'Web push notifications disabled for this device.' });
      } else {
        setToast({ type: 'error', text: res.error || 'Failed to unsubscribe from push notifications.' });
      }
    } else {
      const res = await subscribeToPushNotifications();
      setTogglingPush(false);
      if (res.success) {
        setPushEnabled(true);
        setToast({ type: 'success', text: '✓ Web push notifications enabled successfully on this device!' });
      } else {
        setToast({ type: 'error', text: res.error || 'Could not enable push notifications.' });
      }
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!name || name.trim().length < 2 || name.trim().length > 100) {
      setToast({ type: 'error', text: 'Name must be between 2 and 100 characters long.' });
      return;
    }

    setSaving(true);
    setToast(null);

    const res = await updateMyProfileApi({
      name: name.trim(),
      phone: phone ? phone.trim() : ''
    });

    setSaving(false);

    if (res.success && res.data) {
      setToast({ type: 'success', text: 'Profile details updated successfully!' });
      setStoredUser(res.data);
      if (onUpdateUser) onUpdateUser(res.data);
    } else {
      setToast({ type: 'error', text: res.error || 'Failed to update profile.' });
    }
  };

  const handleTogglePref = (key) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    setToast(null);

    const res = await updateMyProfileApi({
      notificationPreferences: prefs
    });

    setSavingPrefs(false);

    if (res.success && res.data) {
      setToast({ type: 'success', text: 'Notification preferences saved!' });
      setStoredUser(res.data);
      if (onUpdateUser) onUpdateUser(res.data);
    } else {
      setToast({ type: 'error', text: res.error || 'Failed to save preferences.' });
    }
  };

  const getInitials = (n) => {
    if (!n) return 'C';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0][0].toUpperCase();
  };

  return (
    <div className="cpp-page">
      {/* Header */}
      <div className="cpp-header">
        <div className="cpp-header-inner">
          <div>
            <h1 className="cpp-header-title">⚙️ Citizen Profile & Preferences</h1>
            <p className="cpp-header-subtitle">
              Manage your personal information and civic notification preferences
            </p>
          </div>
          {onNavigateDashboard && (
            <button className="cd-btn cd-btn-outline" onClick={onNavigateDashboard}>
              ← Dashboard
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="cpp-body">
        {toast && (
          <div className={`cpp-toast ${toast.type === 'success' ? 'cpp-toast-success' : 'cpp-toast-error'}`}>
            {toast.type === 'success' ? '✓ ' : '⚠️ '}
            {toast.text}
          </div>
        )}

        {/* Profile Card */}
        <div className="cpp-card">
          <div className="cpp-profile-header">
            <div className="cpp-avatar">{getInitials(name)}</div>
            <div>
              <div className="cpp-profile-name">{name || 'Citizen User'}</div>
              <div className="cpp-profile-email">{email}</div>
              <span className="cpp-role-tag">{role}</span>
            </div>
          </div>

          <form onSubmit={handleSaveProfile}>
            <div className="cpp-form-group">
              <label className="cpp-label">Full Name</label>
              <input
                type="text"
                className="cpp-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>

            <div className="cpp-form-group">
              <label className="cpp-label">Email Address (Registered)</label>
              <input
                type="email"
                className="cpp-input"
                value={email}
                disabled
              />
              <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                Email is tied to your municipal identity and cannot be altered directly.
              </span>
            </div>

            <div className="cpp-form-group">
              <label className="cpp-label">Phone Contact (Optional)</label>
              <input
                type="tel"
                className="cpp-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g., +91 98765 43210"
              />
            </div>

            <button
              type="submit"
              className="cd-btn cd-btn-primary"
              disabled={saving}
              style={{ marginTop: '0.5rem' }}
            >
              {saving ? 'Saving Changes…' : 'Save Profile Changes'}
            </button>
          </form>
        </div>

        {/* Notification Preferences Card */}
        <div className="cpp-card">
          <div className="cpp-card-title">🔔 Citizen Alert Preferences</div>

          {pushSupported && (
            <div className="cpp-toggle-item" style={{ background: '#f0fdf4', padding: '0.9rem', borderRadius: '8px', marginBottom: '0.75rem', border: '1px solid #bbf7d0' }}>
              <div className="cpp-toggle-info">
                <span className="cpp-toggle-title">📲 Browser Push Notifications</span>
                <span className="cpp-toggle-desc">
                  Receive instant alerts on your desktop or mobile screen when officers submit resolution evidence
                </span>
              </div>
              <label className="cpp-switch">
                <input
                  type="checkbox"
                  checked={pushEnabled}
                  disabled={togglingPush}
                  onChange={handleTogglePush}
                />
                <span className="cpp-slider" />
              </label>
            </div>
          )}

          <div className="cpp-toggle-item">
            <div className="cpp-toggle-info">
              <span className="cpp-toggle-title">Email Notifications</span>
              <span className="cpp-toggle-desc">
                Receive important case updates and formal notices directly in your inbox
              </span>
            </div>
            <label className="cpp-switch">
              <input
                type="checkbox"
                checked={prefs.emailNotifications}
                onChange={() => handleTogglePref('emailNotifications')}
              />
              <span className="cpp-slider" />
            </label>
          </div>

          <div className="cpp-toggle-item">
            <div className="cpp-toggle-info">
              <span className="cpp-toggle-title">Status Progression Updates</span>
              <span className="cpp-toggle-desc">
                Alerts when your report moves from Pending to Assigned, In Progress or Resolved
              </span>
            </div>
            <label className="cpp-switch">
              <input
                type="checkbox"
                checked={prefs.complaintStatus}
                onChange={() => handleTogglePref('complaintStatus')}
              />
              <span className="cpp-slider" />
            </label>
          </div>

          <div className="cpp-toggle-item">
            <div className="cpp-toggle-info">
              <span className="cpp-toggle-title">Resolution Verification Alerts</span>
              <span className="cpp-toggle-desc">
                Immediate notification when a field officer submits repair evidence for your sign-off
              </span>
            </div>
            <label className="cpp-switch">
              <input
                type="checkbox"
                checked={prefs.resolutionAlerts}
                onChange={() => handleTogglePref('resolutionAlerts')}
              />
              <span className="cpp-slider" />
            </label>
          </div>

          <div className="cpp-toggle-item">
            <div className="cpp-toggle-info">
              <span className="cpp-toggle-title">SLA Timeliness Reminders</span>
              <span className="cpp-toggle-desc">
                Updates regarding estimated resolution timelines and deadline compliance
              </span>
            </div>
            <label className="cpp-switch">
              <input
                type="checkbox"
                checked={prefs.slaReminders}
                onChange={() => handleTogglePref('slaReminders')}
              />
              <span className="cpp-slider" />
            </label>
          </div>

          <div className="cpp-toggle-item">
            <div className="cpp-toggle-info">
              <span className="cpp-toggle-title">Feedback & Satisfaction Surveys</span>
              <span className="cpp-toggle-desc">
                Invitation to rate municipal response after verified issue completion
              </span>
            </div>
            <label className="cpp-switch">
              <input
                type="checkbox"
                checked={prefs.feedbackReminders}
                onChange={() => handleTogglePref('feedbackReminders')}
              />
              <span className="cpp-slider" />
            </label>
          </div>

          <button
            type="button"
            className="cd-btn cd-btn-primary"
            onClick={handleSavePreferences}
            disabled={savingPrefs}
            style={{ marginTop: '1.25rem' }}
          >
            {savingPrefs ? 'Updating Preferences…' : 'Save Notification Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CitizenProfilePage;
