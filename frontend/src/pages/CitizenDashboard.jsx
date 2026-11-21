import React, { useState, useEffect, useCallback } from 'react';
import StatCard from '../components/citizen/StatCard';
import StatusBadge from '../components/citizen/StatusBadge';
import { getCitizenDashboardApi } from '../services/api';
import './CitizenDashboard.css';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
};

const todayLabel = () => {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

const STAT_DEFINITIONS = [
  {
    key: 'total',
    title: 'Total Filed',
    icon: '📋',
    color: '#3b82f6',
    statusFilter: null
  },
  {
    key: 'pending',
    title: 'Pending',
    icon: '⏳',
    color: '#f59e0b',
    statusFilter: 'Pending'
  },
  {
    key: 'inProgress',
    title: 'In Progress',
    icon: '🔧',
    color: '#0ea5e9',
    statusFilter: 'In Progress'
  },
  {
    key: 'awaitingVerification',
    title: 'Awaiting Verify',
    icon: '👁',
    color: '#f97316',
    statusFilter: 'Awaiting Verification'
  },
  {
    key: 'resolved',
    title: 'Resolved',
    icon: '✅',
    color: '#10b981',
    statusFilter: 'Resolved'
  },
  {
    key: 'reopened',
    title: 'Reopened',
    icon: '🔄',
    color: '#f43f5e',
    statusFilter: 'Reopened'
  }
];

/**
 * CitizenDashboard — citizen's personal overview dashboard
 */
const CitizenDashboard = ({
  currentUser,
  onNavigateReport,
  onNavigateMyComplaints,
  onNavigateHome
}) => {
  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getCitizenDashboardApi();
    setLoading(false);
    if (res.success) {
      setDashData(res.data);
    } else {
      setError(res.error || 'Failed to load dashboard');
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const stats = dashData
    ? {
        total: dashData.total ?? 0,
        pending: dashData.pending ?? 0,
        inProgress: dashData.inProgress ?? 0,
        awaitingVerification: dashData.awaitingVerification ?? 0,
        resolved: dashData.resolved ?? 0,
        reopened: dashData.reopened ?? 0
      }
    : {
        total: 0, pending: 0, inProgress: 0,
        awaitingVerification: 0, resolved: 0, reopened: 0
      };

  const recentActivity = dashData?.recentActivity ?? [];

  return (
    <div className="citizen-dashboard">
      {/* Header */}
      <div className="cd-header">
        <div className="cd-header-inner">
          <div>
            <div className="cd-welcome-label">Citizen Portal</div>
            <div className="cd-welcome-name">
              Welcome back, {currentUser?.name?.split(' ')[0] ?? 'Citizen'} 👋
            </div>
            <div className="cd-welcome-date">{todayLabel()}</div>
          </div>
          <div className="cd-header-actions">
            <button className="cd-btn cd-btn-primary" onClick={onNavigateReport}>
              ➕ Report New Issue
            </button>
            <button className="cd-btn cd-btn-outline" onClick={onNavigateMyComplaints}>
              📂 My Complaints
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="cd-body">
        {/* Stats Section */}
        <div className="cd-section">
          <div className="cd-section-title">📊 Your Complaint Overview</div>
          {loading ? (
            <div className="cd-loading">
              <span className="cd-spinner" /> Loading your dashboard…
            </div>
          ) : error ? (
            <div className="cd-error">
              <span>⚠️ {error}</span>
              <button className="cd-retry-btn" onClick={fetchDashboard}>Retry</button>
            </div>
          ) : (
            <div className="cd-stats-grid">
              {STAT_DEFINITIONS.map((def) => (
                <StatCard
                  key={def.key}
                  title={def.title}
                  count={stats[def.key]}
                  icon={def.icon}
                  accentColor={def.color}
                  onClick={def.statusFilter ? () => onNavigateMyComplaints?.(def.statusFilter) : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="cd-section">
          <div className="cd-section-title">🕐 Recent Activity</div>
          {loading ? (
            <div className="cd-loading">
              <span className="cd-spinner" /> Loading…
            </div>
          ) : error ? null : recentActivity.length === 0 ? (
            <div className="cd-empty">
              <div className="cd-empty-icon">🗂️</div>
              <div className="cd-empty-title">No complaints yet</div>
              <div className="cd-empty-desc">
                You haven't filed any complaints. Use "Report New Issue" to get started.
              </div>
            </div>
          ) : (
            <div className="cd-activity-list">
              {recentActivity.map((item) => (
                <div
                  key={item._id ?? item.complaintId}
                  className="cd-activity-item"
                  onClick={() => onNavigateMyComplaints?.()}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="cd-activity-left">
                    <span className="cd-activity-id">
                      {item.complaintId ?? item._id}
                    </span>
                    <span className="cd-activity-title">
                      {item.title ?? item.category ?? 'Complaint'}
                    </span>
                    <span className="cd-activity-time">
                      Updated {timeAgo(item.updatedAt)}
                    </span>
                  </div>
                  <div className="cd-activity-right">
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="cd-section">
          <div className="cd-section-title">⚡ Quick Actions</div>
          <div className="cd-quick-actions">
            <div className="cd-action-card" onClick={onNavigateReport}>
              <div className="cd-action-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                📝
              </div>
              <div className="cd-action-label">Report New Issue</div>
              <div className="cd-action-desc">File a civic complaint</div>
            </div>

            <div className="cd-action-card" onClick={() => onNavigateMyComplaints?.()}>
              <div className="cd-action-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                📂
              </div>
              <div className="cd-action-label">View All Complaints</div>
              <div className="cd-action-desc">Search, filter & track</div>
            </div>

            <div
              className="cd-action-card"
              onClick={() => onNavigateMyComplaints?.('Awaiting Verification')}
            >
              <div className="cd-action-icon" style={{ background: '#fff7ed', color: '#c2410c' }}>
                👁
              </div>
              <div className="cd-action-label">Pending Review</div>
              <div className="cd-action-desc">Complaints awaiting your verification</div>
            </div>

            <div className="cd-action-card" onClick={onNavigateHome}>
              <div className="cd-action-icon" style={{ background: '#f8fafc', color: '#64748b' }}>
                🏠
              </div>
              <div className="cd-action-label">Go to Home</div>
              <div className="cd-action-desc">Back to CivicFix homepage</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CitizenDashboard;
