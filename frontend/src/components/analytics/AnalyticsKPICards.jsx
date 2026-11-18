import React from 'react';

/**
 * AnalyticsKPICards Component
 * Renders 8 high-level municipal KPI cards with period-over-period percentage comparisons.
 */
export const AnalyticsKPICards = ({ kpis, loading = false }) => {
  if (loading) {
    return (
      <div className="analytics-kpi-grid">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="analytics-kpi-card skeleton-card">
            <div className="skeleton-line-short" />
            <div className="skeleton-line-tall" />
            <div className="skeleton-line-med" />
          </div>
        ))}
      </div>
    );
  }

  if (!kpis) return null;

  const renderTrendBadge = (changePercent, isInverse = false) => {
    if (changePercent === null || changePercent === undefined) {
      return <span className="kpi-change-badge neutral">N/A</span>;
    }
    if (changePercent === 0) {
      return <span className="kpi-change-badge neutral">0.0%</span>;
    }

    const isPositive = changePercent > 0;
    // For pending, duplicates or high severity, an increase is undesirable (inverse)
    const isGood = isInverse ? !isPositive : isPositive;
    const badgeClass = isGood ? 'positive' : 'negative';
    const arrow = isPositive ? '▲' : '▼';

    return (
      <span className={`kpi-change-badge ${badgeClass}`}>
        {arrow} {Math.abs(changePercent)}%
      </span>
    );
  };

  const cards = [
    {
      id: 'total',
      label: 'Total Incidents',
      icon: '📋',
      value: kpis.totalComplaints?.value?.toLocaleString() || '0',
      badge: renderTrendBadge(kpis.totalComplaints?.changePercent),
      prevText: `vs ${kpis.totalComplaints?.prevValue || 0} prior`
    },
    {
      id: 'pending',
      label: 'Pending Triage',
      icon: '⏳',
      value: kpis.pendingComplaints?.value?.toLocaleString() || '0',
      badge: renderTrendBadge(kpis.pendingComplaints?.changePercent, true),
      prevText: `vs ${kpis.pendingComplaints?.prevValue || 0} prior`,
      accent: 'amber'
    },
    {
      id: 'inProgress',
      label: 'In Progress',
      icon: '⚙️',
      value: kpis.inProgressComplaints?.value?.toLocaleString() || '0',
      badge: renderTrendBadge(kpis.inProgressComplaints?.changePercent),
      prevText: `vs ${kpis.inProgressComplaints?.prevValue || 0} prior`,
      accent: 'blue'
    },
    {
      id: 'resolved',
      label: 'Resolved Issues',
      icon: '✅',
      value: kpis.resolvedComplaints?.value?.toLocaleString() || '0',
      badge: renderTrendBadge(kpis.resolvedComplaints?.changePercent),
      prevText: `vs ${kpis.resolvedComplaints?.prevValue || 0} prior`,
      accent: 'green'
    },
    {
      id: 'rate',
      label: 'Resolution Rate',
      icon: '📈',
      value: `${kpis.resolutionRate?.value ?? 0}%`,
      badge: renderTrendBadge(kpis.resolutionRate?.changePercent),
      prevText: `vs ${kpis.resolutionRate?.prevValue ?? 0}% prior`,
      accent: 'teal'
    },
    {
      id: 'avgTime',
      label: 'Avg Resolution Time',
      icon: '⏱️',
      value: kpis.avgResolutionTime?.formatted || '0 hrs',
      badge: (
        <span className="kpi-change-badge neutral">
          Median: {kpis.avgResolutionTime?.medianFormatted || '0 hrs'}
        </span>
      ),
      prevText: `${kpis.avgResolutionTime?.resolvedSampleCount || 0} resolved tickets sampled`
    },
    {
      id: 'highCrit',
      label: 'High / Critical Severity',
      icon: '🚨',
      value: kpis.highCriticalSeverity?.value?.toLocaleString() || '0',
      badge: renderTrendBadge(kpis.highCriticalSeverity?.changePercent, true),
      prevText: `vs ${kpis.highCriticalSeverity?.prevValue || 0} prior`,
      accent: 'red'
    },
    {
      id: 'duplicates',
      label: 'Potential Duplicates',
      icon: '🔍',
      value: kpis.potentialDuplicates?.value?.toLocaleString() || '0',
      badge: renderTrendBadge(kpis.potentialDuplicates?.changePercent, true),
      prevText: `vs ${kpis.potentialDuplicates?.prevValue || 0} prior`
    }
  ];

  return (
    <div className="analytics-kpi-grid">
      {cards.map((card) => (
        <div key={card.id} className={`analytics-kpi-card ${card.accent ? `accent-${card.accent}` : ''}`}>
          <div className="kpi-header">
            <span className="kpi-icon">{card.icon}</span>
            <span className="kpi-label">{card.label}</span>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">{card.value}</span>
            {card.badge}
          </div>
          <div className="kpi-footer">
            <span className="kpi-prev-text">{card.prevText}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AnalyticsKPICards;
