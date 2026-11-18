import React, { useState, useEffect, useCallback } from 'react';
import {
  getAdminDepartmentsApi,
  createAdminDepartmentApi,
  updateAdminDepartmentApi
} from '../../services/api';

/**
 * DepartmentManagement Component
 * Allows municipal administrators to create, view, update, and activate/deactivate departments.
 */
export const DepartmentManagement = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // New Department Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', code: '', description: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Edit Department Form State
  const [editingDept, setEditingDept] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', code: '', description: '', isActive: true });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getAdminDepartmentsApi();
    setLoading(false);

    if (res.success) {
      setDepartments(res.data);
    } else {
      setError(res.error || 'Failed to fetch departments');
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.code.trim()) {
      setCreateError('Department name and code are required');
      return;
    }

    setCreateLoading(true);
    setCreateError(null);

    const res = await createAdminDepartmentApi(createForm);
    setCreateLoading(false);

    if (res.success) {
      setSuccess(`Department "${createForm.name}" created successfully`);
      setShowCreateModal(false);
      setCreateForm({ name: '', code: '', description: '' });
      fetchDepartments();
      setTimeout(() => setSuccess(null), 4000);
    } else {
      setCreateError(res.error || 'Failed to create department');
    }
  };

  const handleOpenEdit = (dept) => {
    setEditingDept(dept);
    setEditForm({
      name: dept.name,
      code: dept.code,
      description: dept.description || '',
      isActive: dept.isActive
    });
    setEditError(null);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.code.trim()) {
      setEditError('Department name and code are required');
      return;
    }

    setEditLoading(true);
    setEditError(null);

    const res = await updateAdminDepartmentApi(editingDept.id, editForm);
    setEditLoading(false);

    if (res.success) {
      setSuccess(`Department "${editForm.name}" updated successfully`);
      setEditingDept(null);
      fetchDepartments();
      setTimeout(() => setSuccess(null), 4000);
    } else {
      setEditError(res.error || 'Failed to update department');
    }
  };

  const handleToggleActive = async (dept) => {
    const updatedStatus = !dept.isActive;
    const actionName = updatedStatus ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${actionName} "${dept.name}"?`)) {
      return;
    }

    const res = await updateAdminDepartmentApi(dept.id, { isActive: updatedStatus });
    if (res.success) {
      setSuccess(`Department "${dept.name}" ${updatedStatus ? 'activated' : 'deactivated'} successfully`);
      fetchDepartments();
      setTimeout(() => setSuccess(null), 4000);
    } else {
      setError(res.error || `Failed to ${actionName} department`);
    }
  };

  return (
    <div className="department-management-container">
      <div className="dept-mgmt-header">
        <div>
          <h2 className="dept-mgmt-title">🏢 Municipal Departments</h2>
          <p className="dept-mgmt-subtitle">
            Manage administrative departments responsible for civic complaints resolution and dispatch.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setShowCreateModal(true);
            setCreateError(null);
          }}
        >
          + Add Department
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading ? (
        <div className="loading-state">Loading departments...</div>
      ) : departments.length === 0 ? (
        <div className="empty-state-card">
          <p>No departments found. Click "+ Add Department" to create the first department.</p>
        </div>
      ) : (
        <div className="departments-grid">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className={`department-card ${!dept.isActive ? 'dept-card-inactive' : ''}`}
            >
              <div className="dept-card-top">
                <span className="dept-code-badge">{dept.code}</span>
                <span
                  className={`status-pill ${
                    dept.isActive ? 'pill-active' : 'pill-inactive'
                  }`}
                >
                  {dept.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <h3 className="dept-card-name">{dept.name}</h3>
              <p className="dept-card-desc">
                {dept.description || 'No description provided.'}
              </p>
              <div className="dept-card-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() => handleOpenEdit(dept)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={`btn btn-small ${
                    dept.isActive ? 'btn-outline-danger' : 'btn-outline-success'
                  }`}
                  onClick={() => handleToggleActive(dept)}
                >
                  {dept.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create Municipal Department</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="modal-body">
              {createError && <div className="alert alert-error">{createError}</div>}
              <div className="form-group">
                <label className="form-label">Department Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Road Maintenance"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Department Code (Uppercase) *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. ROAD"
                  value={createForm.code}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Scope of work and responsibilities..."
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, description: e.target.value })
                  }
                  maxLength={500}
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createLoading}
                >
                  {createLoading ? 'Creating...' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingDept && (
        <div className="modal-backdrop" onClick={() => setEditingDept(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Department: {editingDept.name}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingDept(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="modal-body">
              {editError && <div className="alert alert-error">{editError}</div>}
              <div className="form-group">
                <label className="form-label">Department Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Department Code *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.code}
                  onChange={(e) =>
                    setEditForm({ ...editForm, code: e.target.value.toUpperCase() })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  maxLength={500}
                />
              </div>
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) =>
                      setEditForm({ ...editForm, isActive: e.target.checked })
                    }
                  />
                  <span>Active Department (available for issue dispatch)</span>
                </label>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingDept(null)}
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editLoading}
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentManagement;
