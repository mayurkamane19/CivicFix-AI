import React, { useState } from 'react';

/**
 * MapLegend Component
 * Displays a clean, expandable visual color guide for complaint status and clusters.
 */
export const MapLegend = ({ totalMarkers = 0, totalClusters = 0 }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`map-legend-card ${collapsed ? 'legend-collapsed' : ''}`}>
      <div className="map-legend-header" onClick={() => setCollapsed(!collapsed)}>
        <span className="legend-title">🗺️ Map Legend</span>
        <button
          type="button"
          className="legend-toggle-btn"
          aria-label={collapsed ? 'Expand map legend' : 'Collapse map legend'}
        >
          {collapsed ? '▲' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div className="map-legend-body">
          <div className="legend-item">
            <span className="legend-dot dot-pending" />
            <span className="legend-label">Pending Triage</span>
          </div>

          <div className="legend-item">
            <span className="legend-dot dot-progress" />
            <span className="legend-label">In Progress (Field Work)</span>
          </div>

          <div className="legend-item">
            <span className="legend-dot dot-resolved" />
            <span className="legend-label">Resolved</span>
          </div>

          <div className="legend-item">
            <span className="legend-cluster-icon">5+</span>
            <span className="legend-label">Issue Cluster (Click to Zoom)</span>
          </div>

          <div className="legend-footer-stats">
            <span>Points on map: <strong>{totalMarkers}</strong></span>
            {totalClusters > 0 && (
              <span>Active clusters: <strong>{totalClusters}</strong></span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapLegend;
