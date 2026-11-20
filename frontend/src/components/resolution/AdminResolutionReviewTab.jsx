import React, { useState, useEffect, useCallback } from 'react';
import {
  getAdminResolutionsApi,
  getAdminResolutionStatsApi,
  reviewAdminResolutionApi,
  getAdminDepartmentsApi,
  getAdminOfficersApi
} from '../../services/api.js';

/**
 * AdminResolutionReviewTab
 * Management portal tab for municipal administrators to monitor submitted resolutions,
 * inspect before-and-after photographic evidence, and arbitrate citizen disputes or repeat rejections.
 */
export const AdminResolutionReviewTab = () => {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [resolutions, setResolutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [disputedOnly, setDisputedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });

  // Inspection & Review Modal State
  const [selectedResolution, setSelectedResolution] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState('APPROVE_RESOLUTION');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reassignDept, setReassignDept] = useState('');
  const [reassignOfficer, setReassignOfficer] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');

  // Reassignment Dropdown Data
  const [departments, setDepartments] = useState([]);
  const [officers, setOfficers] = useState([]);

  // 1. Fetch Stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    const res = await getAdminResolutionStatsApi();
    setStatsLoading(false);
    if (res.success && res.data) {
      setStats(res.data);
    }
  }, []);

  // 2. Fetch Resolutions
  const fetchResolutions = useCallback(async () => {
    setLoading(true);
    const res = await getAdminResolutionsApi({
      verificationStatus: statusFilter,
      disputedOnly: disputedOnly ? 'true' : 'false',
      search,
      page: currentPage,
      limit: 15
    });
    setLoading(false);
    if (res.success && res.data) {
      setResolutions(res.data.resolutions || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    }
  }, [statusFilter, disputedOnly, search, currentPage]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchResolutions();
  }, [fetchResolutions]);

  useEffect(() => {
    const loadSelectOptions = async () => {
      const [deptRes, offRes] = await Promise.all([
        getAdminDepartmentsApi(),
        getAdminOfficersApi()
      ]);
      if (deptRes.success) setDepartments(deptRes.data || []);
      if (offRes.success) setOfficers(offRes.data || []);
    };
    loadSelectOptions();
  }, []);

  const handleOpenReview = (item) => {
    setSelectedResolution(item);
    setReviewAction('APPROVE_RESOLUTION');
    setReviewNotes('');
    setReviewError('');
    setReviewSuccess('');
    setReviewModalOpen(true);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewNotes || reviewNotes.trim().length < 5) {
      setReviewError('Please provide review notes of at least 5 characters.');
      return;
    }

    setIsSubmittingReview(true);
    setReviewError('');
    setReviewSuccess('');

    try {
      const payload = {
        action: reviewAction,
        notes: reviewNotes.trim(),
        reassignedDepartment: reassignDept || undefined,
        reassignedOfficer: reassignOfficer || undefined
      };

      const res = await reviewAdminResolutionApi(
        selectedResolution.complaintId || selectedResolution._id,
        payload
      );

      if (res.success) {
        setReviewSuccess('Review decision processed successfully.');
        fetchStats();
        fetchResolutions();
        setTimeout(() => {
          setReviewModalOpen(false);
        }, 1200);
      } else {
        setReviewError(res.error || 'Failed to submit administrative review.');
      }
    } catch (err) {
      setReviewError(err.message || 'Error communicating with server.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const getVerificationBadge = (vStatus) => {
    switch (vStatus) {
      case 'Verified by Citizen':
        return <span className="status-badge badge-verified">✓ Verified</span>;
      case 'Awaiting Citizen Verification':
        return <span className="status-badge badge-awaiting">⏳ Awaiting Citizen</span>;
      case 'Rejected by Citizen':
        return <span className="status-badge badge-rejected">✗ Rejected & Reopened</span>;
      case 'Under Administrative Review':
        return <span className="status-badge badge-admin-review">⚠️ Under Admin Review</span>;
      default:
        return <span className="status-badge badge-secondary">{vStatus || 'Not Submitted'}</span>;
    }
  };

  const ev = selectedResolution?.resolutionEvidence || {};

  return (
    <div className="admin-resolution-review-container">
      {/* KPI Cards */}
      <div className="stats-cards-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-title">Resolutions Submitted</span>
            <span className="stat-icon">📷</span>
          </div>
          <div className="stat-number">{stats?.totalSubmitted || 0}</div>
          <div className="stat-caption">Total work completion proofs</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-title">Awaiting Citizen</span>
            <span className="stat-icon">⏳</span>
          </div>
          <div className="stat-number" style={{ color: '#d97706' }}>
            {stats?.awaitingVerification || 0}
          </div>
          <div className="stat-caption">Pending citizen sign-off</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-title">Verified by Citizens</span>
            <span className="stat-icon">✓</span>
          </div>
          <div className="stat-number" style={{ color: '#059669' }}>
            {stats?.verifiedByCitizen || 0} ({stats?.verificationRate || 0}%)
          </div>
          <div className="stat-caption">Satisfied resolutions</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-title">Disputed / Escalated</span>
            <span className="stat-icon">⚠️</span>
          </div>
          <div className="stat-number" style={{ color: '#dc2626' }}>
            {stats?.underAdminReview || stats?.disputedCount || 0}
          </div>
          <div className="stat-caption">Requires administrative review</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="complaint-filters-card" style={{ marginBottom: '1rem' }}>
        <div className="filters-grid" style={{ gridTemplateColumns: '1fr 220px auto' }}>
          <div className="filter-group">
            <label className="filter-label">Search Resolutions</label>
            <input
              type="text"
              className="filter-input search-input"
              placeholder="Search by ticket ID, title, or officer name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Verification Status</label>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Statuses</option>
              <option value="Awaiting Citizen Verification">Awaiting Citizen Verification</option>
              <option value="Verified by Citizen">Verified by Citizen</option>
              <option value="Rejected by Citizen">Rejected by Citizen</option>
              <option value="Under Administrative Review">Under Administrative Review</option>
            </select>
          </div>

          <div className="filter-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '1.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={disputedOnly}
                onChange={(e) => {
                  setDisputedOnly(e.target.checked);
                  setCurrentPage(1);
                }}
              />
              <strong>Disputed / Reopened Only</strong>
            </label>
          </div>
        </div>
      </div>

      {/* Resolutions Table */}
      <div className="table-responsive-container">
        {loading ? (
          <div className="table-loading-state">
            <div className="table-spinner" />
            <p>Loading resolution evidence records...</p>
          </div>
        ) : resolutions.length === 0 ? (
          <div className="table-empty-state">
            <div className="empty-icon">📷</div>
            <h3 className="empty-title">No Resolution Records</h3>
            <p className="empty-desc">No complaints match the specified verification filters.</p>
          </div>
        ) : (
          <table className="admin-complaints-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Title</th>
                <th>Department</th>
                <th>Assigned Officer</th>
                <th>Verification Status</th>
                <th>Reopens</th>
                <th>Admin Review</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {resolutions.map((c) => (
                <tr key={c.complaintId || c._id}>
                  <td className="cell-code">
                    <strong>{c.complaintId}</strong>
                  </td>
                  <td className="cell-title">
                    <span className="complaint-title-text">{c.title}</span>
                  </td>
                  <td>{c.assignedDepartment?.name || '—'}</td>
                  <td>{c.assignedOfficer?.name || c.resolutionEvidence?.submittedByName || '—'}</td>
                  <td>{getVerificationBadge(c.resolutionEvidence?.status)}</td>
                  <td>
                    {c.resolutionEvidence?.reopenCount > 0 ? (
                      <span className="badge-reopen-count">
                        {c.resolutionEvidence.reopenCount} / {c.resolutionEvidence.maxReopenLimit || 3}
                      </span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                  <td>
                    {c.resolutionEvidence?.adminReview?.status && c.resolutionEvidence.adminReview.status !== 'Not Required' ? (
                      <span className={`admin-review-status-pill pill-${c.resolutionEvidence.adminReview.status.toLowerCase()}`}>
                        {c.resolutionEvidence.adminReview.status}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="cell-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-small"
                      onClick={() => handleOpenReview(c)}
                    >
                      Inspect &amp; Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
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

      {/* Inspection & Arbitration Review Modal */}
      {reviewModalOpen && selectedResolution && (
        <div className="modal-overlay" onClick={() => setReviewModalOpen(false)}>
          <div className="modal-container admin-review-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-kicker">RESOLUTION INSPECTION &amp; ARBITRATION</span>
                <h3>
                  #{selectedResolution.complaintId} – {selectedResolution.title}
                </h3>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setReviewModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <div className="modal-body">
              {reviewSuccess && <div className="alert alert-success">{reviewSuccess}</div>}
              {reviewError && <div className="alert alert-danger">{reviewError}</div>}

              {/* Status Header */}
              <div className="review-meta-bar">
                <div>
                  <strong>Verification Status:</strong> {getVerificationBadge(ev.status)}
                </div>
                <div>
                  <strong>Reopen Count:</strong> {ev.reopenCount || 0} of {ev.maxReopenLimit || 3}
                </div>
                <div>
                  <strong>Officer:</strong> {ev.submittedByName || selectedResolution.assignedOfficer?.name || 'Assigned Officer'}
                </div>
              </div>

              {/* Officer Remarks */}
              {ev.remarks && (
                <div className="resolution-remarks-box">
                  <span className="remarks-label">Officer Resolution Remarks:</span>
                  <p className="remarks-text">{ev.remarks}</p>
                </div>
              )}

              {/* Before and After Photos */}
              <div className="photo-comparison-grid" style={{ marginBottom: '1.25rem' }}>
                <div className="comparison-column before-column">
                  <div className="column-label before-tag">BEFORE RESOLUTION</div>
                  {ev.beforeImages && ev.beforeImages.length > 0 ? (
                    ev.beforeImages.map((img, idx) => (
                      <div key={idx} className="evidence-photo-wrapper">
                        <img src={img.url} alt={`Before ${idx + 1}`} className="evidence-photo" />
                        {img.caption && <div className="photo-caption">{img.caption}</div>}
                      </div>
                    ))
                  ) : (
                    <div className="no-photo-placeholder"><p>No before photos.</p></div>
                  )}
                </div>

                <div className="comparison-column after-column">
                  <div className="column-label after-tag">AFTER RESOLUTION</div>
                  {ev.afterImages && ev.afterImages.length > 0 ? (
                    ev.afterImages.map((img, idx) => (
                      <div key={idx} className="evidence-photo-wrapper">
                        <img src={img.url} alt={`After ${idx + 1}`} className="evidence-photo" />
                        {img.caption && <div className="photo-caption">{img.caption}</div>}
                      </div>
                    ))
                  ) : (
                    <div className="no-photo-placeholder"><p>No completion photos attached.</p></div>
                  )}
                </div>
              </div>

              {/* Citizen Reopening Rebuttal History */}
              {ev.reopeningHistory && ev.reopeningHistory.length > 0 && (
                <div className="reopen-history-section" style={{ marginBottom: '1.25rem' }}>
                  <h5>Citizen Contest Reason(s):</h5>
                  {ev.reopeningHistory.map((item, idx) => (
                    <div key={idx} className="reopen-item">
                      <div className="reopen-meta">
                        Contested on {new Date(item.reopenedAt).toLocaleString()} by {item.reopenedByName || 'Citizen'}
                      </div>
                      <div className="reopen-reason">"{item.reason}"</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Administrative Arbitration Form */}
              <form onSubmit={handleSubmitReview} className="admin-arbitration-form">
                <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--slate-800)' }}>
                  Administrative Determination
                </h4>

                <div className="form-group">
                  <label htmlFor="arbitrationAction">Action to Take:</label>
                  <select
                    id="arbitrationAction"
                    className="form-control"
                    value={reviewAction}
                    onChange={(e) => setReviewAction(e.target.value)}
                  >
                    <option value="APPROVE_RESOLUTION">Approve Resolution (Citizen concerns addressed; mark Verified)</option>
                    <option value="REOPEN_COMPLAINT">Reopen Complaint (Evidence insufficient; require officer rework)</option>
                    <option value="OVERRIDE_RESOLUTION">Override Resolution (Administrative exception)</option>
                    <option value="REASSIGN">Reassign Complaint (Transfer to new department or officer)</option>
                  </select>
                </div>

                {reviewAction === 'REASSIGN' && (
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label>New Department:</label>
                      <select
                        className="form-control"
                        value={reassignDept}
                        onChange={(e) => setReassignDept(e.target.value)}
                      >
                        <option value="">Select Department...</option>
                        {departments.map((d) => (
                          <option key={d._id} value={d._id}>{d.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>New Field Officer:</label>
                      <select
                        className="form-control"
                        value={reassignOfficer}
                        onChange={(e) => setReassignOfficer(e.target.value)}
                      >
                        <option value="">Select Officer...</option>
                        {officers.map((o) => (
                          <option key={o._id} value={o._id}>{o.name} ({o.badgeNumber || 'Officer'})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="reviewNotes">
                    Administrative Notes / Decision Rationale <span className="required-star">*</span>
                  </label>
                  <textarea
                    id="reviewNotes"
                    className="form-control"
                    rows="3"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Enter reason for decision (minimum 5 characters)..."
                    required
                  ></textarea>
                </div>

                <div className="modal-footer" style={{ padding: '1rem 0 0 0' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setReviewModalOpen(false)}
                    disabled={isSubmittingReview}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmittingReview || reviewNotes.trim().length < 5}
                  >
                    {isSubmittingReview ? 'Processing...' : 'Apply Determination'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminResolutionReviewTab;
