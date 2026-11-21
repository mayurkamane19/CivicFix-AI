import React, { useState, useEffect } from 'react';
import { getWardsApi, getAdminDepartmentsApi, transferComplaintWardApi } from '../../services/api';
import './ward.css';

/**
 * ComplaintTransferModal
 * Inter-ward complaint reassignment dialog with mandatory reason validation and SLA preservation
 */
export const ComplaintTransferModal = ({ complaint, isOpen, onClose, onTransferSuccess }) => {
  const [wards, setWards] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [destinationWardId, setDestinationWardId] = useState('');
  const [destinationDepartmentId, setDestinationDepartmentId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setReason('');
    setDestinationWardId('');
    setDestinationDepartmentId('');

    const loadFormData = async () => {
      const [wardsRes, deptsRes] = await Promise.all([
        getWardsApi({ isActive: 'true', limit: 50 }),
        getAdminDepartmentsApi()
      ]);

      if (wardsRes.success && wardsRes.data) {
        // Exclude current ward
        const currentWardId = complaint?.ward?.id || complaint?.ward;
        const available = wardsRes.data.filter((w) => w.id !== currentWardId);
        setWards(available);
      }

      if (deptsRes.success && deptsRes.data) {
        setDepartments(deptsRes.data.filter((d) => d.isActive));
      }
    };

    loadFormData();
  }, [isOpen, complaint]);

  if (!isOpen || !complaint) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!destinationWardId) {
      setError('Please select a destination municipal ward');
      return;
    }

    if (!reason || reason.trim().length < 10) {
      setError('Please provide a mandatory transfer justification of at least 10 characters');
      return;
    }

    setLoading(true);
    const result = await transferComplaintWardApi(complaint.complaintId, {
      destinationWardId,
      destinationDepartmentId: destinationDepartmentId || null,
      reason: reason.trim()
    });
    setLoading(false);

    if (result.success) {
      if (onTransferSuccess) onTransferSuccess(result.data);
      onClose();
    } else {
      setError(result.error || 'Failed to transfer complaint');
    }
  };

  return (
    <div className="ward-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="transfer-modal-title">
      <div className="ward-modal-box">
        <div className="ward-modal-header">
          <h3 id="transfer-modal-title">Inter-Ward Complaint Transfer</h3>
          <button type="button" className="ward-modal-close-btn" onClick={onClose} disabled={loading}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ward-modal-body">
            {error && <div className="alert-error" style={{ padding: '0.65rem 0.85rem', borderRadius: '6px', background: '#fee2e2', color: '#b91c1c', fontSize: '0.85rem' }}>{error}</div>}

            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TICKET DETAILS</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                {complaint.complaintId}: {complaint.title}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.3rem' }}>
                Current Ward: <strong>{complaint.wardName || 'Unassigned'}</strong>
                {complaint.wardCode ? ` (${complaint.wardCode})` : ''}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                Destination Ward <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className="ward-filter-select"
                style={{ width: '100%' }}
                value={destinationWardId}
                onChange={(e) => setDestinationWardId(e.target.value)}
                required
                disabled={loading}
              >
                <option value="">-- Select Destination Ward --</option>
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} - {w.name} ({w.zone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                Destination Department <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(Optional Reassignment)</span>
              </label>
              <select
                className="ward-filter-select"
                style={{ width: '100%' }}
                value={destinationDepartmentId}
                onChange={(e) => setDestinationDepartmentId(e.target.value)}
                disabled={loading}
              >
                <option value="">-- Keep Current Department Assignment --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} - {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                Transfer Justification Reason <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                className="ward-search-input"
                style={{ width: '100%', minHeight: '90px', resize: 'vertical' }}
                placeholder="State the administrative or geographical reason for this inter-ward transfer (min 10 characters)..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
                required
                disabled={loading}
              />
              <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'right' }}>
                {reason.length}/1000 chars (min 10)
              </div>
            </div>

            <div className="transfer-advisory-box">
              ⏱️ <strong>SLA Deadline Preservation Guarantee:</strong> The original resolution deadline, target service hours, and citizen complaint ticket history are strictly preserved and will not be reset during this transfer.
            </div>
          </div>

          <div className="ward-modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Transferring...' : 'Confirm Inter-Ward Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ComplaintTransferModal;
