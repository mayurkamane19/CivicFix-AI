import React, { useState, useEffect, useCallback } from 'react';
import { getAdminOfficersApi, getAdminDepartmentsApi } from '../../services/api';

/**
 * OfficerManagement Component
 * Displays registered municipal field officers, department affiliations, and secure provisioning instructions.
 */
export const OfficerManagement = () => {
  const [officers, setOfficers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDepartments = useCallback(async () => {
    const res = await getAdminDepartmentsApi();
    if (res.success) {
      setDepartments(res.data);
    }
  }, []);

  const fetchOfficers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getAdminOfficersApi(selectedDept);
    setLoading(false);

    if (res.success) {
      setOfficers(res.data);
    } else {
      setError(res.error || 'Failed to fetch field officers');
    }
  }, [selectedDept]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    fetchOfficers();
  }, [fetchOfficers]);

  return (
    <div className="officer-management-container">
      <div className="dept-mgmt-header">
        <div>
          <h2 className="dept-mgmt-title">👷 Municipal Field Officers</h2>
          <p className="dept-mgmt-subtitle">
            View field personnel authorized to inspect civic issues, update progress, and mark complaints resolved.
          </p>
        </div>

        {/* Department Filter */}
        <div className="officer-filter-box">
          <label className="filter-label" htmlFor="officer-dept-filter">
            Filter by Department:
          </label>
          <select
            id="officer-dept-filter"
            className="form-select"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Security Advisory Callout */}
      <div className="security-notice-card">
        <div className="security-notice-icon">🛡️</div>
        <div className="security-notice-content">
          <h4>Controlled Officer Provisioning Policy</h4>
          <p>
            To prevent unauthorized account elevation, public signup creates <code>citizen</code> accounts only.
            Municipal field officers must be provisioned via controlled CLI script:
          </p>
          <pre className="code-snippet">
            $env:OFFICER_NAME="Officer Jane Doe"; $env:OFFICER_EMAIL="officer.jane@civicfix.gov"; $env:OFFICER_PASSWORD="StrongPassword123!"; $env:OFFICER_DEPT_CODE="ROAD"; npm run seed:officer
          </pre>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-state">Loading field officers...</div>
      ) : officers.length === 0 ? (
        <div className="empty-state-card">
          <p>No field officers found for the selected department filter.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Officer Name</th>
                <th>Email Address</th>
                <th>Department</th>
                <th>Status</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {officers.map((officer) => (
                <tr key={officer.id}>
                  <td>
                    <div className="officer-cell-name">
                      <span className="avatar-mini">
                        {officer.name ? officer.name.charAt(0).toUpperCase() : 'O'}
                      </span>
                      <strong>{officer.name}</strong>
                    </div>
                  </td>
                  <td>{officer.email}</td>
                  <td>
                    <span className="badge badge-dept">
                      {officer.departmentName} {officer.departmentCode ? `(${officer.departmentCode})` : ''}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`status-pill ${
                        officer.isActive ? 'pill-active' : 'pill-inactive'
                      }`}
                    >
                      {officer.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-role">{officer.role}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OfficerManagement;
