import React, { useState } from 'react';
import { updateComplaintStatusApi } from '../../services/api';

/**
 * ComplaintStatusUpdate Component
 * Modal dialog with explicit confirmation and administrative note to update municipal complaint status
 */
export const ComplaintStatusUpdate = ({
  complaint,
  isOpen,
  onClose,
  onStatusUpdated
}) => {
  if (!isOpen || !complaint) return null;

  const [selectedStatus, setSelectedStatus] = useState(complaint.status || 'Pending');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const statuses = [
    {
      value: 'Pending',
      label: 'Pending',
      description: 'Issue reported, awaiting dispatch or field assignment',
      color: 'badge-pending'
    },
    {
      value: 'In Progress',
      label: 'In Progress',
      description: 'Municipal crew or contractor actively addressing the issue',
      color: 'badge-in-progress'
    },
    {
      value: 'Resolved',
      label: 'Resolved',
      description: 'Physical work completed and issue successfully closed',
      color: 'badge-resolved'
    }
  ];

  const handleStatusChange = (newStatus) => {
    setSelectedStatus(newStatus);
    setConfirmed(false);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedStatus === complaint.status) {
      onClose();
      return;
    }

    if (!confirmed) {
      setConfirmed(true);
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await updateComplaintStatusApi(
      complaint.complaintId,
      selectedStatus,
      note
    );

    setSubmitting(false);

    if (result.success && result.data) {
      onStatusUpdated(result.data);
      onClose();
    } else {
      setError(result.error || 'Failed to update complaint status');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container status-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="status-modal-title"
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-kicker">MUNICIPAL RESOLUTION WORKFLOW</span>
            <h3 id="status-modal-title" className="modal-title">
              Update Complaint Status
            </h3>
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

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Target Ticket Overview */}
            <div className="ticket-summary-box">
              <div className="summary-row">
                <span className="summary-label">Ticket ID:</span>
                <span className="summary-value ticket-code">{complaint.complaintId}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Title:</span>
                <span className="summary-value">{complaint.title}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Current Status:</span>
                <span className={`status-badge ${complaint.status === 'Resolved' ? 'badge-resolved' : complaint.status === 'In Progress' ? 'badge-in-progress' : 'badge-pending'}`}>
                  {complaint.status}
                </span>
              </div>
            </div>

            {error && (
              <div className="alert-box alert-error" style={{ margin: '1rem 0' }}>
                <span className="alert-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Status Radio Selector */}
            <div className="status-selector-group">
              <label className="input-label">Select New Resolution Status:</label>
              <div className="status-options-list">
                {statuses.map((s) => {
                  const isCurrent = complaint.status === s.value;
                  const isSelected = selectedStatus === s.value;

                  return (
                    <label
                      key={s.value}
                      className={`status-option-card ${isSelected ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="complaintStatus"
                        value={s.value}
                        checked={isSelected}
                        onChange={() => handleStatusChange(s.value)}
                        disabled={submitting}
                      />
                      <div className="status-option-content">
                        <div className="status-option-header">
                          <span className={`status-badge ${s.color}`}>
                            {s.label}
                          </span>
                          {isCurrent && (
                            <span className="current-status-tag">Current</span>
                          )}
                        </div>
                        <p className="status-option-desc">{s.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Optional Administrative Note Input (Phase 10) */}
            <div className="status-note-group" style={{ marginTop: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label htmlFor="status-note-input" className="input-label" style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                  Administrative Note (Optional):
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                  {note.length}/500
                </span>
              </div>
              <textarea
                id="status-note-input"
                className="filter-input"
                style={{ width: '100%', minHeight: '70px', padding: '0.5rem', resize: 'vertical' }}
                placeholder="e.g. Field inspection completed; repair crew dispatched with asphalt patch."
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                maxLength={500}
                disabled={submitting}
              />
            </div>

            {/* Explicit Confirmation Notice */}
            {selectedStatus !== complaint.status && (
              <div className={`confirmation-notice ${confirmed ? 'confirmed-pulse' : ''}`} style={{ marginTop: '1rem' }}>
                <div className="confirmation-icon">⚠️</div>
                <div className="confirmation-text">
                  <strong>Verification Required:</strong>
                  <p>
                    Are you sure you want to transition <code>{complaint.complaintId}</code> from{' '}
                    <strong>{complaint.status}</strong> to <strong>{selectedStatus}</strong>?
                    This will be recorded in the audit history and reflected on public tracking.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>

            {selectedStatus !== complaint.status ? (
              <button
                type="submit"
                className={`btn ${confirmed ? 'btn-primary' : 'btn-outline'}`}
                disabled={submitting}
              >
                {submitting
                  ? 'Updating Status...'
                  : confirmed
                  ? `Confirm & Save as ${selectedStatus}`
                  : `Change to ${selectedStatus}`}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                No Changes
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ComplaintStatusUpdate;
