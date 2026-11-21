import React from 'react';

/**
 * ComplaintManagementTable Component
 * Responsive, clean tabular view for municipal complaints administration
 */
export const ComplaintManagementTable = ({
  complaints,
  loading,
  pagination,
  onViewDetails,
  onOpenStatusModal,
  onOpenAssignModal,
  onOpenTransferModal,
  onPageChange,
  onLimitChange
}) => {
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

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'Critical':
        return <span className="severity-badge sev-critical">Critical</span>;
      case 'High':
        return <span className="severity-badge sev-high">High</span>;
      case 'Medium':
        return <span className="severity-badge sev-medium">Medium</span>;
      case 'Low':
        return <span className="severity-badge sev-low">Low</span>;
      default:
        return <span className="severity-badge sev-none">—</span>;
    }
  };

  const getCategoryClass = (cat) => {
    switch (cat) {
      case 'Road Damage':
        return 'cat-road';
      case 'Garbage':
        return 'cat-garbage';
      case 'Water Leakage':
        return 'cat-water';
      case 'Streetlight':
        return 'cat-light';
      case 'Drainage':
        return 'cat-drain';
      default:
        return 'cat-other';
    }
  };

  return (
    <div className="table-responsive-container">
      {loading ? (
        <div className="table-loading-state">
          <div className="table-spinner" />
          <p>Loading complaints registry...</p>
        </div>
      ) : complaints.length === 0 ? (
        <div className="table-empty-state">
          <div className="empty-icon">📋</div>
          <h3 className="empty-title">No Complaints Found</h3>
          <p className="empty-desc">
            No complaint records match your current search and filter criteria.
          </p>
        </div>
      ) : (
        <>
          <table className="admin-complaints-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Title</th>
                <th>Category</th>
                <th>Department</th>
                <th>Location</th>
                <th>Submitted</th>
                <th>AI Severity</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((c) => {
                const isDup = c.duplicateCheck?.isPotentialDuplicate;
                return (
                  <tr key={c.complaintId} className={isDup ? 'row-potential-duplicate' : ''}>
                    {/* Ticket ID */}
                    <td className="cell-code">
                      <div className="ticket-id-wrapper">
                        <button
                          type="button"
                          className="ticket-link-btn"
                          onClick={() => onViewDetails(c)}
                          title="View complaint details"
                        >
                          {c.complaintId}
                        </button>
                        {isDup && (
                          <span
                            className="duplicate-indicator-dot"
                            title="Potential duplicate ticket flagged"
                          >
                            ⚠️
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Title */}
                    <td className="cell-title">
                      <span className="complaint-title-text" title={c.title}>
                        {c.title}
                      </span>
                    </td>

                    {/* Category */}
                    <td>
                      <span className={`category-tag ${getCategoryClass(c.category)}`}>
                        {c.category}
                      </span>
                    </td>

                    {/* Department */}
                    <td>
                      <span className="badge badge-dept" style={{ fontSize: '0.75rem' }}>
                        {c.assignedDepartmentName || 'Unassigned'}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="cell-address">
                      <span title={c.address || c.location?.address}>
                        {c.address || c.location?.address || '—'}
                      </span>
                    </td>

                    {/* Submitted Date */}
                    <td className="cell-date">{formatDate(c.submissionDate || c.createdAt)}</td>

                    {/* AI Severity */}
                    <td>{getSeverityBadge(c.aiAnalysis?.severity)}</td>

                    {/* Status Badge */}
                    <td>{getStatusBadge(c.status)}</td>

                    {/* Action Buttons */}
                    <td className="cell-actions">
                      <div className="action-button-group">
                        <button
                          type="button"
                          className="btn-action btn-action-view"
                          onClick={() => onViewDetails(c)}
                          title="View complete details"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          className="btn-action btn-action-assign"
                          onClick={() => onOpenAssignModal && onOpenAssignModal(c)}
                          title="Assign department or field officer"
                          style={{ backgroundColor: 'var(--slate-100)', color: 'var(--slate-700)' }}
                        >
                          Assign
                        </button>
                        {onOpenTransferModal && (
                          <button
                            type="button"
                            className="btn-action btn-action-transfer"
                            onClick={() => onOpenTransferModal(c)}
                            title="Transfer complaint to another municipal ward"
                            style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}
                          >
                            Transfer
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-action btn-action-status"
                          onClick={() => onOpenStatusModal(c)}
                          title="Update complaint status"
                        >
                          Status
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {pagination && (
            <div className="table-pagination-bar">
              <div className="pagination-info">
                Page <strong>{pagination.page}</strong> of{' '}
                <strong>{pagination.totalPages || 1}</strong> (
                {pagination.total} total tickets)
              </div>

              <div className="pagination-controls">
                <div className="page-size-selector">
                  <label htmlFor="page-size">Per page:</label>
                  <select
                    id="page-size"
                    value={pagination.limit}
                    onChange={(e) => onLimitChange(Number(e.target.value))}
                    className="page-select"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="pagination-nav-buttons">
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => onPageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrevPage}
                  >
                    ◀ Prev
                  </button>
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => onPageChange(pagination.page + 1)}
                    disabled={!pagination.hasNextPage}
                  >
                    Next ▶
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ComplaintManagementTable;
