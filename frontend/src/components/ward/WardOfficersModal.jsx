import React, { useState, useEffect } from 'react';
import {
  getWardOfficersApi,
  getAdminOfficersApi,
  assignWardOfficersApi,
  removeWardOfficerApi
} from '../../services/api';
import './ward.css';

/**
 * WardOfficersModal
 * Administrative modal for managing field officer personnel assigned to a municipal ward
 */
export const WardOfficersModal = ({ ward, isOpen, onClose, onOfficersUpdated }) => {
  const [assignedOfficers, setAssignedOfficers] = useState([]);
  const [availableOfficers, setAvailableOfficers] = useState([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const loadOfficers = async () => {
    if (!ward) return;
    setLoading(true);
    setError(null);

    const [wardOfficersRes, allOfficersRes] = await Promise.all([
      getWardOfficersApi(ward.id),
      getAdminOfficersApi()
    ]);

    setLoading(false);

    if (wardOfficersRes.success && wardOfficersRes.data) {
      setAssignedOfficers(wardOfficersRes.data);
    }

    if (allOfficersRes.success && allOfficersRes.data) {
      // Filter out officers already assigned to this ward
      const assignedIds = new Set((wardOfficersRes.data || []).map((o) => o.id));
      const unassigned = allOfficersRes.data.filter((o) => !assignedIds.has(o.id));
      setAvailableOfficers(unassigned);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedOfficerId('');
      setSuccessMsg(null);
      loadOfficers();
    }
  }, [isOpen, ward]);

  if (!isOpen || !ward) return null;

  const handleAssignOfficer = async (e) => {
    e.preventDefault();
    if (!selectedOfficerId) return;

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const res = await assignWardOfficersApi(ward.id, [selectedOfficerId]);
    setLoading(false);

    if (res.success) {
      setSuccessMsg('Officer successfully assigned to ward.');
      setSelectedOfficerId('');
      loadOfficers();
      if (onOfficersUpdated) onOfficersUpdated();
    } else {
      setError(res.error || 'Failed to assign officer');
    }
  };

  const handleRemoveOfficer = async (officerId, officerName) => {
    if (!window.confirm(`Are you sure you want to remove ${officerName} from ${ward.name}?`)) {
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const res = await removeWardOfficerApi(ward.id, officerId);
    setLoading(false);

    if (res.success) {
      setSuccessMsg(`${officerName} unassigned from ward.`);
      loadOfficers();
      if (onOfficersUpdated) onOfficersUpdated();
    } else {
      setError(res.error || 'Failed to remove officer');
    }
  };

  return (
    <div className="ward-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ward-officers-title">
      <div className="ward-modal-box">
        <div className="ward-modal-header">
          <h3 id="ward-officers-title">Assigned Field Officers — {ward.name} ({ward.code})</h3>
          <button type="button" className="ward-modal-close-btn" onClick={onClose} disabled={loading}>
            ✕
          </button>
        </div>

        <div className="ward-modal-body">
          {error && <div className="alert-error" style={{ padding: '0.65rem', borderRadius: '6px', background: '#fee2e2', color: '#b91c1c', fontSize: '0.85rem' }}>{error}</div>}
          {successMsg && <div className="alert-success" style={{ padding: '0.65rem', borderRadius: '6px', background: '#dcfce7', color: '#15803d', fontSize: '0.85rem' }}>{successMsg}</div>}

          {/* Quick Assign Form */}
          <form onSubmit={handleAssignOfficer} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                Assign New Field Officer to Ward
              </label>
              <select
                className="ward-filter-select"
                style={{ width: '100%' }}
                value={selectedOfficerId}
                onChange={(e) => setSelectedOfficerId(e.target.value)}
                disabled={loading || availableOfficers.length === 0}
              >
                <option value="">
                  {availableOfficers.length === 0 ? '-- No Unassigned Officers Available --' : '-- Select Officer to Assign --'}
                </option>
                {availableOfficers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.departmentName || 'General'})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !selectedOfficerId}
              style={{ padding: '0.55rem 1rem' }}
            >
              Assign Officer
            </button>
          </form>

          {/* Officers List Table */}
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>
              Current Ward Roster ({assignedOfficers.length} Officers)
            </div>

            {assignedOfficers.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', color: '#64748b' }}>
                No officers currently assigned to this ward.
              </div>
            ) : (
              <div className="ward-table-responsive" style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table className="ward-table">
                  <thead>
                    <tr>
                      <th>Officer</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedOfficers.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <strong>{o.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{o.email}</div>
                        </td>
                        <td>{o.departmentName || 'Unassigned'}</td>
                        <td>
                          <span className={o.isActive ? 'status-active-badge' : 'status-inactive-badge'}>
                            {o.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                            onClick={() => handleRemoveOfficer(o.id, o.name)}
                            disabled={loading}
                          >
                            Unassign
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="ward-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WardOfficersModal;
