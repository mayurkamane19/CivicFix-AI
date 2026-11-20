import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getUserNotificationsApi,
  getUnreadCountApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  deleteNotificationApi,
  clearReadNotificationsApi,
  getNotificationPreferencesApi,
  updateNotificationPreferencesApi
} from '../../services/api';

/**
 * Maps category to emoji badge and color class
 */
const getCategoryIcon = (category, priority) => {
  switch (category) {
    case 'sla_breach':
    case 'escalation':
      return { icon: '🚨', label: 'Escalation Alert', className: 'cat-escalation' };
    case 'sla_warning':
      return { icon: '⚠️', label: 'SLA Warning', className: 'cat-sla-warning' };
    case 'resolution':
      return { icon: '✅', label: 'Resolved', className: 'cat-resolution' };
    case 'reopened':
      return { icon: '🔄', label: 'Reopened', className: 'cat-reopened' };
    case 'status':
      return { icon: '📋', label: 'Status Update', className: 'cat-status' };
    case 'assignment':
      return { icon: '👷', label: 'Assignment', className: 'cat-assignment' };
    case 'submission':
      return { icon: '📝', label: 'Submission', className: 'cat-submission' };
    case 'feedback':
      return { icon: '⭐', label: 'Feedback', className: 'cat-feedback' };
    case 'announcement':
      return { icon: '📢', label: 'Announcement', className: 'cat-announcement' };
    default:
      return { icon: '🔔', label: 'Notification', className: 'cat-general' };
  }
};

