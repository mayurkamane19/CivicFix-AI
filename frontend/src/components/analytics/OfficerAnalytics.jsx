import React from 'react';

/**
 * OfficerAnalytics Component
 * Displays field officer workloads, assigned ticket statuses, and resolution velocities.
 */
export const OfficerAnalytics = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="analytics-card officer-analytics-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">Field Officer Workloads</h3>
        </div>
        <div className="skeleton-line-tall" />
      </div>
    );
  }

  const officers = data?.officers || [];

  return (
    <div className="analytics-card officer-analytics-card">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">Field Officer Workloads &amp; Turnaround</h3>
          <span className="analytics-card-subtitle">
            Operational assignment queue and ticket clearance efficiency by field personnel
          </span>
        </div>
        <span className="badge-highlight">
          Active Field Staff: <strong>{data?.totalOfficers || officers.length}</strong>
        </span>
      </div>

      <div className="analytics-table-responsive">
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Field Officer</th>
              <th>Department</th>
              <th>Total Assigned</th>
              <th>Pending Triage</th>
              <th>In Progress</th>
              <th>Resolved</th>
              <th>Resolution Rate</th>
              <th>Avg Turnaround</th>
            </tr>
          </thead>
          <tbody>
            {officers.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center text-muted py-4">
                  No field officers currently provisioned.
                </td>
              </tr>
            ) : (
              officers.map((off) => (
                <tr key={off.officerId}>
                  <td>
                    <div className="officer-identity-cell">
                      <span className="officer-avatar-icon">👷</span>
                      <div>
                        <strong>{off.officerName}</strong>
                        <span className="officer-email-sub">{off.officerEmail}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="dept-tag">{off.departmentName}</span>
                  </td>
                  <td>
                    <strong>{off.totalAssigned}</strong>
                  </td>
                  <td>
                    <span className="count-pill pill-amber">{off.pending}</span>
                  </td>
                  <td>
                    <span className="count-pill pill-blue">{off.inProgress}</span>
                  </td>
                  <td>
                    <span className="count-pill pill-green">{off.resolved}</span>
                  </td>
                  <td>
                    <span className="font-semibold text-emerald">{off.resolutionRate}%</span>
                  </td>
                  <td>
                    <span className="turnaround-text">
                      {off.avgResolutionHours > 0 ? `${off.avgResolutionHours} hrs` : 'N/A'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="analytics-card-footer-note">
        <span>🛡️</span>
        <p>
          Data strictly reflects assigned complaints. Security boundaries prevent exposure of officer
          credentials or unassigned ticket records.
        </p>
      </div>
    </div>
  );
};

export default OfficerAnalytics;
