import React, { useState, useEffect, useCallback, useRef } from 'react';
import StatusBadge from '../components/citizen/StatusBadge';
import LoadingSkeleton from '../components/citizen/LoadingSkeleton';
import { getMyCitizenComplaintsApi } from '../services/api';
import './MyComplaintsPage.css';

const CATEGORIES = [
  'Pothole',
  'Garbage',
  'Streetlight',
  'Water Supply',
  'Sewage',
  'Road Damage',
  'Public Property',
  'Other'
];

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'Pending', label: 'Pending' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Assigned', label: 'Assigned' },
  { value: 'Awaiting Verification', label: 'Awaiting Verification' },
  { value: 'Resolved', label: 'Resolved' },
  { value: 'Reopened', label: 'Reopened' },
  { value: 'Under Administrative Review', label: 'Under Review' }
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'updated', label: 'Recently Updated' }
];

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

/**
 * MyComplaintsPage — Citizen's full complaints management list view
 */
const MyComplaintsPage = ({
  initialStatus = '',
  onViewComplaint,
  onNavigateDashboard,
  onNavigateReport,
  onOpenDrafts,
  draftCount = 0
}) => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState(initialStatus || '');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 10 });

  // Debounce search input (350ms)
  const searchTimeoutRef = useRef(null);
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 350);
  };

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError(null);

    const res = await getMyCitizenComplaintsApi({
      search: debouncedSearch.trim(),
      status: status || undefined,
      category: category || undefined,
      sort,
      page,
      limit: 10
    });

    setLoading(false);

    if (res.success) {
      setComplaints(res.data || []);
      setPagination(res.pagination || { total: 0, page: 1, pages: 1, limit: 10 });
    } else {
      setError(res.error || 'Failed to load complaints');
    }
  }, [debouncedSearch, status, category, sort, page]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleClearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatus('');
    setCategory('');
    setSort('newest');
    setPage(1);
  };

  const hasActiveFilters = Boolean(search || status || category || sort !== 'newest');

  return (
    <div className="mcp-page">
      {/* Top Header */}
      <div className="mcp-header">
        <div className="mcp-header-inner">
          <div>
            <h1 className="mcp-header-title">📂 My Submitted Complaints</h1>
            <p className="mcp-header-subtitle">
              Manage and track all public issues you have reported
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            {draftCount > 0 && onOpenDrafts && (
              <button
                className="mcp-back-btn"
                style={{ background: '#fef3c7', borderColor: '#fcd34d', color: '#78350f' }}
                onClick={onOpenDrafts}
              >
                💾 Drafts ({draftCount})
              </button>
            )}
            {onNavigateDashboard && (
              <button className="mcp-back-btn" onClick={onNavigateDashboard}>
                ← Dashboard
              </button>
            )}
            {onNavigateReport && (
              <button
                className="mcp-back-btn"
                style={{ background: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.5)' }}
                onClick={onNavigateReport}
              >
                ➕ Report Issue
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="mcp-body">
        {/* Filter Toolbar */}
        <div className="mcp-filters">
          {/* Search box */}
          <div className="mcp-search-wrap">
            <span className="mcp-search-icon">🔍</span>
            <input
              type="text"
              className="mcp-search-input"
              placeholder="Search by ticket ID or keyword…"
              value={search}
              onChange={handleSearchChange}
            />
          </div>

          {/* Status filter */}
          <div className="mcp-filter-group">
            <label className="mcp-filter-label">Status</label>
            <select
              className="mcp-select"
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Category filter */}
          <div className="mcp-filter-group">
            <label className="mcp-filter-label">Category</label>
            <select
              className="mcp-select"
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Sort order */}
          <div className="mcp-filter-group">
            <label className="mcp-filter-label">Sort Order</label>
            <select
              className="mcp-select"
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button className="mcp-clear-btn" onClick={handleClearFilters}>
              ✕ Clear Filters
            </button>
          )}
        </div>

        {/* Results Bar */}
        <div className="mcp-results-bar">
          <span className="mcp-results-count">
            {loading
              ? 'Loading complaints…'
              : `Showing ${complaints.length} of ${pagination.total} complaints`}
          </span>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="mcp-cards-list">
            <LoadingSkeleton count={3} />
          </div>
        ) : error ? (
          <div className="mcp-error">
            <span>⚠️ {error}</span>
            <button className="mcp-retry-btn" onClick={fetchComplaints}>
              Retry
            </button>
          </div>
        ) : complaints.length === 0 ? (
          <div className="mcp-empty">
            <div className="mcp-empty-icon">📭</div>
            <h3 className="mcp-empty-title">
              {hasActiveFilters ? 'No matching complaints found' : 'No complaints filed yet'}
            </h3>
            <p className="mcp-empty-desc">
              {hasActiveFilters
                ? 'Try broadening your search term or clearing the active filters.'
                : 'You have not reported any civic issues yet. Click below to file your first report.'}
            </p>
            {hasActiveFilters ? (
              <button className="mcp-clear-btn" onClick={handleClearFilters} style={{ margin: '0 auto' }}>
                Clear Filters
              </button>
            ) : onNavigateReport ? (
              <button
                className="cd-btn cd-btn-primary"
                style={{ margin: '0 auto', padding: '0.6rem 1.4rem' }}
                onClick={onNavigateReport}
              >
                ➕ Report an Issue
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mcp-cards-list">
            {complaints.map((c) => {
              const displayStatus =
                c.resolutionEvidence?.status === 'Submitted by Officer'
                  ? 'Awaiting Verification'
                  : c.status;

              return (
                <div key={c._id || c.complaintId} className="mcp-card">
                  <div className="mcp-card-header">
                    <div className="mcp-card-id-row">
                      <span className="mcp-card-id">{c.complaintId || c._id}</span>
                      <span className="mcp-card-category">📁 {c.category || 'General'}</span>
                    </div>
                    <StatusBadge status={displayStatus} size="sm" />
                  </div>

                  <h3 className="mcp-card-title">{c.title || 'Untitled Complaint'}</h3>

                  <p className="mcp-card-desc">
                    {c.description
                      ? c.description.length > 150
                        ? `${c.description.slice(0, 150)}…`
                        : c.description
                      : 'No description provided.'}
                  </p>

                  <div className="mcp-card-meta">
                    <span className="mcp-card-meta-item">
                      📍 {c.address || 'Location provided on map'}
                    </span>
                    <span className="mcp-card-meta-item">
                      📅 Filed: {formatDate(c.createdAt)}
                    </span>
                    <span className="mcp-card-meta-item">
                      🔄 Updated: {formatDate(c.updatedAt)}
                    </span>
                  </div>

                  <div className="mcp-card-footer">
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {c.resolutionEvidence?.status === 'Submitted by Officer' && (
                        <span style={{ color: '#c2410c', fontWeight: 600 }}>
                          ⚡ Resolution evidence ready for your review!
                        </span>
                      )}
                    </div>
                    {onViewComplaint && (
                      <button
                        className="mcp-view-btn"
                        onClick={() => onViewComplaint(c.complaintId || c._id)}
                      >
                        View Details →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && pagination.pages > 1 && (
          <div className="mcp-pagination">
            <button
              className="mcp-page-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Prev
            </button>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((pNum) => (
              <button
                key={pNum}
                className={`mcp-page-btn${pNum === page ? ' active' : ''}`}
                onClick={() => setPage(pNum)}
              >
                {pNum}
              </button>
            ))}
            <button
              className="mcp-page-btn"
              disabled={page >= pagination.pages}
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyComplaintsPage;
