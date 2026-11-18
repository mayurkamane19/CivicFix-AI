import React, { useState, useEffect } from 'react';
import {
  getAdminDepartmentsApi,
  getAdminOfficersApi,
  assignComplaintApi
} from '../../services/api';

/**
 * ComplaintAssignmentModal Component
 * Allows administrators to assign or reassign a civic complaint to a department
 * and specific field officer, with an interactive confirmation step.
 */
export const ComplaintAssignmentModal = ({
  complaint,
  isOpen,
  onClose,
  onAssignmentSuccess
}) => {
  if (!isOpen || !complaint) return null;

  const [departments, setDepartments] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [note, setNote] = useState('');

  const [loadingDepts, setLoadingDepts] = useState(false);
  const [loadingOfficers, setLoadingOfficers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Confirmation Step State
  const [isConfirming, setIsConfirming] = useState(false);

  // Load active departments on mount
  useEffect(() => {
    const loadDepartments = async () => {
      setLoadingDepts(true);
      setError(null);
      const res = await getAdminDepartmentsApi();
      setLoadingDepts(false);

      if (res.success) {
        // Show active departments for assignment
        const activeOnly = res.data.filter((d) => d.isActive);
        setDepartments(activeOnly);
      } else {
        setError(res.error || 'Failed to load municipal departments');
      }
    };

    loadDepartments();
  }, []);

  // When department changes, load officers for that department
  useEffect(() => {
    if (!selectedDeptId) {
      setOfficers([]);
      setSelectedOfficerId('');
      return;
    }

    const loadOfficers = async () => {
      setLoadingOfficers(true);
      const res = await getAdminOfficersApi(selectedDeptId);
      setLoadingOfficers(false);

      if (res.success) {
        const activeOnly = res.data.filter((o) => o.isActive);
        setOfficers(activeOnly);
      } else {
        setOfficers([]);
      }
    };

    loadOfficers();
    setSelectedOfficerId('');
  }, [selectedDeptId]);

  const selectedDepartmentObj = departments.find((d) => d.id === selectedDeptId);
  const selectedOfficerObj = officers.find((o) => o.id === selectedOfficerId);

  const handleProceedToConfirm = (e) => {
    e.preventDefault();
    if (!selectedDeptId) {
      setError('Please select a municipal department');
      return;
    }
    if (note.length > 500) {
      setError('Assignment note cannot exceed 500 characters');
      return;
    }
    setError(null);
    setIsConfirming(true);
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setError(null);

    const res = await assignComplaintApi(complaint.complaintId, {
      departmentId: selectedDeptId,
      officerId: selectedOfficerId || null,
      note: note.trim()
    });

    setSubmitting(false);

    if (res.success) {
      if (onAssignmentSuccess) {
        onAssignmentSuccess(res.data);
      }
      onClose();
    } else {
      setError(res.error || 'Failed to assign complaint');
      setIsConfirming(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container assignment-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="assignment-modal-title"
      >
        <div className="modal-header">
          <div>
            <span className="modal-kicker">WORK ORDER DISPATCH</span>
            <h3 id="assignment-modal-title" className="modal-title">
              Assign Issue: {complaint.complaintId}
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

        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          {/* Current Assignment Card */}
          <div className="current-assignment-box">
            <span className="assignment-label">Current Assignment:</span>
            <div className="current-assignment-details">
              <span>
                <strong>Department:</strong> {complaint.assignedDepartmentName || 'Unassigned'}
              </span>
              <span>
                <strong>Officer:</strong> {complaint.assignedOfficerName || 'Unassigned'}
              </span>
            </div>
          </div>

          {!isConfirming ? (
            /* Step 1: Configuration Form */
            <form onSubmit={handleProceedToConfirm} className="assignment-form">
              <div className="form-group">
                <label className="form-label" htmlFor="assign-department-select">
                  Target Department *
                </label>
                <select
                  id="assign-department-select"
                  className="form-select"
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  disabled={loadingDepts}
                  required
                >
                  <option value="">-- Choose Municipal Department --</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
                {loadingDepts && <span className="helper-text">Loading departments...</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="assign-officer-select">
                  Field Officer (Optional)
                </label>
                <select
                  id="assign-officer-select"
                  className="form-select"
                  value={selectedOfficerId}
                  onChange={(e) => setSelectedOfficerId(e.target.value)}
                  disabled={!selectedDeptId || loadingOfficers}
                >
                  <option value="">
                    {!selectedDeptId
                      ? '-- Select Department First --'
                      : loadingOfficers
                      ? 'Loading department officers...'
                      : officers.length === 0
                      ? 'No active officers in this department (assigns to department queue)'
                      : '-- Select Field Officer --'}
                  </option>
                  {officers.map((officer) => (
                    <option key={officer.id} value={officer.id}>
                      {officer.name} ({officer.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <div className="label-with-counter">
                  <label className="form-label" htmlFor="assignment-note-text">
                    Assignment Instructions / Note
                  </label>
                  <span className="char-counter">{note.length} / 500</span>
                </div>
                <textarea
                  id="assignment-note-text"
                  className="form-textarea"
                  rows={3}
                  placeholder="e.g. Please prioritize inspection. Damaged culvert leaking into road..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!selectedDeptId}
                >
                  Review Assignment →
                </button>
              </div>
            </form>
          ) : (
            /* Step 2: Confirmation Step */
            <div className="confirmation-step-box">
              <div className="confirmation-banner">
                <span className="confirm-icon">⚠️</span>
                <div>
                  <h4>Confirm Complaint Assignment</h4>
                  <p>Please review the details below before dispatching this issue:</p>
                </div>
              </div>

              <div className="confirm-summary-list">
                <div className="confirm-summary-row">
                  <span className="confirm-label">Complaint:</span>
                  <span className="confirm-val">
                    <strong>{complaint.complaintId}</strong> – {complaint.title}
                  </span>
                </div>
                <div className="confirm-summary-row">
                  <span className="confirm-label">Department:</span>
                  <span className="confirm-val highlight-val">
                    {selectedDepartmentObj?.name} ({selectedDepartmentObj?.code})
                  </span>
                </div>
                <div className="confirm-summary-row">
                  <span className="confirm-label">Field Officer:</span>
                  <span className="confirm-val highlight-val">
                    {selectedOfficerObj ? selectedOfficerObj.name : 'Unassigned (Department Queue)'}
                  </span>
                </div>
                {note.trim() && (
                  <div className="confirm-summary-row">
                    <span className="confirm-label">Instructions:</span>
                    <span className="confirm-val note-val">"{note.trim()}"</span>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsConfirming(false)}
                  disabled={submitting}
                >
                  ← Back to Edit
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleFinalSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Assigning...' : 'Confirm & Dispatch Work Order'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComplaintAssignmentModal;
