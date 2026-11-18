import React, { useState } from 'react';

/**
 * ComplaintTrendChart Component
 * Pure SVG interactive time-series chart showing complaint submissions and resolutions.
 */
export const ComplaintTrendChart = ({
  trends = [],
  interval = 'daily',
  onChangeInterval,
  loading = false
}) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (loading) {
    return (
      <div className="analytics-card trend-chart-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">Incident Intake &amp; Resolution Velocity</h3>
        </div>
        <div className="chart-skeleton-container">
          <div className="skeleton-bar" style={{ height: '40%' }} />
          <div className="skeleton-bar" style={{ height: '70%' }} />
          <div className="skeleton-bar" style={{ height: '55%' }} />
          <div className="skeleton-bar" style={{ height: '85%' }} />
          <div className="skeleton-bar" style={{ height: '60%' }} />
        </div>
      </div>
    );
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="analytics-card trend-chart-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">Incident Intake &amp; Resolution Velocity</h3>
        </div>
        <div className="analytics-empty-state">
          <span>📊</span>
          <p>No complaint records found in the selected time window.</p>
        </div>
      </div>
    );
  }

  // Chart dimensions & scaling
  const width = 800;
  const height = 280;
  const padding = { top: 30, right: 30, bottom: 45, left: 45 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Find max value across all data points for Y-axis scaling
  const maxVal = Math.max(
    1,
    ...trends.map((d) => Math.max(d.submitted || 0, d.resolved || 0, d.pending || 0))
  );

  // Nice round max tick
  const yTicksCount = 4;
  const yTickMax = Math.ceil(maxVal / yTicksCount) * yTicksCount || 4;

  const getX = (index) => {
    if (trends.length <= 1) return padding.left + plotWidth / 2;
    return padding.left + (index / (trends.length - 1)) * plotWidth;
  };

  const getY = (val) => {
    return padding.top + plotHeight - (val / yTickMax) * plotHeight;
  };

  // Build SVG path strings for Line series
  const submittedPoints = trends.map((d, i) => `${getX(i)},${getY(d.submitted || 0)}`).join(' ');
  const resolvedPoints = trends.map((d, i) => `${getX(i)},${getY(d.resolved || 0)}`).join(' ');

  // Compute X-axis label skip step to prevent label overlap
  const maxLabels = 8;
  const labelStep = Math.max(1, Math.ceil(trends.length / maxLabels));

  return (
    <div className="analytics-card trend-chart-card">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">Incident Intake &amp; Resolution Velocity</h3>
          <span className="analytics-card-subtitle">
            Time-series volume comparing submitted vs resolved issues
          </span>
        </div>
        <div className="chart-header-actions">
          {onChangeInterval && (
            <div className="btn-group-toggle">
              <button
                type="button"
                className={`btn-toggle ${interval === 'daily' ? 'active' : ''}`}
                onClick={() => onChangeInterval('daily')}
              >
                Daily
              </button>
              <button
                type="button"
                className={`btn-toggle ${interval === 'monthly' ? 'active' : ''}`}
                onClick={() => onChangeInterval('monthly')}
              >
                Monthly
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chart Legend */}
      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-color-dot color-submitted" /> Submissions
        </span>
        <span className="legend-item">
          <span className="legend-color-dot color-resolved" /> Resolved
        </span>
        <span className="legend-item">
          <span className="legend-color-dot color-pending" /> Pending Backlog
        </span>
      </div>

      {/* SVG Canvas */}
      <div className="chart-svg-wrapper">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="analytics-trend-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Y-axis Grid Lines & Labels */}
          {Array.from({ length: yTicksCount + 1 }).map((_, i) => {
            const tickVal = Math.round((yTickMax / yTicksCount) * i);
            const y = getY(tickVal);
            return (
              <g key={`y-tick-${i}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="var(--border-color, #e5e7eb)"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--text-muted, #6b7280)"
                >
                  {tickVal}
                </text>
              </g>
            );
          })}

          {/* Area Fill for Submissions */}
          {trends.length > 1 && (
            <polygon
              points={`${getX(0)},${getY(0)} ${submittedPoints} ${getX(trends.length - 1)},${getY(0)}`}
              fill="rgba(79, 70, 229, 0.08)"
            />
          )}

          {/* Polyline: Submissions */}
          <polyline
            fill="none"
            stroke="#4f46e5"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={submittedPoints}
          />

          {/* Polyline: Resolved */}
          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="5 3"
            points={resolvedPoints}
          />

          {/* Data Points (Dots & Hover Targets) */}
          {trends.map((d, i) => {
            const x = getX(i);
            const ySub = getY(d.submitted || 0);
            const yRes = getY(d.resolved || 0);
            const isHovered = hoveredPoint?.index === i;

            return (
              <g key={`pt-${i}`}>
                {/* Visual Circle Dots */}
                <circle
                  cx={x}
                  cy={ySub}
                  r={isHovered ? 5 : 3}
                  fill="#4f46e5"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <circle
                  cx={x}
                  cy={yRes}
                  r={isHovered ? 5 : 3}
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />

                {/* Vertical Cursor on Hover */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={height - padding.bottom}
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Transparent Hover Hitbox */}
                <rect
                  x={x - (plotWidth / (trends.length * 2) || 10)}
                  y={padding.top}
                  width={plotWidth / trends.length || 20}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredPoint({ ...d, index: i, x, ySub, yRes })}
                  onMouseLeave={() => setHoveredPoint(null)}
                  style={{ cursor: 'pointer' }}
                />

                {/* X-axis Date Labels */}
                {i % labelStep === 0 && (
                  <text
                    x={x}
                    y={height - padding.bottom + 20}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--text-muted, #6b7280)"
                  >
                    {d.date?.slice(5) || d.date}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip Box */}
        {hoveredPoint && (
          <div
            className="chart-floating-tooltip"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: '15%'
            }}
          >
            <div className="tooltip-date">{hoveredPoint.date}</div>
            <div className="tooltip-metric text-indigo">
              <span>Submissions:</span> <strong>{hoveredPoint.submitted || 0}</strong>
            </div>
            <div className="tooltip-metric text-emerald">
              <span>Resolved:</span> <strong>{hoveredPoint.resolved || 0}</strong>
            </div>
            <div className="tooltip-metric text-amber">
              <span>Pending:</span> <strong>{hoveredPoint.pending || 0}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComplaintTrendChart;
