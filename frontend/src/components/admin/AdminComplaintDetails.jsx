import React, { useState } from 'react';

/**
 * AdminComplaintDetails Component
 * Modal display for in-depth inspection of a municipal complaint,
 * including visual evidence, AI analysis, duplicate checks, and complete audit history.
 */
export const AdminComplaintDetails = ({
  complaint,
  isOpen,
  onClose,
  onOpenStatusModal,
  onOpenAssignModal
}) => {
  if (!isOpen || !complaint) return null;

  const [imageModalOpen, setImageModalOpen] = useState(false);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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
        return <span className="severity-badge sev-none">Unclassified</span>;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container details-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="details-modal-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-kicker">MUNICIPAL COMPLAINT INSPECTION</span>
            <div className="details-header-row">
              <h2 id="details-modal-title" className="modal-title">
                {complaint.complaintId}
              </h2>
              <div className="details-badge-group">
                {getStatusBadge(complaint.status)}
                {getSeverityBadge(complaint.aiAnalysis?.severity)}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="modal-body details-scroll-body">
          {/* Quick Action Banner */}
          <div className="status-action-banner">
            <span className="action-banner-text">
              Status: <strong>{complaint.status}</strong> | Assigned: <strong>{complaint.assignedDepartmentName || 'Unassigned'}</strong>
              {complaint.assignedOfficerName ? ` (${complaint.assignedOfficerName})` : ''}
            </span>
            <div className="action-banner-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => onOpenAssignModal && onOpenAssignModal(complaint)}
              >
                👷 Assign Issue
              </button>
              <button
                type="button"
                className="btn btn-primary btn-small"
                onClick={() => onOpenStatusModal(complaint)}
              >
                ✎ Change Status
              </button>
            </div>
          </div>

          {/* Primary Details Grid */}
          <div className="details-grid-two-col">
            {/* Left Column: Complaint Core & Location */}
            <div className="details-card">
              <h3 className="details-section-title">Complaint Information</h3>

              <div className="detail-item">
                <span className="detail-label">Title</span>
                <p className="detail-value font-semibold">{complaint.title}</p>
              </div>

              <div className="detail-item">
                <span className="detail-label">Citizen Category</span>
                <span className="category-pill-large">{complaint.category}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Full Description</span>
                <p className="detail-description-text">{complaint.description}</p>
              </div>

              <div className="detail-item">
                <span className="detail-label">Location / Address</span>
                <p className="detail-value">{complaint.address || complaint.location?.address || 'No street address specified'}</p>
                {(complaint.latitude !== null && complaint.latitude !== undefined) && (
                  <div className="coords-tag">
                    📍 Lat: {complaint.latitude}, Lng: {complaint.longitude}
                  </div>
                )}
              </div>

              <div className="detail-item">
                <span className="detail-label">Assigned Department</span>
                <p className="detail-value">
                  {complaint.assignedDepartmentName ? (
                    <span className="badge badge-dept" style={{ fontSize: '0.85rem', padding: '0.2rem 0.5rem' }}>
                      🏢 {complaint.assignedDepartmentName}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--slate-400)', fontStyle: 'italic' }}>Unassigned</span>
                  )}
                </p>
              </div>

              <div className="detail-item">
                <span className="detail-label">Assigned Field Officer</span>
                <p className="detail-value">
                  {complaint.assignedOfficerName ? (
                    <span style={{ fontWeight: 600, color: 'var(--primary-700)' }}>
                      👷 {complaint.assignedOfficerName}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--slate-400)', fontStyle: 'italic' }}>No officer assigned</span>
                  )}
                </p>
              </div>

              <div className="detail-item">
                <span className="detail-label">Submission Date</span>
                <p className="detail-value">{formatDate(complaint.submissionDate || complaint.createdAt)}</p>
              </div>
            </div>

            {/* Right Column: Visual Evidence & Media */}
            <div className="details-card">
              <h3 className="details-section-title">Visual Evidence</h3>

              {complaint.imageUrl ? (
                <div className="evidence-image-container">
                  <img
                    src={complaint.imageUrl}
                    alt={`Evidence for ${complaint.complaintId}`}
                    className="evidence-img"
                    onClick={() => setImageModalOpen(true)}
                    title="Click to view full image"
                  />
                  <div className="image-caption">
                    <span>Uploaded citizen evidence</span>
                    <button
                      type="button"
                      className="view-full-btn"
                      onClick={() => setImageModalOpen(true)}
                    >
                      🔍 Full View
                    </button>
                  </div>
                </div>
              ) : (
                <div className="no-image-placeholder">
                  <div className="no-image-icon">📷</div>
                  <p>No visual media attached to this complaint</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Decision Support Panel */}
          <div className="details-card ai-advisory-panel">
            <div className="ai-panel-header">
              <div className="ai-panel-title">
                <span className="ai-sparkle">✨</span>
                <h3>Google Gemini AI Operational Analysis</h3>
              </div>
              <span className={`ai-status-pill status-${complaint.aiAnalysis?.status?.toLowerCase() || 'pending'}`}>
                {complaint.aiAnalysis?.status || 'Pending'}
              </span>
            </div>

            {complaint.aiAnalysis?.status === 'Completed' ? (
              <div className="ai-analysis-content">
                <div className="ai-grid">
                  <div className="ai-item">
                    <span className="ai-item-label">AI Category Suggestion</span>
                    <span className="ai-item-value category-pill">
                      {complaint.aiAnalysis.suggestedCategory || 'None'}
                    </span>
                  </div>

                  <div className="ai-item">
                    <span className="ai-item-label">Assessed Severity</span>
                    <div>{getSeverityBadge(complaint.aiAnalysis.severity)}</div>
                  </div>

                  <div className="ai-item">
                    <span className="ai-item-label">Recommended Department</span>
                    <span className="ai-dept-badge">
                      🏢 {complaint.aiAnalysis.recommendedDepartment || 'General Works'}
                    </span>
                  </div>
                </div>

                {complaint.aiAnalysis.summary && (
                  <div className="ai-summary-box">
                    <span className="ai-summary-label">Executive Incident Summary</span>
                    <p>{complaint.aiAnalysis.summary}</p>
                  </div>
                )}

                {complaint.aiAnalysis.suggestedAction && (
                  <div className="ai-action-box">
                    <span className="ai-action-label">Recommended Field Action</span>
                    <p>🛠️ {complaint.aiAnalysis.suggestedAction}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="ai-pending-text">
                AI analysis has not yet been processed for this complaint.
              </p>
            )}
          </div>

          {/* AI Image Analysis Panel (Mini Phase 15.3) */}
          {complaint.imageAnalysis && (
            <div className="details-card ai-advisory-panel image-ai-panel">
              <div className="ai-panel-header">
                <div className="ai-panel-title">
                  <span className="image-ai-icon">📷</span>
                  <h3>AI Image Analysis (Visual Assessment)</h3>
                </div>
                <span className={`ai-status-pill status-${complaint.imageAnalysis.status?.toLowerCase() || 'pending'}`}>
                  {complaint.imageAnalysis.status || 'Pending'}
                </span>
              </div>

              {complaint.imageAnalysis.status === 'Completed' ? (
                <div className="ai-analysis-content">
                  {complaint.imageAnalysis.isUnclearOrUnsuitable && (
                    <div className="ai-unsuitable-warning-box">
                      <span className="unsuitable-warning-icon">⚠️</span>
                      <div className="unsuitable-warning-text">
                        <strong>Unclear / Non-Civic Image Warning:</strong>{' '}
                        {complaint.imageAnalysis.unsuitableReason || 'The uploaded photo was flagged by AI as blurry, low visibility, or not depicting a municipal infrastructure hazard.'}
                      </div>
                    </div>
                  )}

                  <div className="ai-grid">
                    {complaint.imageAnalysis.possibleIssueType && (
                      <div className="ai-item">
                        <span className="ai-item-label">Detected Issue Type</span>
                        <span className="ai-item-value image-ai-issue-tag">
                          {complaint.imageAnalysis.possibleIssueType}
                        </span>
                      </div>
                    )}

                    {complaint.imageAnalysis.suggestedCategory && (
                      <div className="ai-item">
                        <span className="ai-item-label">AI Suggested Category</span>
                        <span className="ai-item-value category-pill">
                          {complaint.imageAnalysis.suggestedCategory}
                        </span>
                      </div>
                    )}

                    {complaint.imageAnalysis.suggestedSeverity && (
                      <div className="ai-item">
                        <span className="ai-item-label">Visual Severity</span>
                        <div>{getSeverityBadge(complaint.imageAnalysis.suggestedSeverity)}</div>
                      </div>
                    )}

                    {complaint.imageAnalysis.confidence && (
                      <div className="ai-item">
                        <span className="ai-item-label">Confidence Assessment</span>
                        <span className={`confidence-pill confidence-${complaint.imageAnalysis.confidence.toLowerCase()}`} style={{ alignSelf: 'flex-start' }}>
                          {complaint.imageAnalysis.confidence} Confidence
                        </span>
                      </div>
                    )}
                  </div>

                  {complaint.imageAnalysis.shortDescription && (
                    <div className="ai-summary-box" style={{ marginTop: '0.75rem' }}>
                      <span className="ai-summary-label">Visual Scene Description</span>
                      <p>{complaint.imageAnalysis.shortDescription}</p>
                    </div>
                  )}

                  <div className="ai-disclaimer-footnote" style={{ marginTop: '0.75rem' }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>
                      Automated AI suggestion: All visual findings are AI-generated suggestions for staff triage, not verified municipal decisions.
                    </span>
                  </div>
                </div>
              ) : complaint.imageAnalysis.status === 'Failed' ? (
                <div className="ai-status-note ai-status-failed">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>
                    AI visual analysis is unavailable for this complaint image.
                  </span>
                </div>
              ) : (
                <p className="ai-pending-text">
                  AI visual analysis is queued or processing.
                </p>
              )}
            </div>
          )}

          {/* Status History & Audit Trail Panel (Phase 10) */}
          <div className="details-card history-audit-panel" style={{ marginBottom: '1.25rem' }}>
            <div className="details-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                📜 Status History &amp; Audit Trail
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-500)' }}>
                {complaint.statusHistory?.length || 0} transition(s)
              </span>
            </div>

            {complaint.statusHistory && complaint.statusHistory.length > 0 ? (
              <div className="status-history-timeline">
                {complaint.statusHistory.map((item, index) => (
                  <div key={item.id || index} className="history-timeline-item">
                    <div className="timeline-node" />
                    <div className="history-timeline-content">
                      <div className="history-header-row">
                        <div className="history-status-transition">
                          {getStatusBadge(item.previousStatus)}
                          <span className="history-arrow">➔</span>
                          {getStatusBadge(item.newStatus)}
                        </div>
                        <span className="history-timestamp">{formatDate(item.changedAt)}</span>
                      </div>
                      <div className="history-actor">
                        Updated by: <strong>{item.changedByName || 'Municipal Administrator'}</strong>
                      </div>
                      {item.note && (
                        <div className="history-note-text">
                          <span className="note-quote-mark">“</span>
                          {item.note}
                          <span className="note-quote-mark">”</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-history-state" style={{ padding: '1rem', backgroundColor: 'var(--slate-50)', borderRadius: '6px', textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.875rem' }}>
                ℹ️ No status transitions have been recorded yet for this complaint. The issue is in its initial <strong>{complaint.status}</strong> state.
              </div>
            )}
          </div>

          {/* Assignment History & Audit Trail Panel (Phase 11) */}
          <div className="details-card history-audit-panel" style={{ marginBottom: '1.25rem' }}>
            <div className="details-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                📋 Work Order Assignment History
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-500)' }}>
                {complaint.assignmentHistory?.length || 0} assignment(s)
              </span>
            </div>

            {complaint.assignmentHistory && complaint.assignmentHistory.length > 0 ? (
              <div className="status-history-timeline">
                {complaint.assignmentHistory.map((item, index) => (
                  <div key={item.id || index} className="history-timeline-item">
                    <div className="timeline-node" style={{ borderColor: 'var(--primary-600)' }} />
                    <div className="history-timeline-content">
                      <div className="history-header-row">
                        <div className="history-status-transition">
                          <span className="badge badge-dept">
                            {item.previousDepartmentName || 'Unassigned'}
                          </span>
                          <span className="history-arrow">➔</span>
                          <span className="badge badge-dept" style={{ backgroundColor: 'var(--primary-100)', color: 'var(--primary-800)' }}>
                            🏢 {item.newDepartmentName}
                          </span>
                        </div>
                        <span className="history-timestamp">{formatDate(item.assignedAt)}</span>
                      </div>
                      <div className="history-actor" style={{ marginTop: '0.35rem' }}>
                        Officer: <strong>{item.newOfficerName || 'Unassigned (Department Queue)'}</strong>
                        {item.previousOfficerName && (
                          <span style={{ color: 'var(--slate-400)', fontSize: '0.8rem', marginLeft: '0.4rem' }}>
                            (was: {item.previousOfficerName})
                          </span>
                        )}
                      </div>
                      <div className="history-actor" style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>
                        Dispatched by: <strong>{item.assignedByName || 'Municipal Administrator'}</strong>
                      </div>
                      {item.note && (
                        <div className="history-note-text">
                          <span className="note-quote-mark">“</span>
                          {item.note}
                          <span className="note-quote-mark">”</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-history-state" style={{ padding: '1rem', backgroundColor: 'var(--slate-50)', borderRadius: '6px', textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.875rem' }}>
                ℹ️ No assignment history recorded for this complaint. The issue is in the general unassigned queue.
              </div>
            )}
          </div>

          {/* Duplicate Detection Advisory Panel */}
          {complaint.duplicateCheck && (
            <div className="details-card duplicate-advisory-panel">
              <div className="duplicate-panel-header">
                <div className="duplicate-panel-title">
                  <span className="dup-icon">🔍</span>
                  <h3>Duplicate Detection Analysis</h3>
                </div>
                {complaint.duplicateCheck.isPotentialDuplicate ? (
                  <span className="confidence-pill confidence-high">Potential Duplicate</span>
                ) : (
                  <span className="confidence-pill confidence-low">Unique Issue</span>
                )}
              </div>

              {complaint.duplicateCheck.isPotentialDuplicate ? (
                <div className="duplicate-match-container">
                  <p className="duplicate-warning-text">
                    ⚠️ <strong>Advisory:</strong> Similar complaints were identified in close proximity. Check below for matching reports:
                  </p>

                  <div className="matched-tickets-list">
                    {(complaint.duplicateCheck.matchedComplaints || []).map((m) => (
                      <div key={m.complaintId} className="matched-ticket-card">
                        <div className="matched-ticket-header">
                          <span className="ticket-code">{m.complaintId}</span>
                          <span className={`confidence-pill confidence-${m.confidence?.toLowerCase() || 'medium'}`}>
                            {m.confidence} ({Math.round((m.similarityScore || 0) * 100)}%)
                          </span>
                        </div>
                        <p className="matched-title">{m.title}</p>
                        <div className="matched-meta">
                          <span>Category: {m.category}</span>
                          <span>Status: {m.status}</span>
                          {m.distanceMeters !== null && (
                            <span>Distance: ~{Math.round(m.distanceMeters)}m</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="no-duplicates-text">
                  ✓ No similar existing complaints detected within geographic thresholds.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onOpenAssignModal && onOpenAssignModal(complaint)}
          >
            👷 Assign / Reassign
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onOpenStatusModal(complaint)}
          >
            ✎ Update Status
          </button>
        </div>
      </div>

      {/* Image Zoom Modal */}
      {imageModalOpen && (
        <div className="image-zoom-overlay" onClick={() => setImageModalOpen(false)}>
          <div className="image-zoom-content" onClick={(e) => e.stopPropagation()}>
            <img src={complaint.imageUrl} alt="Enlarged complaint evidence" />
            <button
              type="button"
              className="image-zoom-close"
              onClick={() => setImageModalOpen(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminComplaintDetails;
