import React, { useState, useEffect, useCallback } from 'react';
import {
  getWardsApi,
  createWardApi,
  updateWardApi,
  toggleWardStatusApi,
  deleteWardApi,
  getAdminDepartmentsApi
} from '../../services/api';
import WardOfficersModal from './WardOfficersModal';
import './ward.css';

const ZONES = ['All Zones', 'Central Zone', 'North Zone', 'South Zone', 'East Zone', 'West Zone'];

/**
 * WardManagement
 * Municipal administration component for Ward Directory, creation, updates, and personnel linking
 */
export const WardManagement = ({ onSelectWardForDetails }) => {
  const [wards, setWards] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('All Zones');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Departments for department assignment selector
  const [availableDepartments, setAvailableDepartments] = useState([]);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editWard, setEditWard] = useState(null);
  const [officerModalWard, setOfficerModalWard] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    number: '',
    zone: 'Central Zone',
    description: '',
    population: '',
    areaKm2: '',
    latitude: '',
    longitude: '',
    assignedDepartments: []
  });

  const loadWards = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    const result = await getWardsApi({
      search,
      zone: zoneFilter === 'All Zones' ? '' : zoneFilter,
      isActive: statusFilter,
      page,
      limit: 10
    });
    setLoading(false);

    if (result.success) {
      setWards(result.data || []);
      if (result.pagination) setPagination(result.pagination);
    } else {
      setError(result.error || 'Failed to retrieve wards');
    }
  }, [search, zoneFilter, statusFilter]);

  useEffect(() => {
    loadWards(1);
  }, [loadWards]);

  // Load available departments for checkboxes
  useEffect(() => {
    const fetchDepts = async () => {
      const res = await getAdminDepartmentsApi();
      if (res.success && res.data) {
        setAvailableDepartments(res.data.filter((d) => d.isActive));
      }
    };
    fetchDepts();
  }, []);

  const handleOpenCreateModal = () => {
    setFormData({
      name: '',
      code: '',
      number: '',
      zone: 'Central Zone',
      description: '',
      population: '',
      areaKm2: '',
      latitude: '',
      longitude: '',
      assignedDepartments: []
    });
    setCreateModalOpen(true);
  };

  const handleOpenEditModal = (ward) => {
    setEditWard(ward);
    setFormData({
      name: ward.name,
      code: ward.code,
      number: ward.number,
      zone: ward.zone || 'Central Zone',
      description: ward.description || '',
      population: ward.population || '',
      areaKm2: ward.areaKm2 || '',
      latitude: ward.center?.latitude || '',
      longitude: ward.center?.longitude || '',
      assignedDepartments: (ward.assignedDepartments || []).map((d) => (d.id || d._id || d))
    });
  };

  const handleSubmitWard = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      number: parseInt(formData.number, 10),
      zone: formData.zone,
      description: formData.description.trim(),
      population: Number(formData.population) || 0,
      areaKm2: Number(formData.areaKm2) || 0,
      center: {
        latitude: formData.latitude ? Number(formData.latitude) : null,
        longitude: formData.longitude ? Number(formData.longitude) : null
      },
      assignedDepartments: formData.assignedDepartments
    };

    let res;
    if (editWard) {
      res = await updateWardApi(editWard.id, payload);
    } else {
      res = await createWardApi(payload);
    }

    if (res.success) {
      setSuccessMsg(editWard ? 'Ward updated successfully.' : 'Ward provisioned successfully.');
      setCreateModalOpen(false);
      setEditWard(null);
      loadWards(pagination.page);
    } else {
      setError(res.error || 'Failed to save ward');
    }
  };

  const handleToggleStatus = async (ward) => {
    const action = ward.isActive ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} ${ward.name} (${ward.code})?`)) {
      return;
    }

    const res = await toggleWardStatusApi(ward.id, !ward.isActive);
    if (res.success) {
      setSuccessMsg(res.message);
      loadWards(pagination.page);
    } else {
      setError(res.error || 'Failed to toggle ward status');
    }
  };

  const handleDeleteWard = async (ward) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${ward.name}? This cannot be undone.`)) {
      return;
    }

    const res = await deleteWardApi(ward.id);
    if (res.success) {
      setSuccessMsg(res.message);
      loadWards(pagination.page);
    } else {
      setError(res.error || 'Failed to delete ward');
    }
  };

  const handleDeptCheckbox = (deptId) => {
    setFormData((prev) => {
      const exists = prev.assignedDepartments.includes(deptId);
      const next = exists
        ? prev.assignedDepartments.filter((id) => id !== deptId)
        : [...prev.assignedDepartments, deptId];
      return { ...prev, assignedDepartments: next };
    });
  };

  return (
    <div className="ward-management-section">
      {/* Action / Banner Feedback */}
      {error && <div className="alert-error" style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c', marginBottom: '1rem' }}>{error}</div>}
      {successMsg && <div className="alert-success" style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: '#dcfce7', color: '#15803d', marginBottom: '1rem' }}>{successMsg}</div>}

      <div className="ward-table-card">
        {/* Filter Toolbar */}
        <div className="ward-filter-toolbar">
          <input
            type="text"
            className="ward-search-input"
            placeholder="Search by ward name, code or zone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="ward-filter-select"
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
          >
            {ZONES.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>

          <select
            className="ward-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="true">Active Wards</option>
            <option value="false">Inactive Wards</option>
          </select>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenCreateModal}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>+</span> Provision New Ward
          </button>
        </div>

        {/* Wards Table */}
        <div className="ward-table-responsive">
          <table className="ward-table">
            <thead>
              <tr>
                <th>Ward Code</th>
                <th>Ward Name</th>
                <th>Zone</th>
                <th>Officers</th>
                <th>Complaints</th>
                <th>SLA Compliance</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                    Loading municipal wards...
                  </td>
                </tr>
              ) : wards.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                    No municipal wards found matching the filters.
                  </td>
                </tr>
              ) : (
                wards.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <span className="ward-code-badge">{w.code}</span>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>No. {w.number}</div>
                    </td>
                    <td>
                      <strong>{w.name}</strong>
                      {w.description && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {w.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="zone-badge">{w.zone}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => setOfficerModalWard(w)}
                        title="Manage assigned field officers"
                      >
                        👷 {w.officerCount || 0} Officers
                      </button>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>
                        <strong>{w.stats?.totalComplaints || 0}</strong> total
                      </div>
                      <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                        {w.stats?.pending || 0} pending · {w.stats?.resolved || 0} resolved
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: (w.stats?.slaComplianceRate || 100) >= 80 ? '#10b981' : '#ef4444' }}>
                        {w.stats?.slaComplianceRate || 100}%
                      </div>
                      {w.stats?.overdue > 0 && (
                        <div style={{ fontSize: '0.725rem', color: '#ef4444' }}>
                          {w.stats.overdue} overdue
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={w.isActive ? 'status-active-badge' : 'status-inactive-badge'}>
                        {w.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        {onSelectWardForDetails && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            onClick={() => onSelectWardForDetails(w.id)}
                            title="View full ward analytics"
                          >
                            Details
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => handleOpenEditModal(w)}
                          title="Edit ward parameters"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => handleToggleStatus(w)}
                          title={w.isActive ? 'Deactivate ward' : 'Activate ward'}
                        >
                          {w.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          style={{ color: '#b91c1c' }}
                          onClick={() => handleDeleteWard(w)}
                          title="Delete ward (only if empty)"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} wards total)
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              disabled={pagination.page <= 1}
              onClick={() => loadWards(pagination.page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => loadWards(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Create / Edit Ward Modal */}
      {(createModalOpen || editWard) && (
        <div className="ward-modal-overlay" role="dialog" aria-modal="true">
          <div className="ward-modal-box">
            <div className="ward-modal-header">
              <h3>{editWard ? `Edit Ward: ${editWard.name}` : 'Provision New Municipal Ward'}</h3>
              <button
                type="button"
                className="ward-modal-close-btn"
                onClick={() => { setCreateModalOpen(false); setEditWard(null); }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitWard}>
              <div className="ward-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Ward Name *
                    </label>
                    <input
                      type="text"
                      className="ward-search-input"
                      style={{ width: '100%' }}
                      placeholder="e.g. Ward 1 - Central Civic Centre"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Ward Code *
                    </label>
                    <input
                      type="text"
                      className="ward-search-input"
                      style={{ width: '100%' }}
                      placeholder="e.g. WARD-01"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Ward No. *
                    </label>
                    <input
                      type="number"
                      className="ward-search-input"
                      style={{ width: '100%' }}
                      placeholder="1"
                      min="1"
                      value={formData.number}
                      onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Municipal Zone *
                    </label>
                    <select
                      className="ward-filter-select"
                      style={{ width: '100%' }}
                      value={formData.zone}
                      onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    >
                      {ZONES.filter((z) => z !== 'All Zones').map((z) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Est. Population
                    </label>
                    <input
                      type="number"
                      className="ward-search-input"
                      style={{ width: '100%' }}
                      placeholder="50000"
                      value={formData.population}
                      onChange={(e) => setFormData({ ...formData, population: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Area (km²)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      className="ward-search-input"
                      style={{ width: '100%' }}
                      placeholder="12.5"
                      value={formData.areaKm2}
                      onChange={(e) => setFormData({ ...formData, areaKm2: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Center Latitude (GPS)
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="ward-search-input"
                      style={{ width: '100%' }}
                      placeholder="18.5204"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Center Longitude (GPS)
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="ward-search-input"
                      style={{ width: '100%' }}
                      placeholder="73.8567"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    Ward Description & Jurisdiction Boundaries
                  </label>
                  <textarea
                    className="ward-search-input"
                    style={{ width: '100%', minHeight: '60px' }}
                    placeholder="Brief description of ward boundaries, landmarks, and key civic sectors..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    maxLength={1000}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                    Assigned Municipal Departments
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', maxHeight: '120px', overflowY: 'auto', border: '1px solid #e2e8f0', padding: '0.5rem', borderRadius: '6px' }}>
                    {availableDepartments.map((dept) => (
                      <label key={dept.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.825rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formData.assignedDepartments.includes(dept.id)}
                          onChange={() => handleDeptCheckbox(dept.id)}
                        />
                        <span>{dept.name} ({dept.code})</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="ward-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setCreateModalOpen(false); setEditWard(null); }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editWard ? 'Save Changes' : 'Provision Ward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ward Officers Modal */}
      {officerModalWard && (
        <WardOfficersModal
          ward={officerModalWard}
          isOpen={Boolean(officerModalWard)}
          onClose={() => setOfficerModalWard(null)}
          onOfficersUpdated={() => loadWards(pagination.page)}
        />
      )}
    </div>
  );
};

export default WardManagement;
