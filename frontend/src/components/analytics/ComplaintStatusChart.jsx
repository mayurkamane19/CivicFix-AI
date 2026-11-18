import React from 'react';

/**
 * ComplaintStatusChart Component
 * Pure SVG Donut Chart showing breakdown of Pending, In Progress, and Resolved complaints.
 */
export const ComplaintStatusChart = ({ statusDistribution = [], total = 0, loading = false }) => {
  if (loading) {
    return (
      <div className="analytics-card status-chart-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">Resolution Pipeline Status</h3>
        </div>
        <div className="chart-skeleton-circle" />
      </div>
    );
  }

  const items = statusDistribution || [];
  const totalCount = total > 0 ? total : items.reduce((acc, curr) => acc + (curr.count || 0), 0);

  // Status color map
  const statusColors = {
    Pending: '#f59e0b', // Amber
    'In Progress': '#2563eb', // Royal Blue
    Resolved: '#10b981' // Emerald
  };

  // Compute SVG Donut segments
  const size = 200;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;
  const segments = items.map((item) => {
    const count = item.count || 0;
    const percent = totalCount > 0 ? (count / totalCount) * 100 : 0;
    const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += percent;

    return {
      status: item.status,
      count,
      percent: Math.round(percent * 10) / 10,
      color: statusColors[item.status] || '#6b7280',
      strokeDasharray,
      strokeDashoffset
    };
  });

  return (
    <div className="analytics-card status-chart-card">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">Resolution Pipeline Status</h3>
          <span className="analytics-card-subtitle">Current workflow distribution</span>
        </div>
      </div>

      <div className="status-donut-container">
        {/* SVG Donut */}
        <div className="donut-svg-wrapper">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="status-donut-svg">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="var(--border-color, #f3f4f6)"
              strokeWidth={strokeWidth}
            />
            {totalCount > 0 &&
              segments.map((seg) => (
                <circle
                  key={seg.status}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  style={{ transition: 'stroke-dasharray 0.4s ease' }}
                />
              ))}
          </svg>
          <div className="donut-center-label">
            <span className="donut-total-count">{totalCount}</span>
            <span className="donut-total-text">Incidents</span>
          </div>
        </div>

        {/* Legend List */}
        <div className="donut-legend-list">
          {segments.map((seg) => (
            <div key={seg.status} className="donut-legend-row">
              <div className="legend-status-title">
                <span className="legend-dot" style={{ backgroundColor: seg.color }} />
                <span className="legend-name">{seg.status}</span>
              </div>
              <div className="legend-status-values">
                <strong className="legend-count">{seg.count}</strong>
                <span className="legend-pct">({seg.percent}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ComplaintStatusChart;