/**
 * Formats ISO timestamp to human-friendly relative time
 */
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const NotificationCenter = ({
  currentUser,
  onNavigateTrack = null,
  onNavigateAdmin = null,
  onNavigateOfficer = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filter state
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread' | 'complaints' | 'sla' | 'system'
  const [searchQuery, setSearchQuery] = useState('');

  // Preferences modal state
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState(null);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState(null);

  const containerRef = useRef(null);
  const pollingRef = useRef(null);

  // 1. Fetch unread count for badge
  const fetchUnreadCount = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await getUnreadCountApi();
      if (res.success && typeof res.data?.unreadCount === 'number') {
        setUnreadCount(res.data.unreadCount);
      }
    } catch (_) {
      // Quiet fail during background polling
    }
  }, [currentUser]);

  // 2. Fetch notifications list
  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getUserNotificationsApi({
        page: 1,
        limit: 50,
        status: activeFilter === 'unread' ? 'unread' : 'all',
        category: 'all',
        search: searchQuery
      });

      if (res.success) {
        setNotifications(res.data || []);
        if (typeof res.unreadCount === 'number') {
          setUnreadCount(res.unreadCount);
        }
      } else {
        setError(res.error || 'Failed to load notifications');
      }
    } catch (err) {
      setError(err.message || 'Error fetching notifications');
    } finally {
      setLoading(false);
    }
  }, [currentUser, activeFilter, searchQuery]);

  // 3. Real-Time Adaptive Polling (Task 10: 30s interval with Page Visibility support)
  useEffect(() => {
    if (!currentUser) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }

    // Initial fetch
    fetchUnreadCount();

    const startPolling = () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchUnreadCount();
        }
      }, 30000); // 30-second polling
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, fetchUnreadCount]);

  // 4. Fetch notifications when dropdown opens or filter changes
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // 5. Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setShowPreferences(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // 6. Action Handlers
  const handleItemClick = async (notif) => {
    // Optimistically mark as read locally
    if (!notif.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await markNotificationReadApi(notif.id);
      } catch (_) {}
    }

    setIsOpen(false);

    // Deep navigation
    if (notif.complaintId && onNavigateTrack) {
      onNavigateTrack(notif.complaintId);
    } else if (notif.recipientRole === 'admin' && onNavigateAdmin) {
      onNavigateAdmin();
    } else if (notif.recipientRole === 'officer' && onNavigateOfficer) {
      onNavigateOfficer();
    } else if (notif.actionUrl) {
      if (notif.actionUrl.includes('track') && notif.complaintId && onNavigateTrack) {
        onNavigateTrack(notif.complaintId);
      } else if (notif.actionUrl.includes('admin') && onNavigateAdmin) {
        onNavigateAdmin();
      } else if (notif.actionUrl.includes('officer') && onNavigateOfficer) {
        onNavigateOfficer();
      }
    }
  };

  const handleMarkAsRead = async (e, notifId) => {
    e.stopPropagation();
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await markNotificationReadApi(notifId);
  };

  const handleDismiss = async (e, notifId) => {
    e.stopPropagation();
    const target = notifications.find((n) => n.id === notifId);
    if (target && !target.isRead) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    await deleteNotificationApi(notifId);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await markAllNotificationsReadApi();
  };

  const handleClearRead = async () => {
    setNotifications((prev) => prev.filter((n) => !n.isRead));
    await clearReadNotificationsApi();
  };

  // 7. Preferences Modal Handlers
  const handleOpenPreferences = async () => {
    setShowPreferences(true);
    setPrefsLoading(true);
    setPrefsMessage(null);
    try {
      const res = await getNotificationPreferencesApi();
      if (res.success && res.data) {
        setPreferences(res.data.notificationPreferences || {});
      }
    } catch (err) {
      setPrefsMessage({ type: 'error', text: err.message || 'Failed to load preferences' });
    } finally {
      setPrefsLoading(false);
    }
  };

  const handleTogglePref = (key) => {
    if (!preferences) return;
    // Admins cannot toggle criticalEscalations off
    if (currentUser?.role === 'admin' && key === 'criticalEscalations') return;
    // Officers cannot toggle newAssignments off
    if (currentUser?.role === 'officer' && key === 'newAssignments') return;

    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSavePreferences = async () => {
    if (!preferences) return;
    setPrefsSaving(true);
    setPrefsMessage(null);
    try {
      const res = await updateNotificationPreferencesApi({
        notificationPreferences: preferences
      });
      if (res.success) {
        setPrefsMessage({ type: 'success', text: 'Notification preferences saved successfully!' });
        setTimeout(() => setShowPreferences(false), 1200);
      } else {
        setPrefsMessage({ type: 'error', text: res.error || 'Failed to save preferences' });
      }
    } catch (err) {
      setPrefsMessage({ type: 'error', text: err.message || 'Error saving preferences' });
    } finally {
      setPrefsSaving(false);
    }
  };

  // 8. Client-side category filtering
  const filteredNotifications = notifications.filter((notif) => {
    if (activeFilter === 'unread') return !notif.isRead;
    if (activeFilter === 'complaints') {
      return ['submission', 'status', 'reopened', 'resolution'].includes(notif.category);
    }
    if (activeFilter === 'sla') {
      return ['sla_warning', 'sla_breach', 'escalation'].includes(notif.category);
    }
    if (activeFilter === 'system') {
      return ['announcement', 'feedback', 'assignment', 'general'].includes(notif.category);
    }
    return true;
  });

  if (!currentUser) return null;

  return (
    <div className="notification-center-container" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        className={`notification-bell-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={isOpen}
        title="Open Notification Center"
      >
        <svg
          className="notification-bell-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          width="20"
          height="20"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="notification-badge" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Center Dropdown Panel */}
      {isOpen && (
        <div className="notification-dropdown" role="region" aria-label="Notification Center Panel">
          {/* Header */}
          <div className="notification-dropdown-header">
            <div className="notification-header-title-row">
              <div className="notification-header-title">
                <span className="title-text">Notifications</span>
                {unreadCount > 0 && (
                  <span className="unread-counter-pill">{unreadCount} new</span>
                )}
              </div>
              <div className="notification-header-actions">
                <button
                  type="button"
                  className="icon-action-btn"
                  onClick={handleOpenPreferences}
                  title="Notification Preferences"
                  aria-label="Notification Preferences"
                >
                  ⚙️
                </button>
                <button
                  type="button"
                  className="icon-action-btn"
                  onClick={() => setIsOpen(false)}
                  title="Close Notifications"
                  aria-label="Close Notifications"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Quick Batch Controls */}
            <div className="notification-batch-bar">
              <button
                type="button"
                className="batch-text-btn"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
              >
                ✓ Mark all as read
              </button>
              <button
                type="button"
                className="batch-text-btn text-muted"
                onClick={handleClearRead}
                disabled={notifications.filter((n) => n.isRead).length === 0}
              >
                🗑️ Clear read
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="notification-filter-tabs">
              <button
                type="button"
                className={`filter-tab-pill ${activeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setActiveFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`filter-tab-pill ${activeFilter === 'unread' ? 'active' : ''}`}
                onClick={() => setActiveFilter('unread')}
              >
                Unread {unreadCount > 0 ? `(${unreadCount})` : ''}
              </button>
              <button
                type="button"
                className={`filter-tab-pill ${activeFilter === 'complaints' ? 'active' : ''}`}
                onClick={() => setActiveFilter('complaints')}
              >
                Complaints
              </button>
              <button
                type="button"
                className={`filter-tab-pill ${activeFilter === 'sla' ? 'active' : ''}`}
                onClick={() => setActiveFilter('sla')}
              >
                SLA Alerts
              </button>
              <button
                type="button"
                className={`filter-tab-pill ${activeFilter === 'system' ? 'active' : ''}`}
                onClick={() => setActiveFilter('system')}
              >
                System
              </button>
            </div>

            {/* Search Input */}
            <div className="notification-search-box">
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="notification-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Body: Notifications List */}
          <div className="notification-dropdown-body">
            {loading && (
              <div className="notification-loading-state">
                <span className="spinner-mini" />
                <p>Loading notifications...</p>
              </div>
            )}

            {!loading && error && (
              <div className="notification-error-state">
                <p>⚠️ {error}</p>
                <button
                  type="button"
                  className="btn btn-outline btn-small"
                  onClick={fetchNotifications}
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && filteredNotifications.length === 0 && (
              <div className="notification-empty-state">
                <div className="empty-bell-icon">🔔</div>
                <h4>All Caught Up!</h4>
                <p>
                  {activeFilter === 'unread'
                    ? 'No unread notifications right now.'
                    : 'You have no notifications in this view.'}
                </p>
              </div>
            )}

            {!loading && !error && filteredNotifications.length > 0 && (
              <ul className="notification-items-list">
                {filteredNotifications.map((notif) => {
                  const meta = getCategoryIcon(notif.category, notif.priority);
                  const isCritical = notif.priority === 'Critical';
                  const isHigh = notif.priority === 'High';

                  return (
                    <li
                      key={notif.id}
                      className={`notification-item ${!notif.isRead ? 'unread' : 'read'} ${
                        isCritical ? 'priority-critical' : isHigh ? 'priority-high' : ''
                      }`}
                      onClick={() => handleItemClick(notif)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleItemClick(notif);
                        }
                      }}
                    >
                      {/* Category Icon */}
                      <div className={`notification-cat-badge ${meta.className}`} title={meta.label}>
                        <span>{meta.icon}</span>
                      </div>

                      {/* Content Area */}
                      <div className="notification-item-content">
                        <div className="notification-item-top">
                          <h5 className="notification-title">{notif.title || notif.subject}</h5>
                          {!notif.isRead && <span className="unread-dot" title="Unread" />}
                        </div>
                        <p className="notification-message">{notif.message}</p>
                        <div className="notification-item-meta">
                          {notif.complaintId && (
                            <span className="complaint-chip">#{notif.complaintId}</span>
                          )}
                          <span className={`priority-chip priority-${(notif.priority || 'medium').toLowerCase()}`}>
                            {notif.priority || 'Medium'}
                          </span>
                          <span className="notification-timestamp">
                            {formatRelativeTime(notif.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Inline Actions */}
                      <div className="notification-item-actions">
                        {!notif.isRead && (
                          <button
                            type="button"
                            className="item-action-btn"
                            onClick={(e) => handleMarkAsRead(e, notif.id)}
                            title="Mark as Read"
                            aria-label="Mark as Read"
                          >
                            ✓
                          </button>
                        )}
                        <button
                          type="button"
                          className="item-action-btn dismiss-btn"
                          onClick={(e) => handleDismiss(e, notif.id)}
                          title="Dismiss notification"
                          aria-label="Dismiss notification"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="notification-dropdown-footer">
            <span className="footer-role-tag">
              Logged in as: <strong>{currentUser.role}</strong>
            </span>
            <button
              type="button"
              className="footer-link-btn"
              onClick={handleOpenPreferences}
            >
              Alert Settings
            </button>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {showPreferences && (
        <div className="notification-modal-overlay" onClick={() => setShowPreferences(false)}>
          <div
            className="notification-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pref-modal-title"
          >
            <div className="pref-modal-header">
              <h3 id="pref-modal-title">⚙️ Notification Preferences</h3>
              <button
                type="button"
                className="icon-action-btn"
                onClick={() => setShowPreferences(false)}
              >
                ✕
              </button>
            </div>

            <div className="pref-modal-body">
              {prefsLoading && (
                <div className="notification-loading-state">
                  <span className="spinner-mini" />
                  <p>Loading preferences...</p>
                </div>
              )}

              {prefsMessage && (
                <div className={`pref-alert-box alert-${prefsMessage.type}`}>
                  {prefsMessage.text}
                </div>
              )}

              {!prefsLoading && preferences && (
                <div className="pref-toggles-list">
                  <p className="pref-description">
                    Customize which in-app and email notifications you wish to receive.
                  </p>

                  {/* Complaint Updates */}
                  <div className="pref-toggle-item">
                    <div className="pref-info">
                      <strong>Complaint Status Updates</strong>
                      <p>Receive notifications when complaint status transitions.</p>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={Boolean(preferences.complaintStatus)}
                        onChange={() => handleTogglePref('complaintStatus')}
                      />
                      <span className="slider round" />
                    </label>
                  </div>

                  {/* SLA Warnings */}
                  <div className="pref-toggle-item">
                    <div className="pref-info">
                      <strong>SLA Deadline Warnings</strong>
                      <p>Alerts when complaint resolution deadlines are approaching.</p>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={Boolean(preferences.slaReminders)}
                        onChange={() => handleTogglePref('slaReminders')}
                      />
                      <span className="slider round" />
                    </label>
                  </div>

                  {/* Critical Escalations */}
                  <div className="pref-toggle-item">
                    <div className="pref-info">
                      <strong>Critical Escalation Alerts</strong>
                      <p>
                        High-priority alerts when tickets reach Level 2 or Level 3 breaches.
                        {currentUser?.role === 'admin' && (
                          <span className="badge-mandated">Mandatory for Administrators</span>
                        )}
                      </p>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={Boolean(preferences.criticalEscalations)}
                        disabled={currentUser?.role === 'admin'}
                        onChange={() => handleTogglePref('criticalEscalations')}
                      />
                      <span className="slider round" />
                    </label>
                  </div>

                  {/* New Assignments */}
                  <div className="pref-toggle-item">
                    <div className="pref-info">
                      <strong>New Task Assignments</strong>
                      <p>
                        Notifications when new issues are assigned to your department.
                        {currentUser?.role === 'officer' && (
                          <span className="badge-mandated">Mandatory for Field Officers</span>
                        )}
                      </p>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={Boolean(preferences.newAssignments)}
                        disabled={currentUser?.role === 'officer'}
                        onChange={() => handleTogglePref('newAssignments')}
                      />
                      <span className="slider round" />
                    </label>
                  </div>

                  {/* Citizen Feedback */}
                  <div className="pref-toggle-item">
                    <div className="pref-info">
                      <strong>Citizen Feedback Reviews</strong>
                      <p>Alerts when citizens rate and review resolved complaints.</p>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={Boolean(preferences.feedbackReminders)}
                        onChange={() => handleTogglePref('feedbackReminders')}
                      />
                      <span className="slider round" />
                    </label>
                  </div>

                  {/* System Announcements */}
                  <div className="pref-toggle-item">
                    <div className="pref-info">
                      <strong>System Broadcasts &amp; Announcements</strong>
                      <p>City-wide administrative advisories and system maintenance notices.</p>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={Boolean(preferences.systemAlerts)}
                        onChange={() => handleTogglePref('systemAlerts')}
                      />
                      <span className="slider round" />
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="pref-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPreferences(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSavePreferences}
                disabled={prefsSaving || prefsLoading}
              >
                {prefsSaving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
