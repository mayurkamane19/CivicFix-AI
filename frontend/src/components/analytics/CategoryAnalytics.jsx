import React from 'react';

/**
 * CategoryAnalytics Component
 * Displays complaint category distribution, resolution efficiency, and status breakdowns.
 */
export const CategoryAnalytics = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="analytics-card category-analytics-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">Incidents by Category</h3>
        </div>
        <div className="skeleton-line-tall" />
        <div className="skeleton-line-tall" />
        <div className="skeleton-line-tall" />
      </div>
    );
  }

  const categories = data?.categories || [];
  const mostReported = data?.mostReportedCategory;
  const total = data?.totalComplaints || 0;

  if (categories.length === 0) {
    return (
      <div className="analytics-card category-analytics-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">Incidents by Category</h3>
        </div>
        <div className="analytics-empty-state">
          <span>📂</span>
          <p>No category records found for this period.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-card category-analytics-card">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">Incidents by Category</h3>
          <span className="analytics-card-subtitle">
            Municipal category volume and resolution performance
          </span>
        </div>
        {mostReported && (
          <span className="badge-highlight">
            Top Incident Type: <strong>{mostReported}</strong>
          </span>
        )}
      </div>

      <div className="category-bars-table">
        {categories.map((cat) => (
          <div key={cat.category} className="category-row-item">
            <div className="category-meta-header">
              <span className="category-name">{cat.category}</span>
              <div className="category-stats-summary">
                <strong className="category-count">{cat.count}</strong>
                <span className="category-share">({cat.percentage}% of total)</span>
                <span className="category-res-rate">
                  • {cat.resolutionRate}% resolved
                </span>
              </div>
            </div>

            {/* Horizontal Stacked Volume Bar */}
            <div className="category-progress-track">
              <div
                className="category-progress-fill color-resolved"
                style={{
                  width: `${cat.count > 0 ? (cat.resolved / cat.count) * 100 : 0}%`
                }}
                title={`Resolved: ${cat.resolved}`}
              />
              <div
                className="category-progress-fill color-inprogress"
                style={{
                  width: `${cat.count > 0 ? (cat.inProgress / cat.count) * 100 : 0}%`
                }}
                title={`In Progress: ${cat.inProgress}`}
              />
              <div
                className="category-progress-fill color-pending"
                style={{
                  width: `${cat.count > 0 ? (cat.pending / cat.count) * 100 : 0}%`
                }}
                title={`Pending: ${cat.pending}`}
              />
            </div>

            {/* Status counts subtext */}
            <div className="category-status-chips">
              <span className="chip-sub chip-pending">Pending: {cat.pending}</span>
              <span className="chip-sub chip-inprogress">In Progress: {cat.inProgress}</span>
              <span className="chip-sub chip-resolved">Resolved: {cat.resolved}</span>
              {cat.highCritical > 0 && (
                <span className="chip-sub chip-critical">
                  🚨 High/Crit: {cat.highCritical}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoryAnalytics;
