import React from 'react';

/**
 * SeverityAnalytics Component
 * Displays AI-assisted severity classifications and category severity distributions.
 */
export const SeverityAnalytics = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="analytics-card severity-analytics-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">AI Severity Assessment</h3>
        </div>
        <div className="skeleton-line-tall" />
      </div>
    );
  }

  const distribution = data?.severityDistribution || {};
  const matrix = data?.categoryMatrix || [];
  const coverageRate = data?.analysisCoverageRate || 0;
  const total = data?.totalComplaints || 0;

  const severityLevels = [
    { key: 'Critical', label: 'Critical', ...distribution.Critical },
    { key: 'High', label: 'High', ...distribution.High },
    { key: 'Medium', label: 'Medium', ...distribution.Medium },
    { key: 'Low', label: 'Low', ...distribution.Low },
    { key: 'Unanalyzed', label: 'Unanalyzed', ...distribution.Unanalyzed }
  ];

  return (
    <div className="analytics-card severity-analytics-card">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">AI Severity &amp; Threat Classification</h3>
          <span className="analytics-card-subtitle">
            Google Gemini automated risk grading and urgency assessment
          </span>
        </div>
        <span className="badge-highlight">
          AI Coverage: <strong>{coverageRate}%</strong> ({data?.analyzedComplaints || 0}/{total})
        </span>
      </div>

      {/* Severity Metric Distribution Cards */}
      <div className="severity-levels-grid">
        {severityLevels.map((lvl) => (
          <div key={lvl.key} className="severity-level-card" style={{ borderTopColor: lvl.color }}>
            <span className="sev-badge-title" style={{ color: lvl.color }}>
              {lvl.label}
            </span>
            <strong className="sev-count">{lvl.count || 0}</strong>
            <span className="sev-pct">({lvl.percentage || 0}% of total)</span>
          </div>
        ))}
      </div>

      {/* Cross-Category Severity Matrix */}
      <div className="severity-matrix-section">
        <h4 className="res-subheading">Severity Distribution by Municipal Category</h4>
        <div className="analytics-table-responsive">
          <table className="analytics-table matrix-table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="text-center">Critical</th>
                <th className="text-center">High</th>
                <th className="text-center">Medium</th>
                <th className="text-center">Low</th>
                <th className="text-center">Unanalyzed</th>
                <th className="text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {matrix.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center text-muted py-4">
                    No category severity data available.
                  </td>
                </tr>
              ) : (
                matrix.map((row) => (
                  <tr key={row.category}>
                    <td>
                      <strong>{row.category}</strong>
                    </td>
                    <td className="text-center">
                      <span className={`matrix-count ${row.Critical > 0 ? 'bg-critical' : ''}`}>
                        {row.Critical}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`matrix-count ${row.High > 0 ? 'bg-high' : ''}`}>
                        {row.High}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`matrix-count ${row.Medium > 0 ? 'bg-medium' : ''}`}>
                        {row.Medium}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`matrix-count ${row.Low > 0 ? 'bg-low' : ''}`}>
                        {row.Low}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="text-muted">{row.Unanalyzed}</span>
                    </td>
                    <td className="text-center">
                      <strong>{row.total}</strong>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="analytics-card-footer-note">
        <span>🤖</span>
        <p>
          AI classifications are advisory recommendations generated during citizen submission. Municipal
          authorities retain full oversight over actual operational severity and dispatch precedence.
        </p>
      </div>
    </div>
  );
};

export default SeverityAnalytics;
