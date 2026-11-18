import React from 'react';

/**
 * ComplaintMapPopup
 * Renders consistent, accessible complaint summary card inside Leaflet Popups.
 * Handles both public view (anonymized/approximate) and privileged views (admin/officer).
 */
export default function ComplaintMapPopup({
  complaint,
  isPublic = false,
  onViewDetails,
  onTrackIssue,
}) {
  if (!complaint) return null;

  const ticketId = complaint.complaintId || complaint._id?.slice(-8) || 'N/A';
  const category = complaint.category || 'General';
  const title = complaint.title || `${category} Issue`;
  const status = complaint.status || 'Pending';
  const severity = complaint.aiSeverity || complaint.severity || 'Normal';
  const address = complaint.address || complaint.location?.address || 'Location on map';
  const departmentName = complaint.departmentName || complaint.department?.name;
  const officerName = complaint.assignedOfficerName || complaint.assignedOfficer?.name;

  const getStatusBadgeClass = (st) => {
    switch (st?.toLowerCase()) {
      case 'resolved':
        return 'status-badge-resolved';
      case 'in progress':
      case 'in-progress':
        return 'status-badge-inprogress';
      default:
        return 'status-badge-pending';
    }
  };

  const getSeverityBadgeClass = (sev) => {
    switch (sev?.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'severity-badge-high';
      case 'medium':
        return 'severity-badge-medium';
      default:
        return 'severity-badge-low';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="map-popup-card">
      <div className="map-popup-header">
        <span className="map-popup-id">#{ticketId}</span>
        <span className={`map-popup-badge ${getStatusBadgeClass(status)}`}>
          {status}
        </span>
      </div>

      <h4 className="map-popup-title">{title}</h4>

      <div className="map-popup-meta">
        <div className="map-popup-row">
          <span className="meta-label">Category:</span>
          <span className="meta-val">{category}</span>
        </div>

        {severity && (
          <div className="map-popup-row">
            <span className="meta-label">Severity:</span>
            <span className={`map-popup-severity ${getSeverityBadgeClass(severity)}`}>
              {severity}
            </span>
          </div>
        )}

        <div className="map-popup-row">
          <span className="meta-label">Location:</span>
          <span className="meta-val address-text" title={address}>
            {address}
          </span>
        </div>

        {!isPublic && departmentName && (
          <div className="map-popup-row">
            <span className="meta-label">Department:</span>
            <span className="meta-val">{departmentName}</span>
          </div>
        )}

        {!isPublic && officerName && (
          <div className="map-popup-row">
            <span className="meta-label">Officer:</span>
            <span className="meta-val">{officerName}</span>
          </div>
        )}

        {complaint.createdAt && (
          <div className="map-popup-row">
            <span className="meta-label">Reported:</span>
            <span className="meta-val">{formatDate(complaint.createdAt)}</span>
          </div>
        )}

        {isPublic && (
          <div className="map-popup-privacy-notice">
            <small>Approx. location (~100m) for privacy</small>
          </div>
        )}
      </div>

      <div className="map-popup-actions">
        {!isPublic && onViewDetails && (
          <button
            type="button"
            className="map-popup-btn btn-primary"
            onClick={() => onViewDetails(complaint._id || complaint.id || complaint.complaintId)}
          >
            View Details
          </button>
        )}

        {isPublic && onTrackIssue && (
          <button
            type="button"
            className="map-popup-btn btn-outline"
            onClick={() => onTrackIssue(ticketId)}
          >
            Track This Issue &rarr;
          </button>
        )}
      </div>
    </div>
  );
}
