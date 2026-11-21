import React, { useState, useEffect, useCallback } from 'react';
import { getMunicipalOverviewApi } from '../../services/api';
import './ward.css';

/**
 * MunicipalOverviewTab
 * Centralized executive dashboard for city-wide multi-ward governance, performance metrics, and transfer activities
 */
export const MunicipalOverviewTab = ({ onSelectWard }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getMunicipalOverviewApi();
    setLoading(false);

    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error || 'Failed to retrieve municipal overview');
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  if (loading && !data) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        Loading city-wide multi-ward operational intelligence...
      </div>
    );
  }

  const kpi = data?.kpi || {
    totalWards: 0,
    activeWards: 0,
    inactiveWards: 0,
    totalComplaints: 0,
    pendingComplaints: 0,
    inProgressComplaints: 0,
    resolvedComplaints: 0,
    reopenedComplaints: 0,
    awaitingVerification: 0,
    slaBreachedComplaints: 0,
    overallSlaCompliance: 100
  };

  const wardComparison = data?.wardComparison || [];
  const recentTransfers = data?.recentTransfers || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {error && <div className="alert-error" style={{ padding: '0.75rem', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c' }}>{error}</div>}

      {/* KPI Cards Grid */}
      <div className="municipal-kpi-grid">
        <div className="municipal-kpi-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div className="municipal-kpi-label">Municipal Wards</div>
          <div className="municipal-kpi-value">{kpi.totalWards}</div>
          <div className="municipal-kpi-sub">
            {kpi.activeWards} active · {kpi.inactiveWards} inactive
          </div>
        </div>

        <div className="municipal-kpi-card" style={{ borderLeft: '4px solid #0284c7' }}>
          <div className="municipal-kpi-label">City-Wide Complaints</div>
          <div className="municipal-kpi-value">{kpi.totalComplaints}</div>
          <div className="municipal-kpi-sub" style={{ color: '#0284c7' }}>
            Across all municipal wards
          </div>
        </div>

        <div className="municipal-kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="municipal-kpi-label">Active / Pending</div>
          <div className="municipal-kpi-value">{kpi.pendingComplaints + kpi.inProgressComplaints}</div>
          <div className="municipal-kpi-sub" style={{ color: '#f59e0b' }}>
            {kpi.pendingComplaints} pending · {kpi.inProgressComplaints} in-progress
          </div>
        </div>

        <div className="municipal-kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="municipal-kpi-label">Resolved Issues</div>
          <div className="municipal-kpi-value">{kpi.resolvedComplaints}</div>
          <div className="municipal-kpi-sub" style={{ color: '#10b981' }}>
            {kpi.awaitingVerification} awaiting citizen verification
          </div>
        </div>

        <div className="municipal-kpi-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="municipal-kpi-label">SLA Compliance</div>
          <div className="municipal-kpi-value" style={{ color: kpi.overallSlaCompliance >= 80 ? '#10b981' : '#ef4444' }}>
            {kpi.overallSlaCompliance}%
          </div>
          <div className="municipal-kpi-sub" style={{ color: kpi.slaBreachedComplaints > 0 ? '#ef4444' : '#64748b' }}>
            {kpi.slaBreachedComplaints} overdue tickets
          </div>
        </div>
      </div>

      {/* Ward Comparison Performance Matrix */}
      <div className="ward-table-card">
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Ward Performance Comparison</h3>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Real-time cross-ward complaint triage and SLA efficiency</div>
          </div>
          <button type="button" className="btn btn-secondary btn-small" onClick={fetchOverview}>
            🔄 Refresh Metrics
          </button>
        </div>

        <div className="ward-table-responsive">
          <table className="ward-table">
            <thead>
              <tr>
                <th>Ward</th>
                <th>Zone</th>
                <th>Officers</th>
                <th>Total Issues</th>
                <th>Pending</th>
                <th>In Progress</th>
                <th>Resolved</th>
                <th>Overdue</th>
                <th>SLA Rate</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {wardComparison.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    No municipal wards provisioned yet.
                  </td>
                </tr>
              ) : (
                wardComparison.map((w) => (
                  <tr key={w.wardId}>
                    <td>
                      <span className="ward-code-badge">{w.wardCode}</span>
                      <strong style={{ marginLeft: '0.5rem' }}>{w.wardName}</strong>
                    </td>
                    <td>
                      <span className="zone-badge">{w.zone}</span>
                    </td>
                    <td>{w.officerCount}</td>
                    <td><strong>{w.totalComplaints}</strong></td>
                    <td>{w.pending}</td>
                    <td>{w.inProgress}</td>
                    <td>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>{w.resolved}</span>
                    </td>
                    <td>
                      {w.overdue > 0 ? (
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>{w.overdue}</span>
                      ) : (
                        <span style={{ color: '#64748b' }}>0</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: w.slaComplianceRate >= 80 ? '#10b981' : '#ef4444' }}>
                        {w.slaComplianceRate}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {onSelectWard && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => onSelectWard(w.wardId)}
                        >
                          View Analytics
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Inter-Ward Activity */}
      <div className="ward-table-card">
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Recent Inter-Ward Transfers & Governance Log</h3>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Audit trail of cross-ward ticket reassignment events</div>
        </div>

        <div className="ward-table-responsive">
          <table className="ward-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Issue Title</th>
                <th>Transfer Path</th>
                <th>Authorized Administrator</th>
                <th>Justification Reason</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentTransfers.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '1.75rem', color: '#64748b' }}>
                    No recent inter-ward transfer records.
                  </td>
                </tr>
              ) : (
                recentTransfers.map((t, idx) => (
                  <tr key={idx}>
                    <td><span className="ward-code-badge">{t.complaintId}</span></td>
                    <td><strong>{t.title}</strong></td>
                    <td>
                      <span style={{ color: '#64748b' }}>{t.fromWard}</span>
                      <span style={{ margin: '0 0.4rem', color: '#2563eb' }}>➔</span>
                      <strong>{t.toWard}</strong>
                    </td>
                    <td>{t.transferredBy}</td>
                    <td style={{ maxWidth: '300px', fontSize: '0.825rem', color: '#475569' }}>
                      {t.reason}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {new Date(t.transferredAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MunicipalOverviewTab;
