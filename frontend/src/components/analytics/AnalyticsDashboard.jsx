import React, { useState, useEffect, useCallback } from 'react';
import AnalyticsDateFilter from './AnalyticsDateFilter';
import AnalyticsKPICards from './AnalyticsKPICards';
import ComplaintTrendChart from './ComplaintTrendChart';
import ComplaintStatusChart from './ComplaintStatusChart';
import CategoryAnalytics from './CategoryAnalytics';
import DepartmentAnalytics from './DepartmentAnalytics';
import OfficerAnalytics from './OfficerAnalytics';
import ResolutionAnalytics from './ResolutionAnalytics';
import SeverityAnalytics from './SeverityAnalytics';
import GeographicAnalytics from './GeographicAnalytics';
import {
  getAdminAnalyticsOverviewApi,
  getAdminAnalyticsTrendsApi,
  getAdminAnalyticsCategoriesApi,
  getAdminAnalyticsDepartmentsApi,
  getAdminAnalyticsOfficersApi,
  getAdminAnalyticsResolutionApi,
  getAdminAnalyticsSeverityApi,
  getAdminAnalyticsGeographyApi,
  downloadAdminAnalyticsCsvApi
} from '../../services/api';

/**
 * AnalyticsDashboard Component
 * Master command center for municipal analytics, charts, department workloads, and data exports.
 */
