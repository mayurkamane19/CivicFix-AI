import React from 'react';

/**
 * ResolutionAnalytics Component
 * Displays resolution time metrics, duration brackets, and category/department averages.
 */
export const ResolutionAnalytics = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="analytics-card resolution-analytics-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">Turnaround &amp; Resolution Duration</h3>
        </div>
        <div className="skeleton-line-tall" />
      </div>
    );
  }

  const summary = data?.summary || {};
  const brackets = data?.durationBrackets || {};
  const categoryResolution = data?.categoryResolution || [];
  const departmentResolution = data?.departmentResolution || [];

  const bracketList = [
    { key: 'under24Hours', label: '< 24 Hours', color: '#10b981', ...brackets.under24Hours },
    { key: 'oneToThreeDays', label: '1 – 3 Days', color: '#3b82f6', ...brackets.oneToThreeDays },
    { key: 'threeToSevenDays', label: '3 – 7 Days', color: '#f59e0b', ...brackets.threeToSevenDays },
    { key: 'overSevenDays', label: '> 7 Days', color: '#ef4444', ...brackets.overSevenDays }
  ];

  return (
    <div className="analytics-card resolution-analytics-card">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">Turnaround &amp; Resolution Duration</h3>
          <span className="analytics-card-subtitle">
            Lifecycle duration from citizen submission to verified resolution
          </span>
        </div>
        <span className="badge-highlight">
          Resolved Sample: <strong>{summary.totalResolved || 0} issues</strong>
        </span>
      </div>

      {/* 4 Summary Stat Mini-Cards */}
      <div className="resolution-mini-grid">
        <div className="res-stat-card">
          <span className="res-stat-label">Average Duration</span>
          <strong className="res-stat-val text-indigo">{summary.avgFormatted || '0 hrs'}</strong>
          <span className="res-stat-sub">({summary.avgHours || 0} decimal hours)</span>
        </div>
        <div className="res-stat-card">
          <span className="res-stat-label">Median Duration</span>
          <strong className="res-stat-val text-blue">{summary.medianFormatted || '0 hrs'}</strong>
          <span className="res-stat-sub">50th percentile threshold</span>
        </div>
        <div className="res-stat-card">
          <span className="res-stat-label">Fastest Resolution</span>
          <strong className="res-stat-val text-emerald">{summary.minFormatted || '0 hrs'}</strong>
          <span className="res-stat-sub">Minimum duration recorded</span>
        </div>
        <div className="res-stat-card">
          <span className="res-stat-label">Maximum Duration</span>
          <strong className="res-stat-val text-amber">{summary.maxFormatted || '0 hrs'}</strong>
          <span className="res-stat-sub">Longest complex ticket</span>
        </div>
      </div>

      {/* Duration Brackets Breakdown */}
      <div className="resolution-section-block">
        <h4 className="res-subheading">Turnaround Duration Brackets</h4>
        <div className="res-brackets-container">
          {bracketList.map((b) => (
            <div key={b.key} className="res-bracket-item">
              <div className="bracket-header">
                <span className="bracket-title">{b.label}</span>
                <span className="bracket-stats">
                  <strong>{b.count || 0}</strong> ({b.percentage || 0}%)
                </span>
              </div>
              <div className="bracket-progress-track">
                <div
                  className="bracket-progress-fill"
                  style={{
                    width: `${b.percentage || 0}%`,
                    backgroundColor: b.color
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Grid: Category vs Department Turnaround */}
      <div className="res-two-col-grid">
        {/* By Category */}
        <div className="res-sub-panel">
          <h4 className="res-subheading">Average Resolution by Category</h4>
          <div className="res-rank-list">
            {categoryResolution.length === 0 ? (
              <p className="text-muted text-center py-2">No resolved issues by category.</p>
            ) : (
              categoryResolution.map((c) => (
                <div key={c.category} className="res-rank-row">
                  <span className="rank-name">{c.category}</span>
                  <span className="rank-badge">{c.formatted} ({c.count} tickets)</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* By Department */}
        <div className="res-sub-panel">
          <h4 className="res-subheading">Average Resolution by Department</h4>
          <div className="res-rank-list">
            {departmentResolution.length === 0 ? (
              <p className="text-muted text-center py-2">No resolved issues by department.</p>
            ) : (
              departmentResolution.map((d) => (
                <div key={d.departmentName} className="res-rank-row">
                  <span className="rank-name">{d.departmentName}</span>
                  <span className="rank-badge">{d.formatted} ({d.count} tickets)</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="analytics-card-footer-note">
        <span>⏱️</span>
        <p>
          {data?.methodology ||
            "Resolution time is measured from complaint creation (createdAt) to the first recorded transition to 'Resolved' in status history. Unresolved issues are strictly excluded."}
        </p>
      </div>
    </div>
  );
};

export default ResolutionAnalytics;
