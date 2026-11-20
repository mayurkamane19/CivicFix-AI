import React, { useState, useEffect, useCallback } from 'react';
import {
  getAdminFeedbackApi,
  getAdminFeedbackStatsApi
} from '../../services/api';

const RATING_LABELS = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent'
};

export const FeedbackManagement = () => {
  // Stats state
  const [stats, setStats] = useState({
    totalFeedback: 0,
    averageRating: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  // Feedback records & filters state
  const [feedbacks, setFeedbacks] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState(null);

  const [ratingFilter, setRatingFilter] = useState('all');
  const [searchId, setSearchId] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(10);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false
  });

  // Fetch High-Level Feedback Stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await getAdminFeedbackStatsApi();
      if (res.success && res.data) {
        setStats({
          totalFeedback: res.data.totalFeedback ?? 0,
          averageRating: res.data.averageRating ?? 0,
          ratingDistribution: res.data.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        });
      } else {
        setStatsError(res.error || 'Failed to load feedback statistics');
      }
    } catch (err) {
      setStatsError(err.message || 'Error loading feedback statistics');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Paginated Feedback Records
  const fetchFeedbacks = useCallback(async () => {
    setRecordsLoading(true);
    setRecordsError(null);
    try {
      const res = await getAdminFeedbackApi({
        page: currentPage,
        limit: pageLimit,
        rating: ratingFilter,
        search: activeSearch
      });

      if (res.success) {
        setFeedbacks(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        setRecordsError(res.error || 'Failed to load feedback records');
      }
    } catch (err) {
      setRecordsError(err.message || 'Error loading feedback records');
    } finally {
      setRecordsLoading(false);
    }
  }, [currentPage, pageLimit, ratingFilter, activeSearch]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  // Handle Search Submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setActiveSearch(searchId.trim());
    setCurrentPage(1);
  };

  // Reset All Filters
  const handleResetFilters = () => {
    setSearchId('');
    setActiveSearch('');
    setRatingFilter('all');
    setCurrentPage(1);
  };

  // Format Date Helper
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Render Stars Helper
  const renderStars = (rating) => {
    return (
      <div className="admin-stars-row" aria-label={`${rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`admin-star-icon ${star <= rating ? 'star-gold' : 'star-muted'}`}
          >
            ★
          </span>
        ))}
        <span className="admin-star-label">{RATING_LABELS[rating] || `${rating}/5`}</span>
      </div>
    );
  };

  return (
    <div className="feedback-management-container" role="region" aria-label="Citizen Feedback Dashboard">
      {/* Header & Subtitle */}
      <div className="feedback-dashboard-header">
        <div>
          <h2 className="feedback-dashboard-title">Citizen Resolution Feedback</h2>
          <p className="feedback-dashboard-subtitle">
            Monitor verified citizen ratings and service quality reviews submitted for resolved municipal complaints.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-small"
          onClick={() => {
            fetchStats();
            fetchFeedbacks();
          }}
          disabled={statsLoading || recordsLoading}
          title="Refresh feedback metrics and registry"
        >
          🔄 Refresh Feedback
        </button>
      </div>

      {/* KPI Cards & Rating Distribution Grid */}
      <div className="feedback-kpi-grid">
        {/* KPI 1: Total Feedback */}
        <div className="admin-card feedback-kpi-card">
          <div className="feedback-kpi-icon-wrapper kpi-icon-blue">
            <span className="feedback-kpi-icon">📝</span>
          </div>
          <div className="feedback-kpi-content">
            <span className="feedback-kpi-label">Total Feedback Received</span>
            <span className="feedback-kpi-value">
              {statsLoading ? '...' : (stats.totalFeedback ?? 0).toLocaleString()}
            </span>
            <span className="feedback-kpi-hint">Across all resolved complaints</span>
          </div>
        </div>

        {/* KPI 2: Average Rating */}
        <div className="admin-card feedback-kpi-card">
          <div className="feedback-kpi-icon-wrapper kpi-icon-gold">
            <span className="feedback-kpi-icon">⭐</span>
          </div>
          <div className="feedback-kpi-content">
            <span className="feedback-kpi-label">Average Citizen Rating</span>
            <div className="feedback-avg-row">
              <span className="feedback-kpi-value">
                {statsLoading ? '...' : (stats.averageRating ? stats.averageRating.toFixed(1) : '0.0')}
              </span>
              <span className="feedback-out-of">/ 5.0</span>
            </div>
            <div className="feedback-kpi-stars">
              {[1, 2, 3, 4, 5].map((s) => (
                <span
                  key={s}
                  className={`admin-star-icon ${
                    s <= Math.round(stats.averageRating) ? 'star-gold' : 'star-muted'
                  }`}
                >
                  ★
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* KPI 3: Rating Distribution Breakdown */}
        <div className="admin-card feedback-distribution-card">
          <div className="feedback-dist-header">
            <span className="feedback-kpi-label">Rating Distribution</span>
            <span className="feedback-dist-subtitle">1 to 5 Stars</span>
          </div>
          <div className="feedback-dist-list">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = stats.ratingDistribution?.[stars] || 0;
              const total = stats.totalFeedback || 1;
              const pct = stats.totalFeedback > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <button
                  type="button"
                  key={stars}
                  className={`dist-row-btn ${ratingFilter === String(stars) ? 'dist-row-active' : ''}`}
                  onClick={() => {
                    setRatingFilter(ratingFilter === String(stars) ? 'all' : String(stars));
                    setCurrentPage(1);
                  }}
                  title={`Filter by ${stars} Stars (${count} records)`}
                >
                  <span className="dist-stars-label">{stars} ★</span>
                  <div className="dist-progress-track">
                    <div
                      className={`dist-progress-bar bar-${stars}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="dist-count-label">
                    {count} ({pct}%)
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {statsError && (
        <div className="alert-box alert-error" style={{ marginBottom: '1.25rem' }}>
          <span>⚠️ {statsError}</span>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="admin-card feedback-filters-card">
        <form onSubmit={handleSearchSubmit} className="feedback-filters-form">
          {/* Complaint ID Search */}
          <div className="feedback-search-group">
            <label htmlFor="search-complaint-id" className="filter-field-label">
              Search by Complaint ID
            </label>
            <div className="search-input-wrapper">
              <input
                id="search-complaint-id"
                type="text"
                className="filter-input"
                placeholder="e.g. CFX-20261119-7001..."
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary btn-small">
                Search
              </button>
            </div>
          </div>

          {/* Rating Filter Dropdown */}
          <div className="feedback-filter-group">
            <label htmlFor="filter-rating-select" className="filter-field-label">
              Rating Filter
            </label>
            <select
              id="filter-rating-select"
              className="filter-select"
              value={ratingFilter}
              onChange={(e) => {
                setRatingFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Ratings (1 - 5 Stars)</option>
              <option value="5">5 Stars (Excellent)</option>
              <option value="4">4 Stars (Very Good)</option>
              <option value="3">3 Stars (Good)</option>
              <option value="2">2 Stars (Fair)</option>
              <option value="1">1 Star (Poor)</option>
            </select>
          </div>

          {/* Page Limit Selector */}
          <div className="feedback-filter-group">
            <label htmlFor="filter-limit-select" className="filter-field-label">
              Rows Per Page
            </label>
            <select
              id="filter-limit-select"
              className="filter-select"
              value={pageLimit}
              onChange={(e) => {
                setPageLimit(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={10}>10 rows</option>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="feedback-filter-actions">
            <button
              type="button"
              className="btn btn-outline btn-small"
              onClick={handleResetFilters}
            >
              Reset Filters
            </button>
          </div>
        </form>
      </div>

      {/* Error Banner */}
      {recordsError && (
        <div className="alert-box alert-error" style={{ marginBottom: '1.25rem' }}>
          <span>⚠️ {recordsError}</span>
        </div>
      )}

      {/* Feedback Records Table */}
      <div className="admin-card feedback-table-card">
        <div className="feedback-table-header-row">
          <h3 className="feedback-table-title">
            Feedback Records ({pagination.total})
          </h3>
          {activeSearch && (
            <span className="search-active-pill">
              Filtered by ID: <strong>{activeSearch}</strong>
            </span>
          )}
        </div>

        {recordsLoading ? (
          <div className="feedback-loading-state">
            <div className="spinner-indicator"></div>
            <span>Loading citizen feedback records...</span>
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="feedback-empty-state">
            <span className="empty-icon">⭐</span>
            <h4>No Citizen Feedback Found</h4>
            <p>
              {activeSearch || ratingFilter !== 'all'
                ? 'No feedback records match your selected search or rating filter. Try resetting your filters.'
                : 'No citizen feedback has been recorded yet. Citizen feedback will appear here as resolved complaints are rated.'}
            </p>
            {(activeSearch || ratingFilter !== 'all') && (
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={handleResetFilters}
                style={{ marginTop: '0.75rem' }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table feedback-table">
              <thead>
                <tr>
                  <th scope="col">Complaint ID</th>
                  <th scope="col">Issue Details</th>
                  <th scope="col">Rating</th>
                  <th scope="col">Citizen Comments</th>
                  <th scope="col">Submission Date</th>
                </tr>
              </thead>
              <tbody>
                {feedbacks.map((item) => (
                  <tr key={item.id || item.complaintId}>
                    {/* Complaint ID */}
                    <td className="cell-complaint-id">
                      <span className="complaint-id-tag">
                        {item.complaintId || 'N/A'}
                      </span>
                    </td>

                    {/* Issue Title & Category */}
                    <td className="cell-issue-details">
                      <div className="issue-title-text">
                        {item.complaintTitle || 'Resolved Municipal Complaint'}
                      </div>
                      {item.complaintCategory && (
                        <span className="category-tag-inline">
                          {item.complaintCategory}
                        </span>
                      )}
                    </td>

                    {/* Citizen Star Rating */}
                    <td className="cell-rating">
                      {renderStars(item.rating)}
                    </td>

                    {/* Citizen Comments */}
                    <td className="cell-comments">
                      {item.comment ? (
                        <p className="citizen-comment-quote">
                          "{item.comment}"
                        </p>
                      ) : (
                        <span className="comment-none">No written comment provided</span>
                      )}
                    </td>

                    {/* Submission Date */}
                    <td className="cell-date">
                      <span className="date-text">{formatDate(item.createdAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!recordsLoading && feedbacks.length > 0 && (
          <div className="feedback-pagination-bar">
            <div className="pagination-info">
              Showing{' '}
              <strong>
                {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}
              </strong>{' '}
              to{' '}
              <strong>
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </strong>{' '}
              of <strong>{pagination.total}</strong> records
            </div>

            <div className="pagination-controls">
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={!pagination.hasPrevPage}
              >
                ← Previous
              </button>

              <span className="page-indicator">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={!pagination.hasNextPage}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackManagement;