export const AnalyticsDashboard = () => {
  // Navigation Sub-tab: 'all' | 'trends' | 'departments' | 'resolution' | 'severity' | 'geography'
  const [subTab, setSubTab] = useState('all');

  // Filter State
  const [range, setRange] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [trendInterval, setTrendInterval] = useState('daily');

  // Data States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState(null);

  const [overviewData, setOverviewData] = useState(null);
  const [trendsData, setTrendsData] = useState(null);
  const [categoriesData, setCategoriesData] = useState(null);
  const [departmentsData, setDepartmentsData] = useState(null);
  const [officersData, setOfficersData] = useState(null);
  const [resolutionData, setResolutionData] = useState(null);
  const [severityData, setSeverityData] = useState(null);
  const [geographyData, setGeographyData] = useState(null);

  // Fetch all analytics datasets
  const fetchAllAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    const queryOpts = {
      range,
      startDate: range === 'custom' ? startDate : undefined,
      endDate: range === 'custom' ? endDate : undefined,
      interval: trendInterval
    };

    try {
      const [
        overviewRes,
        trendsRes,
        categoriesRes,
        departmentsRes,
        officersRes,
        resolutionRes,
        severityRes,
        geographyRes
      ] = await Promise.all([
        getAdminAnalyticsOverviewApi(queryOpts),
        getAdminAnalyticsTrendsApi(queryOpts),
        getAdminAnalyticsCategoriesApi(queryOpts),
        getAdminAnalyticsDepartmentsApi(queryOpts),
        getAdminAnalyticsOfficersApi(queryOpts),
        getAdminAnalyticsResolutionApi(queryOpts),
        getAdminAnalyticsSeverityApi(queryOpts),
        getAdminAnalyticsGeographyApi(queryOpts)
      ]);

      if (overviewRes.success) setOverviewData(overviewRes.data);
      if (trendsRes.success) setTrendsData(trendsRes.data);
      if (categoriesRes.success) setCategoriesData(categoriesRes.data);
      if (departmentsRes.success) setDepartmentsData(departmentsRes.data);
      if (officersRes.success) setOfficersData(officersRes.data);
      if (resolutionRes.success) setResolutionData(resolutionRes.data);
      if (severityRes.success) setSeverityData(severityRes.data);
      if (geographyRes.success) setGeographyData(geographyRes.data);

      if (!overviewRes.success) {
        setError(overviewRes.error || 'Failed to load analytics overview');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching municipal analytics.');
    } finally {
      setLoading(false);
    }
  }, [range, startDate, endDate, trendInterval]);

  useEffect(() => {
    fetchAllAnalytics();
  }, [fetchAllAnalytics]);

  // Date Range Handlers
  const handleRangeChange = (newRange) => {
    setRange(newRange);
  };

  const handleApplyCustomDates = (start, end) => {
    setStartDate(start);
    setEndDate(end);
    setRange('custom');
  };

  const handleResetFilters = () => {
    setRange('30d');
    setStartDate('');
    setEndDate('');
    setTrendInterval('daily');
  };

  // CSV Export Handler
  const handleExportCsv = async (type = 'overview') => {
    setExporting(true);
    setExportFeedback(null);

    const result = await downloadAdminAnalyticsCsvApi({
      range,
      startDate: range === 'custom' ? startDate : undefined,
      endDate: range === 'custom' ? endDate : undefined,
      type
    });

    setExporting(false);
    if (result.success) {
      setExportFeedback({
        type: 'success',
        message: `Exported ${result.filename} successfully.`
      });
    } else {
      setExportFeedback({
        type: 'error',
        message: result.error || 'Failed to export CSV file.'
      });
    }

    setTimeout(() => setExportFeedback(null), 4000);
  };

  return (
    <div className="analytics-dashboard-container">
      {/* Top Controls Header */}
      <div className="analytics-top-header">
        <div className="analytics-header-titles">
          <span className="analytics-badge-pill">ADVANCED MUNICIPAL ANALYTICS</span>
          <h2 className="analytics-main-title">Operations &amp; Resolution Intelligence</h2>
          <p className="analytics-subtitle">
            Comprehensive intake velocity, departmental performance, turnarounds, and spatial trends.
          </p>
        </div>

        <div className="analytics-header-actions">
          {/* CSV Export Dropdown / Buttons */}
          <div className="export-btn-group">
            <button
              type="button"
              className="btn btn-outline btn-small"
              onClick={() => handleExportCsv('overview')}
              disabled={exporting || loading}
              title="Download aggregated metrics summary CSV"
            >
              {exporting ? '⏳ Exporting...' : '📥 Export Overview CSV'}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-small"
              onClick={() => handleExportCsv('departments')}
              disabled={exporting || loading}
              title="Download department performance CSV"
            >
              🏢 Depts CSV
            </button>
            <button
              type="button"
              className="btn btn-outline btn-small"
              onClick={() => handleExportCsv('trends')}
              disabled={exporting || loading}
              title="Download intake trends CSV"
            >
              📈 Trends CSV
            </button>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={fetchAllAnalytics}
            disabled={loading}
          >
            🔄 Refresh Analytics
          </button>
        </div>
      </div>

      {/* Export Notification Feedback Banner */}
      {exportFeedback && (
        <div className={`admin-feedback-banner feedback-${exportFeedback.type}`}>
          <span>{exportFeedback.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{exportFeedback.message}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="admin-feedback-banner feedback-error">
          <span>⚠️</span>
          <span>{error}</span>
          <button type="button" className="btn btn-small btn-outline ml-auto" onClick={fetchAllAnalytics}>
            Retry
          </button>
        </div>
      )}

      {/* Date Range Filter Bar */}
      <AnalyticsDateFilter
        activeRange={range}
        startDate={startDate}
        endDate={endDate}
        onChangeRange={handleRangeChange}
        onApplyCustomDates={handleApplyCustomDates}
        onReset={handleResetFilters}
        loading={loading}
      />

      {/* Analytics Sub-tabs Navigation */}
      <div className="analytics-subtabs-nav">
        <button
          type="button"
          className={`subtab-btn ${subTab === 'all' ? 'active' : ''}`}
          onClick={() => setSubTab('all')}
        >
          📊 Comprehensive View
        </button>
        <button
          type="button"
          className={`subtab-btn ${subTab === 'trends' ? 'active' : ''}`}
          onClick={() => setSubTab('trends')}
        >
          📈 Velocity &amp; Categories
        </button>
        <button
          type="button"
          className={`subtab-btn ${subTab === 'departments' ? 'active' : ''}`}
          onClick={() => setSubTab('departments')}
        >
          🏢 Department &amp; Staff
        </button>
        <button
          type="button"
          className={`subtab-btn ${subTab === 'resolution' ? 'active' : ''}`}
          onClick={() => setSubTab('resolution')}
        >
          ⏱️ Turnaround Durations
        </button>
        <button
          type="button"
          className={`subtab-btn ${subTab === 'severity' ? 'active' : ''}`}
          onClick={() => setSubTab('severity')}
        >
          🤖 AI Severity
        </button>
        <button
          type="button"
          className={`subtab-btn ${subTab === 'geography' ? 'active' : ''}`}
          onClick={() => setSubTab('geography')}
        >
          🗺️ Spatial Hot Spots
        </button>
      </div>

      {/* 1. Summary KPI Cards (Always visible in Comprehensive & Trends) */}
      {(subTab === 'all' || subTab === 'trends') && (
        <AnalyticsKPICards kpis={overviewData?.kpis} loading={loading} />
      )}

      {/* 2. Trends & Status Distribution */}
      {(subTab === 'all' || subTab === 'trends') && (
        <div className="analytics-two-col-grid">
          <ComplaintTrendChart
            trends={trendsData?.trends}
            interval={trendInterval}
            onChangeInterval={setTrendInterval}
            loading={loading}
          />
          <ComplaintStatusChart
            statusDistribution={overviewData?.statusDistribution}
            total={overviewData?.kpis?.totalComplaints?.value}
            loading={loading}
          />
        </div>
      )}

      {/* 3. Category Breakdown */}
      {(subTab === 'all' || subTab === 'trends') && (
        <CategoryAnalytics data={categoriesData} loading={loading} />
      )}

      {/* 4. Departments & Officers */}
      {(subTab === 'all' || subTab === 'departments') && (
        <>
          <DepartmentAnalytics data={departmentsData} loading={loading} />
          <OfficerAnalytics data={officersData} loading={loading} />
        </>
      )}

      {/* 5. Resolution Turnaround */}
      {(subTab === 'all' || subTab === 'resolution') && (
        <ResolutionAnalytics data={resolutionData} loading={loading} />
      )}

      {/* 6. AI Severity */}
      {(subTab === 'all' || subTab === 'severity') && (
        <SeverityAnalytics data={severityData} loading={loading} />
      )}

      {/* 7. Geographic Analytics */}
      {(subTab === 'all' || subTab === 'geography') && (
        <GeographicAnalytics data={geographyData} loading={loading} />
      )}
    </div>
  );
};

export default AnalyticsDashboard;
