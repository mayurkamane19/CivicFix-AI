import React from 'react';

/**
 * DashboardStatsCards Component
 * Displays key municipal complaint operational metrics with modern SaaS design
 */
export const DashboardStatsCards = ({ stats, loading, onSelectFilter }) => {
  const cards = [
    {
      id: 'total',
      label: 'Total Complaints',
      value: stats?.totalComplaints ?? 0,
      description: 'All recorded public tickets',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      colorClass: 'card-total',
      filterType: 'status',
      filterValue: 'all'
    },
    {
      id: 'pending',
      label: 'Pending Action',
      value: stats?.pendingComplaints ?? 0,
      description: 'Awaiting crew assignment',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      colorClass: 'card-pending',
      filterType: 'status',
      filterValue: 'Pending'
    },
    {
      id: 'in-progress',
      label: 'In Progress',
      value: stats?.inProgressComplaints ?? 0,
      description: 'Field teams deployed',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      ),
      colorClass: 'card-in-progress',
      filterType: 'status',
      filterValue: 'In Progress'
    },
    {
      id: 'resolved',
      label: 'Resolved Issues',
      value: stats?.resolvedComplaints ?? 0,
      description: 'Repairs completed & verified',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
      colorClass: 'card-resolved',
      filterType: 'status',
      filterValue: 'Resolved'
    },
    {
      id: 'critical',
      label: 'High & Critical AI Severity',
      value: stats?.highCriticalComplaints ?? 0,
      description: 'Requires urgent municipal attention',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      colorClass: 'card-critical',
      filterType: 'severity',
      filterValue: 'Critical'
    }
  ];

  return (
    <div className="admin-stats-grid">
      {cards.map((c) => (
        <div
          key={c.id}
          className={`admin-stat-card ${c.colorClass} ${onSelectFilter ? 'clickable-card' : ''}`}
          onClick={() => onSelectFilter && onSelectFilter(c.filterType, c.filterValue)}
          title={`Filter complaints by ${c.label}`}
        >
          <div className="stat-card-header">
            <span className="stat-card-label">{c.label}</span>
            <div className="stat-card-icon">{c.icon}</div>
          </div>
          <div className="stat-card-body">
            <div className="stat-card-number">
              {loading ? <span className="stat-loading-spinner" /> : c.value}
            </div>
            <div className="stat-card-desc">{c.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DashboardStatsCards;
