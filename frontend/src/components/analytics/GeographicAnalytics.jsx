import React from 'react';

/**
 * GeographicAnalytics Component
 * Displays aggregated spatial distribution, neighborhood hot spots, and resolution rates.
 */
export const GeographicAnalytics = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="analytics-card geographic-analytics-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">Geographic &amp; Spatial Insights</h3>
        </div>
        <div className="skeleton-line-tall" />
      </div>
    );
  }

  const clusters = data?.areaClusters || [];
  const geocoded = data?.geocodedComplaints || 0;
  const unlocated = data?.unlocatedComplaints || 0;
  const total = data?.totalComplaints || 0;
  const geocodedPct = total > 0 ? Math.round((geocoded / total) * 1000) / 10 : 0;

  return (
    <div className="analytics-card geographic-analytics-card">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">Spatial Hot Spots &amp; Neighborhood Clusters</h3>
          <span className="analytics-card-subtitle">
            Geographic density distribution and municipal ward resolution coverage
          </span>
        </div>
        <span className="badge-highlight">
          GPS Tagged: <strong>{geocodedPct}%</strong> ({geocoded}/{total})
        </span>
      </div>

      {/* Spatial Coverage Stats */}
      <div className="geo-stats-summary-bar">
        <div className="geo-stat-pill">
          <span>📍 Geocoded Incidents:</span> <strong>{geocoded}</strong>
        </div>
        <div className="geo-stat-pill">
          <span>📝 Address-Only / Unlocated:</span> <strong>{unlocated}</strong>
        </div>
        <div className="geo-stat-pill">
          <span>🗺️ Identified Ward Clusters:</span> <strong>{clusters.length}</strong>
        </div>
      </div>

      {/* Hot Spot Table */}
      <div className="analytics-table-responsive">
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Area / Vicinity</th>
              <th>Approximate Coordinates</th>
              <th>Total Incidents</th>
              <th>Top Incident Type</th>
              <th>Pending</th>
              <th>In Progress</th>
              <th>Resolved</th>
              <th>Resolution Rate</th>
            </tr>
          </thead>
          <tbody>
            {clusters.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center text-muted py-4">
                  No GPS-tagged complaints found in the selected period.
                </td>
              </tr>
            ) : (
              clusters.map((cluster) => (
                <tr key={cluster.clusterId}>
                  <td>
                    <div className="geo-vicinity-cell">
                      <span className="geo-pin-icon">📍</span>
                      <div>
                        <strong>{cluster.sampleAddress || 'Municipal Sector'}</strong>
                        <span className="geo-cluster-sub">{cluster.clusterId}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <code className="coord-code">
                      {cluster.approxLatitude.toFixed(2)}, {cluster.approxLongitude.toFixed(2)}
                    </code>
                  </td>
                  <td>
                    <strong>{cluster.complaintCount}</strong>
                  </td>
                  <td>
                    <span className="category-pill-tag">{cluster.topCategory}</span>
                  </td>
                  <td>
                    <span className="count-pill pill-amber">{cluster.pending}</span>
                  </td>
                  <td>
                    <span className="count-pill pill-blue">{cluster.inProgress}</span>
                  </td>
                  <td>
                    <span className="count-pill pill-green">{cluster.resolved}</span>
                  </td>
                  <td>
                    <span className="font-semibold text-emerald">{cluster.resolutionRate}%</span>
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
          {data?.privacyNotice ||
            'Coordinates are aggregated to 2 decimal places (~1.1 km precision) to protect citizen privacy.'}
        </p>
      </div>
    </div>
  );
};

export default GeographicAnalytics;
