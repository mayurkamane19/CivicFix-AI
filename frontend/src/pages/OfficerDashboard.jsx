import React, { useState, useEffect, useCallback } from 'react';
import OfficerComplaintMap from '../components/map/OfficerComplaintMap';
import {
  getOfficerStatsApi,
  getOfficerComplaintsApi,
  getOfficerComplaintDetailsApi,
  updateOfficerComplaintStatusApi,
  getOfficerAnalyticsOverviewApi
} from '../services/api';

/**
 * OfficerDashboard Component
 * Dedicated workspace for municipal field officers to view assigned civic hazards,
 * inspect incident details and citizen coordinates, and update resolution progress.
 */
export const OfficerDashboard = ({ currentUser, onNavigateHome, onNavigateLogin }) => {
  const isOfficer = currentUser && currentUser.role === 'officer';

  // Stats State
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Complaints State
  const [complaints, setComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false
  });

  // Filter States
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map' | 'analytics'

  // Officer Analytics State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState('30d');

  // Detail / Status Modal State
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('In Progress');
  const [progressNote, setProgressNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState(null);

  // Feedback State
  const [feedback, setFeedback] = useState(null);

  // 1. Fetch Officer Dashboard Stats
  const fetchStats = useCallback(async () => {
    if (!isOfficer) return;
    setStatsLoading(true);
    const res = await getOfficerStatsApi();
    setStatsLoading(false);

    if (res.success && res.data) {
      setStats(res.data);
    }
  }, [isOfficer]);

  // 2. Fetch Assigned Complaints
  const fetchComplaints = useCallback(async () => {
    if (!isOfficer) return;
    setComplaintsLoading(true);
    const res = await getOfficerComplaintsApi({
      status: statusFilter,
      search,
      page: currentPage,
      limit: 10
    });
    setComplaintsLoading(false);

    if (res.success) {
      setComplaints(res.data);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Failed to fetch assigned complaints'
      });
    }
  }, [isOfficer, statusFilter, search, currentPage]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // 3. Fetch Officer Analytics Overview
  const fetchOfficerAnalytics = useCallback(async () => {
    if (!isOfficer) return;
    setAnalyticsLoading(true);
    const res = await getOfficerAnalyticsOverviewApi({ range: analyticsRange });
    setAnalyticsLoading(false);

    if (res.success && res.data) {
      setAnalyticsData(res.data);
    }
  }, [isOfficer, analyticsRange]);

  useEffect(() => {
    if (viewMode === 'analytics') {
      fetchOfficerAnalytics();
    }
  }, [viewMode, fetchOfficerAnalytics]);

  // Open Details Modal
  const handleOpenDetails = async (complaintSummary) => {
    setSelectedComplaint(complaintSummary);
    setTargetStatus(complaintSummary.status === 'Resolved' ? 'Resolved' : 'In Progress');
    setProgressNote('');
    setStatusError(null);
    setDetailModalOpen(true);

    // Fetch full details
    const res = await getOfficerComplaintDetailsApi(complaintSummary.complaintId);
    if (res.success && res.data) {
      setSelectedComplaint(res.data);
    }
  };

  // Submit Status Update
  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    if (progressNote.length > 500) {
      setStatusError('Progress note cannot exceed 500 characters');
      return;
    }

    setUpdatingStatus(true);
    setStatusError(null);

    const res = await updateOfficerComplaintStatusApi(
      selectedComplaint.complaintId,
      targetStatus,
      progressNote.trim()
    );

    setUpdatingStatus(false);

    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Status for ${selectedComplaint.complaintId} updated to "${targetStatus}".`
      });
      setDetailModalOpen(false);
      setSelectedComplaint(null);
      fetchStats();
      fetchComplaints();
      setTimeout(() => setFeedback(null), 4000);
    } else {
      setStatusError(res.error || 'Failed to update complaint status');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return String(dateString);
    }
  };

  const getStatusBadge = (st) => {
    switch (st) {
      case 'Resolved':
        return <span className="status-badge badge-resolved">Resolved</span>;
      case 'In Progress':
        return <span className="status-badge badge-in-progress">In Progress</span>;
      default:
        return <span className="status-badge badge-pending">Pending</span>;
    }
  };

  // Access Denied Screen
  if (!isOfficer) {
    return (
      <div className="admin-access-denied-page">
        <div className="access-denied-card">
          <div className="denied-icon">👷</div>
          <h2>Field Officer Authentication Required</h2>
          <p>
            You must be signed in with a certified <strong>Municipal Field Officer</strong> account to access this work portal.
          </p>
          <div className="denied-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onNavigateLogin}
            >
              Sign In
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onNavigateHome}
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const officerInfo = stats?.officer || currentUser;
  const metrics = stats?.metrics || {
    totalAssigned: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0
  };

  return (
    <div className="officer-dashboard-page">
      {/* Officer Top Header */}
      <header className="officer-header">
        <div className="admin-header-container">
          <div className="admin-header-main">
            <div className="admin-brand-group">
              <span className="officer-badge-pill">FIELD DISPATCH WORKSPACE</span>
              <h1 className="admin-dashboard-title">
                Welcome, {officerInfo.name || 'Field Officer'}
              </h1>
              <p className="admin-dashboard-subtitle">
                Department: <strong>{officerInfo.department || 'Municipal Operations'}</strong>
                {officerInfo.departmentCode ? ` [${officerInfo.departmentCode}]` : ''} | Account: {officerInfo.email}
              </p>
            </div>

            <div className="admin-header-actions">
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => {
                  fetchStats();
                  fetchComplaints();
                }}
                disabled={statsLoading || complaintsLoading}
              >
                🔄 Refresh Tasks
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={onNavigateHome}
              >
                Public Home
              </button>
            </div>
          </div>

          {/* Feedback Banner */}
          {feedback && (
            <div className={`admin-feedback-banner feedback-${feedback.type}`}>
              <span>{feedback.type === 'success' ? '✓' : '⚠️'}</span>
              <span>{feedback.message}</span>
              <button
                type="button"
                className="banner-close-btn"
                onClick={() => setFeedback(null)}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="admin-main-container">
        {/* KPI Metric Cards */}
        <section className="stats-cards-grid" style={{ marginBottom: '1.5rem' }}>
          <div
            className={`stat-card ${statusFilter === 'all' ? 'stat-card-active' : ''}`}
            onClick={() => {
              setStatusFilter('all');
              setCurrentPage(1);
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="stat-card-header">
              <span className="stat-title">Total Assigned</span>
              <span className="stat-icon">📋</span>
            </div>
            <div className="stat-number">{metrics.totalAssigned}</div>
            <div className="stat-caption">All work orders assigned to you</div>
          </div>

          <div
            className={`stat-card ${statusFilter === 'Pending' ? 'stat-card-active' : ''}`}
            onClick={() => {
              setStatusFilter('Pending');
              setCurrentPage(1);
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="stat-card-header">
              <span className="stat-title">Pending Inspection</span>
              <span className="stat-icon">⏳</span>
            </div>
            <div className="stat-number" style={{ color: '#d97706' }}>
              {metrics.pending}
            </div>
            <div className="stat-caption">Awaiting initial inspection</div>
          </div>

          <div
            className={`stat-card ${statusFilter === 'In Progress' ? 'stat-card-active' : ''}`}
            onClick={() => {
              setStatusFilter('In Progress');
              setCurrentPage(1);
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="stat-card-header">
              <span className="stat-title">In Progress</span>
              <span className="stat-icon">⚙️</span>
            </div>
            <div className="stat-number" style={{ color: '#2563eb' }}>
              {metrics.inProgress}
            </div>
            <div className="stat-caption">Work underway on-site</div>
          </div>

          <div
            className={`stat-card ${statusFilter === 'Resolved' ? 'stat-card-active' : ''}`}
            onClick={() => {
              setStatusFilter('Resolved');
              setCurrentPage(1);
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="stat-card-header">
              <span className="stat-title">Resolved</span>
              <span className="stat-icon">✅</span>
            </div>
            <div className="stat-number" style={{ color: '#059669' }}>
              {metrics.resolved}
            </div>
            <div className="stat-caption">Successfully resolved issues</div>
          </div>
        </section>

        {/* Complaints List or GIS Map Section */}
        <section className="admin-complaints-section">
          {/* View Mode Toggle Switcher */}
          <div className="view-mode-toggle-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div className="admin-tabs-nav" style={{ margin: 0 }}>
              <button
                type="button"
                className={`admin-tab-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                📋 Task Registry ({pagination.total})
              </button>
              <button
                type="button"
                className={`admin-tab-btn ${viewMode === 'map' ? 'active' : ''}`}
                onClick={() => setViewMode('map')}
              >
                🗺️ GIS Workload Map
              </button>
              <button
                type="button"
                className={`admin-tab-btn ${viewMode === 'analytics' ? 'active' : ''}`}
                onClick={() => setViewMode('analytics')}
              >
                📈 My Turnaround Analytics
              </button>
            </div>
          </div>

          {viewMode === 'map' ? (
            <div className="officer-map-view-wrapper">
              <OfficerComplaintMap
                onSelectComplaint={(complaint) => {
                  handleOpenDetails(complaint);
                }}
              />
            </div>
          ) : viewMode === 'analytics' ? (
            <div className="officer-analytics-view-wrapper">
              <div className="analytics-card">
                <div className="analytics-card-header">
                  <div>
                    <h3 className="analytics-card-title">My Performance &amp; Turnaround Metrics</h3>
                    <span className="analytics-card-subtitle">
                      Personal resolution velocity strictly calculated for your assigned field work orders
                    </span>
                  </div>
                  <div className="btn-group-toggle">
                    <button
                      type="button"
                      className={`btn-toggle ${analyticsRange === '30d' ? 'active' : ''}`}
                      onClick={() => setAnalyticsRange('30d')}
                    >
                      Last 30 Days
                    </button>
                    <button
                      type="button"
                      className={`btn-toggle ${analyticsRange === '90d' ? 'active' : ''}`}
                      onClick={() => setAnalyticsRange('90d')}
                    >
                      Last 90 Days
                    </button>
                    <button
                      type="button"
                      className={`btn-toggle ${analyticsRange === 'all' ? 'active' : ''}`}
                      onClick={() => setAnalyticsRange('all')}
                    >
                      All Time
                    </button>
                  </div>
                </div>

                {analyticsLoading ? (
                  <div className="p-4 text-center text-muted">Calculating your assignment metrics...</div>
                ) : (
                  <>
                    <div className="resolution-mini-grid" style={{ marginBottom: '1.5rem' }}>
                      <div className="res-stat-card">
                        <span className="res-stat-label">Total Assigned</span>
                        <strong className="res-stat-val text-indigo">
                          {analyticsData?.metrics?.totalAssigned || 0}
                        </strong>
                        <span className="res-stat-sub">Assigned work orders</span>
                      </div>
                      <div className="res-stat-card">
                        <span className="res-stat-label">Resolution Rate</span>
                        <strong className="res-stat-val text-emerald">
                          {analyticsData?.metrics?.resolutionRate ?? 0}%
                        </strong>
                        <span className="res-stat-sub">Completed resolution percentage</span>
                      </div>
                      <div className="res-stat-card">
                        <span className="res-stat-label">Avg Turnaround</span>
                        <strong className="res-stat-val text-blue">
                          {analyticsData?.metrics?.formattedAvgResolutionTime || '0 hrs'}
                        </strong>
                        <span className="res-stat-sub">From creation to verified fix</span>
                      </div>
                      <div className="res-stat-card">
                        <span className="res-stat-label">Median Turnaround</span>
                        <strong className="res-stat-val text-amber">
                          {analyticsData?.metrics?.medianResolutionHours > 0
                            ? `${analyticsData.metrics.medianResolutionHours} hrs`
                            : '0 hrs'}
                        </strong>
                        <span className="res-stat-sub">Typical ticket turnaround</span>
                      </div>
                    </div>

                    <div className="res-sub-panel">
                      <h4 className="res-subheading">Assigned Categories Distribution</h4>
                      <div className="res-rank-list">
                        {!analyticsData?.assignedCategories || analyticsData.assignedCategories.length === 0 ? (
                          <p className="text-muted text-center py-2">No assigned tickets in this period.</p>
                        ) : (
                          analyticsData.assignedCategories.map((c) => (
                            <div key={c.category} className="res-rank-row">
                              <span className="rank-name">{c.category}</span>
                              <span className="rank-badge">
                                {c.count} tickets ({c.percentage}%)
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Search & Filter Toolbar */}
              <div className="complaint-filters-card" style={{ marginBottom: '1rem' }}>
                <div className="filters-grid" style={{ gridTemplateColumns: '1fr 200px' }}>
                  <div className="filter-group search-group">
                    <label htmlFor="officer-search" className="filter-label">
                      Search Assigned Tasks
                    </label>
                    <input
                      id="officer-search"
                      type="text"
                      className="filter-input search-input"
                      placeholder="Search by ticket ID, title, or address..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setCurrentPage(1);
                      }}
                    />
                  </div>

                  <div className="filter-group">
                    <label htmlFor="officer-status-select" className="filter-label">
                      Status Filter
                    </label>
                    <select
                      id="officer-status-select"
                      className="filter-select"
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="all">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Assigned Work Table */}
              <div className="table-responsive-container">
                {complaintsLoading ? (
                  <div className="table-loading-state">
                    <div className="table-spinner" />
                    <p>Loading assigned work orders...</p>
                  </div>
                ) : complaints.length === 0 ? (
                  <div className="table-empty-state">
                    <div className="empty-icon">✅</div>
                    <h3 className="empty-title">No Assigned Complaints</h3>
                    <p className="empty-desc">
                      You have no pending complaints under the selected filter.
                    </p>
                  </div>
                ) : (
                  <table className="admin-complaints-table">
                    <thead>
                      <tr>
                        <th>Ticket ID</th>
                        <th>Issue Title</th>
                        <th>Category</th>
                        <th>Location / Address</th>
                        <th>Assigned Date</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {complaints.map((c) => (
                        <tr key={c.complaintId}>
                          <td className="cell-code">
                            <strong>{c.complaintId}</strong>
                          </td>
                          <td className="cell-title">
                            <span className="complaint-title-text">{c.title}</span>
                          </td>
                          <td>
                            <span className="category-tag">{c.category}</span>
                          </td>
                          <td className="cell-address">
                            <span title={c.address || c.location?.address}>
                              {c.address || c.location?.address || '—'}
                            </span>
                          </td>
                          <td className="cell-date">{formatDate(c.assignedAt || c.createdAt)}</td>
                          <td>{getStatusBadge(c.status)}</td>
                          <td className="cell-actions">
                            <button
                              type="button"
                              className="btn btn-primary btn-small"
                              onClick={() => handleOpenDetails(c)}
                            >
                              Inspect &amp; Update
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="table-pagination-bar">
                    <span className="pagination-info">
                      Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                    </span>
                    <div className="pagination-buttons">
                      <button
                        type="button"
                        className="btn-page"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={!pagination.hasPrevPage}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className="btn-page"
                        onClick={() => setCurrentPage((p) => p + 1)}
                        disabled={!pagination.hasNextPage}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </main>

      {/* Officer Detail & Status Update Modal */}
      {detailModalOpen && selectedComplaint && (
        <div className="modal-backdrop" onClick={() => setDetailModalOpen(false)}>
          <div
            className="modal-container details-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="officer-modal-title"
          >
            <div className="modal-header">
              <div>
                <span className="modal-kicker">FIELD WORK ORDER</span>
                <h2 id="officer-modal-title" className="modal-title">
                  {selectedComplaint.complaintId} – {selectedComplaint.title}
                </h2>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDetailModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body details-scroll-body">
              {statusError && <div className="alert alert-error">{statusError}</div>}

              {/* Status Update Form Card */}
              <div
                className="details-card"
                style={{
                  border: '2px solid var(--primary-300)',
                  backgroundColor: 'var(--primary-50)',
                  marginBottom: '1.25rem'
                }}
              >
                <h3 className="details-section-title" style={{ color: 'var(--primary-900)' }}>
                  🛠️ Field Progress &amp; Status Update
                </h3>

                {selectedComplaint.status === 'Resolved' ? (
                  <div className="alert alert-success" style={{ margin: 0 }}>
                    ✓ This issue has been officially marked as <strong>Resolved</strong>. Resolved complaints cannot be reverted back to pending.
                  </div>
                ) : (
                  <form onSubmit={handleStatusSubmit} className="officer-status-form">
                    <div className="form-group">
                      <label className="form-label" htmlFor="officer-target-status">
                        Update Status to:
                      </label>
                      <select
                        id="officer-target-status"
                        className="form-select"
                        value={targetStatus}
                        onChange={(e) => setTargetStatus(e.target.value)}
                        required
                      >
                        <option value="In Progress">In Progress (Work Underway / Inspected)</option>
                        <option value="Resolved">Resolved (Hazard Cleared &amp; Completed)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <div className="label-with-counter">
                        <label className="form-label" htmlFor="officer-note">
                          Progress Note / Inspection Findings
                        </label>
                        <span className="char-counter">{progressNote.length} / 500</span>
                      </div>
                      <textarea
                        id="officer-note"
                        className="form-textarea"
                        rows={3}
                        placeholder="e.g. Inspected site, cleared drainage obstruction, road asphalt patched..."
                        value={progressNote}
                        onChange={(e) => setProgressNote(e.target.value)}
                        maxLength={500}
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={updatingStatus}
                      style={{ width: '100%' }}
                    >
                      {updatingStatus ? 'Updating Status...' : `Save & Mark as "${targetStatus}"`}
                    </button>
                  </form>
                )}
              </div>

              {/* Incident Details Card */}
              <div className="details-card">
                <h3 className="details-section-title">Incident Details</h3>

                <div className="detail-item">
                  <span className="detail-label">Citizen Description</span>
                  <p className="detail-description-text">{selectedComplaint.description}</p>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Location / Address</span>
                  <p className="detail-value">
                    {selectedComplaint.address || selectedComplaint.location?.address || 'No address provided'}
                  </p>
                  {selectedComplaint.latitude !== null && (
                    <div className="coords-tag">
                      📍 Lat: {selectedComplaint.latitude}, Lng: {selectedComplaint.longitude}
                    </div>
                  )}
                </div>

                <div className="detail-item">
                  <span className="detail-label">Category</span>
                  <span className="category-pill-large">{selectedComplaint.category}</span>
                </div>

                {selectedComplaint.aiAnalysis?.suggestedAction && (
                  <div className="detail-item">
                    <span className="detail-label">AI Recommended Action</span>
                    <p className="detail-value" style={{ fontStyle: 'italic', color: 'var(--slate-700)' }}>
                      💡 {selectedComplaint.aiAnalysis.suggestedAction}
                    </p>
                  </div>
                )}
              </div>

              {/* Photo Evidence */}
              {selectedComplaint.imageUrl && (
                <div className="details-card">
                  <h3 className="details-section-title">Photo Evidence</h3>
                  <div className="evidence-image-container">
                    <img
                      src={selectedComplaint.imageUrl}
                      alt="Incident evidence"
                      className="evidence-img"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDetailModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficerDashboard;
