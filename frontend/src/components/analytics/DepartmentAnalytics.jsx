import React from 'react';

/**
 * DepartmentAnalytics Component
 * Displays municipal department workload share, resolution rate, and turnaround times.
 */
export const DepartmentAnalytics = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="analytics-card department-analytics-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">Municipal Department Operations</h3>
        </div>
        <div className="skeleton-line-tall" />
        <div className="skeleton-line-tall" />
      </div>
    );
  }

  const departments = data?.departments || [];
  const unassigned = data?.unassigned;
  const totalComplaints = data?.totalComplaints || 0;

  return (
    <div className="analytics-card department-analytics-card">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">Municipal Department Performance</h3>
          <span className="analytics-card-subtitle">
            Workload distribution, turnaround velocity, and completion rates by department
          </span>
        </div>
      </div>

      <div className="analytics-table-responsive">
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Status</th>
              <th>Total Assigned</th>
              <th>Workload Share</th>
              <th>Pending</th>
              <th>In Progress</th>
              <th>Resolved</th>
              <th>Resolution Rate</th>
              <th>Avg Turnaround</th>
            </tr>
          </thead>
          <tbody>
            {departments.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center text-muted py-4">
                  No department records available.
                </td>
              </tr>
            ) : (
              departments.map((dept) => (
                <tr key={dept.departmentId}>
                  <td>
                    <div className="dept-name-cell">
                      <strong>{dept.departmentName}</strong>
                      <span className="dept-code-tag">{dept.departmentCode}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge-small ${dept.isActive ? 'active' : 'inactive'}`}>
                      {dept.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td>
                    <strong>{dept.totalAssigned}</strong>
                  </td>
                  <td>
                    <div className="share-bar-cell">
                      <div className="mini-progress-track">
                        <div
                          className="mini-progress-fill"
                          style={{ width: `${Math.min(100, dept.workloadShare)}%` }}
                        />
                      </div>
                      <span>{dept.workloadShare}%</span>
                    </div>
                  </td>
                  <td>
                    <span className="count-pill pill-amber">{dept.pending}</span>
                  </td>
                  <td>
                    <span className="count-pill pill-blue">{dept.inProgress}</span>
                  </td>
                  <td>
                    <span className="count-pill pill-green">{dept.resolved}</span>
                  </td>
                  <td>
                    <span className="font-semibold text-emerald">{dept.resolutionRate}%</span>
                  </td>
                  <td>
                    <span className="turnaround-text">
                      {dept.avgResolutionHours > 0 ? `${dept.avgResolutionHours} hrs` : 'N/A'}
                    </span>
                  </td>
                </tr>
              ))
            )}

            {/* Unassigned Workloads Row */}
            {unassigned && unassigned.totalAssigned > 0 && (
              <tr className="unassigned-row">
                <td>
                  <div className="dept-name-cell">
                    <strong className="text-amber">⚠️ Unassigned Backlog</strong>
                    <span className="dept-code-tag">UNASSIGNED</span>
                  </div>
                </td>
                <td>
                  <span className="status-badge-small warning">Pending Routing</span>
                </td>
                <td>
                  <strong>{unassigned.totalAssigned}</strong>
                </td>
                <td>
                  <div className="share-bar-cell">
                    <div className="mini-progress-track">
                      <div
                        className="mini-progress-fill warning-fill"
                        style={{ width: `${Math.min(100, unassigned.workloadShare)}%` }}
                      />
                    </div>
                    <span>{unassigned.workloadShare}%</span>
                  </div>
                </td>
                <td>
                  <span className="count-pill pill-amber">{unassigned.pending}</span>
                </td>
                <td>
                  <span className="count-pill pill-blue">{unassigned.inProgress}</span>
                </td>
                <td>
                  <span className="count-pill pill-green">{unassigned.resolved}</span>
                </td>
                <td>
                  <span className="font-semibold text-emerald">{unassigned.resolutionRate}%</span>
                </td>
                <td>
                  <span className="turnaround-text">
                    {unassigned.avgResolutionHours > 0 ? `${unassigned.avgResolutionHours} hrs` : 'N/A'}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="analytics-card-footer-note">
        <span>ℹ️</span>
        <p>
          Department workloads reflect total dispatched tickets. Performance ratings should account
          for variation in operational complexity across municipal jurisdictions.
        </p>
      </div>
    </div>
  );
};

export default DepartmentAnalytics;
