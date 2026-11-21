import React, { useState, useEffect, useCallback } from 'react';
import { getWardsApi, getWardAnalyticsApi, exportMunicipalWardCsvApi } from '../../services/api';
import './ward.css';

/**
 * WardAnalyticsTab
 * Deep-dive analytical reporting, department workload breakdown, and CSV data export for municipal wards
 */
export const WardAnalyticsTab = ({ initialWardId }) => {
  const [wards, setWards] = useState([]);
  const [selectedWardId, setSelectedWardId] = useState(initialWardId || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  // Load active wards for dropdown
  useEffect(() => {
    const fetchWards = async () => {
      const res = await getWardsApi({ limit: 100 });
      if (res.success && res.data && res.data.length > 0) {
        setWards(res.data);
        if (!selectedWardId) {
          setSelectedWardId(res.data[0].id);
        }
      }
    };
    fetchWards();
  }, [selectedWardId]);

  const fetchAnalytics = useCallback(async () => {
    if (!selectedWardId) return;

    setLoading(true);
    setError(null);
    const res = await getWardAnalyticsApi(selectedWardId, { startDate, endDate });
    setLoading(false);

    if (res.success && res.data) {
      setAnalytics(res.data);
    } else {
      setError(res.error || 'Failed to retrieve ward analytics');
    }
  }, [selectedWardId, startDate, endDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExportCsv = async () => {
    setExporting(true);
    setError(null);

    const res = await exportMunicipalWardCsvApi({
      wardId: selectedWardId,
      startDate,
      endDate
    });
    setExporting(false);

    if (res.success && res.blob) {
      const url = window.URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || 'civicfix_municipal_report.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } else {
      setError(res.error || 'Failed to download municipal report CSV');
    }
  };

  const categories = analytics?.categories || {};
  const departments = analytics?.departments || {};
  const perf = analytics?.performance || { total: 0, overdue: 0, slaComplianceRate: 100, avgResolutionHours: 0 };
  const feedback = analytics?.citizenFeedback || { totalFeedback: 0, avgRating: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Analytics Controls Bar */}
      <div className="ward-filter-toolbar" style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.2rem' }}>
              Select Ward
            </label>
            <select
              className="ward-filter-select"
              value={selectedWardId}
              onChange={(e) => setSelectedWardId(e.target.value)}
            >
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} - {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.2rem' }}>
              From Date
            </label>
            <input
              type="date"
              className="ward-search-input"
              style={{ minWidth: '140px', padding: '0.45rem 0.65rem' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.2rem' }}>
              To Date
            </label>
            <input
              type="date"
              className="ward-search-input"
              style={{ minWidth: '140px', padding: '0.45rem 0.65rem' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-small"
            style={{ marginTop: '1.1rem' }}
            onClick={fetchAnalytics}
          >
            Apply Filters
          </button>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}
          onClick={handleExportCsv}
          disabled={exporting}
        >
          <span>📥</span> {exporting ? 'Generating CSV...' : 'Export Municipal CSV'}
        </button>
      </div>

      {error && <div className="alert-error" style={{ padding: '0.75rem', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c' }}>{error}</div>}

      {/* KPI Cards */}
      <div className="municipal-kpi-grid">
        <div className="municipal-kpi-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div className="municipal-kpi-label">Ward Issues Evaluated</div>
          <div className="municipal-kpi-value">{perf.total}</div>
          <div className="municipal-kpi-sub">Within selected date range</div>
        </div>

        <div className="municipal-kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="municipal-kpi-label">SLA Compliance Rate</div>
          <div className="municipal-kpi-value" style={{ color: perf.slaComplianceRate >= 80 ? '#10b981' : '#ef4444' }}>
            {perf.slaComplianceRate}%
          </div>
          <div className="municipal-kpi-sub" style={{ color: perf.overdue > 0 ? '#ef4444' : '#10b981' }}>
            {perf.overdue} overdue tickets
          </div>
        </div>

        <div className="municipal-kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="municipal-kpi-label">Avg Resolution Time</div>
          <div className="municipal-kpi-value">{perf.avgResolutionHours}h</div>
          <div className="municipal-kpi-sub" style={{ color: '#64748b' }}>Hours from creation to resolve</div>
        </div>

        <div className="municipal-kpi-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="municipal-kpi-label">Citizen Feedback</div>
          <div className="municipal-kpi-value">
            {feedback.avgRating > 0 ? `${feedback.avgRating} ★` : 'N/A'}
          </div>
          <div className="municipal-kpi-sub" style={{ color: '#8b5cf6' }}>
            Based on {feedback.totalFeedback} citizen ratings
          </div>
        </div>
      </div>

      {/* Breakdown Grids */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* Categories Breakdown */}
        <div className="ward-table-card" style={{ padding: '1.25rem' }}>
          <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#0f172a' }}>Complaints by Civic Category</h4>
          {Object.keys(categories).length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '0.85rem' }}>No category records in this date window.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(categories).map(([cat, count]) => {
                const pct = perf.total > 0 ? Math.round((count / perf.total) * 100) : 0;
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                      <strong>{cat}</strong>
                      <span style={{ color: '#64748b' }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#2563eb', borderRadius: '999px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Departments Breakdown */}
        <div className="ward-table-card" style={{ padding: '1.25rem' }}>
          <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#0f172a' }}>Department Workload in Ward</h4>
          {Object.keys(departments).length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '0.85rem' }}>No department assignments recorded.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(departments).map(([dept, count]) => {
                const pct = perf.total > 0 ? Math.round((count / perf.total) * 100) : 0;
                return (
                  <div key={dept}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                      <strong>{dept}</strong>
                      <span style={{ color: '#64748b' }}>{count} issues ({pct}%)</span>
                    </div>
                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#0284c7', borderRadius: '999px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WardAnalyticsTab;
