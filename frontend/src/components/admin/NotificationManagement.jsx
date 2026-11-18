import React, { useState, useEffect, useCallback } from 'react';
import { getAdminNotificationsApi } from '../../services/api';

export default function NotificationManagement() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [searchComplaintId, setSearchComplaintId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 15,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false
  });

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminNotificationsApi({
        status: statusFilter,
        eventType: eventTypeFilter,
        complaintId: searchComplaintId,
        page: currentPage,
        limit: 15
      });

      if (res.success) {
        setNotifications(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        setError(res.error || 'Failed to load notification logs');
      }
    } catch (err) {
      setError(err.message || 'Error loading notification logs');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, eventTypeFilter, searchComplaintId, currentPage]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const getStatusBadge = (st) => {
    switch (st) {
      case 'Sent':
        return <span className="status-badge-mini badge-resolved">✓ Sent</span>;
      case 'Processing':
        return <span className="status-badge-mini badge-in-progress">⚙ Processing</span>;
      case 'Failed':
        return <span className="status-badge-mini" style={{ background: '#fee2e2', color: '#991b1b' }}>✗ Failed</span>;
      default:
        return <span className="status-badge-mini badge-pending">⏳ Pending</span>;
    }
  };

  const getEventBadge = (evt) => {
    switch (evt) {
      case 'COMPLAINT_SUBMISSION':
        return <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}>SUBMISSION</span>;
      case 'STATUS_UPDATE':
        return <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>STATUS UPDATE</span>;
      case 'DEPARTMENT_ASSIGNED':
        return <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#ede9fe', color: '#6d28d9', fontWeight: 600 }}>DEPT DISPATCH</span>;
      case 'OFFICER_ASSIGNED':
        return <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#e0e7ff', color: '#3730a3', fontWeight: 600 }}>OFFICER DISPATCH</span>;
      case 'COMPLAINT_RESOLVED':
        return <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#047857', fontWeight: 600 }}>RESOLVED</span>;
      default:
        return <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>{evt}</span>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '—';
    }
  };

  return (
    <div className="admin-departments-container">
      <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <div className="admin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 className="admin-card-title">Email Notification Outbox &amp; Delivery Auditing</h3>
            <span className="admin-card-subtitle">
              Monitor automated dispatch of citizen confirmations, departmental assignments, and resolution alerts.
            </span>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={fetchNotifications}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh Logs'}
          </button>
        </div>

        {/* Filters Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
              Delivery Status
            </label>
            <select
              className="filter-select full-width"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Delivery States</option>
              <option value="Sent">Sent Successfully</option>
              <option value="Pending">Pending in Outbox</option>
              <option value="Processing">Processing</option>
              <option value="Failed">Failed Delivery</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
              Notification Event
            </label>
            <select
              className="filter-select full-width"
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Events</option>
              <option value="COMPLAINT_SUBMISSION">Complaint Submission</option>
              <option value="STATUS_UPDATE">Status Update</option>
              <option value="DEPARTMENT_ASSIGNED">Department Assignment</option>
              <option value="OFFICER_ASSIGNED">Officer Assignment</option>
              <option value="COMPLAINT_RESOLVED">Complaint Resolved</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
              Complaint ID Search
            </label>
            <input
              type="text"
              className="filter-input search-input full-width"
              placeholder="e.g. CFX-202611..."
              value={searchComplaintId}
              onChange={(e) => {
                setSearchComplaintId(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="alert-box alert-error" style={{ marginBottom: '1rem' }}>
          <span>{error}</span>
        </div>
      )}

      {/* Notifications Table */}
      <div className="table-responsive-container">
        {loading ? (
          <div className="table-loading-state">
            <div className="table-spinner"></div>
            <p>Loading notification delivery logs...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="table-empty-state">
            <div className="empty-icon">📬</div>
            <h3 className="empty-title">No Notification Records Found</h3>
            <p className="empty-desc">
              No email notifications match the selected delivery status or event criteria.
            </p>
          </div>
        ) : (
          <table className="admin-complaints-table">
            <thead>
              <tr>
                <th>Event Type</th>
                <th>Ticket ID</th>
                <th>Recipient</th>
                <th>Role</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Sent / Created</th>
                <th>Retries</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id || n.idempotencyKey}>
                  <td>{getEventBadge(n.eventType)}</td>
                  <td className="cell-code">
                    <strong>{n.complaintId}</strong>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', color: '#1e293b' }}>{n.recipientEmail}</span>
                  </td>
                  <td>
                    <span style={{ textTransform: 'capitalize', fontSize: '12px', color: '#64748b' }}>
                      {n.recipientRole}
                    </span>
                  </td>
                  <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={n.subject}>
                    <span style={{ fontSize: '13px' }}>{n.subject}</span>
                    {n.lastError && (
                      <div style={{ color: '#b91c1c', fontSize: '11px', marginTop: '2px' }} title={n.lastError}>
                        Error: {n.lastError}
                      </div>
                    )}
                  </td>
                  <td>{getStatusBadge(n.deliveryStatus)}</td>
                  <td className="cell-date">
                    {formatDate(n.sentAt || n.createdAt)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', color: n.retryCount > 0 ? '#b45309' : '#64748b', fontWeight: n.retryCount > 0 ? 700 : 400 }}>
                      {n.retryCount} / {n.maxRetries}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination Bar */}
        {pagination && pagination.totalPages > 1 && (
          <div className="table-pagination-bar">
            <span className="pagination-info">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total notifications)
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
    </div>
  );
}
