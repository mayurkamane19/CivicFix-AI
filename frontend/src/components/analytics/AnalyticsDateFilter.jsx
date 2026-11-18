import React, { useState } from 'react';

/**
 * AnalyticsDateFilter Component
 * Provides preset buttons (7d, 30d, 90d, 180d, All Time) and custom date pickers.
 */
export const AnalyticsDateFilter = ({
  activeRange = '30d',
  startDate = '',
  endDate = '',
  onChangeRange,
  onApplyCustomDates,
  onReset,
  loading = false
}) => {
  const [isCustomOpen, setIsCustomOpen] = useState(activeRange === 'custom');
  const [customStart, setCustomStart] = useState(startDate);
  const [customEnd, setCustomEnd] = useState(endDate);

  const presets = [
    { key: '7d', label: 'Last 7 Days' },
    { key: '30d', label: 'Last 30 Days' },
    { key: '90d', label: 'Last 90 Days' },
    { key: '180d', label: 'Last 6 Months' },
    { key: 'all', label: 'All Time' }
  ];

  const handlePresetClick = (key) => {
    setIsCustomOpen(false);
    onChangeRange(key);
  };

  const handleCustomToggle = () => {
    setIsCustomOpen(true);
    onChangeRange('custom');
  };

  const handleApplyCustom = (e) => {
    e.preventDefault();
    if (customStart && customEnd) {
      onApplyCustomDates(customStart, customEnd);
    }
  };

  return (
    <div className="analytics-date-filter-bar">
      <div className="analytics-filter-presets">
        <span className="analytics-filter-label">📅 Period:</span>
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`btn-filter-preset ${activeRange === p.key && !isCustomOpen ? 'active' : ''}`}
            onClick={() => handlePresetClick(p.key)}
            disabled={loading}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className={`btn-filter-preset ${isCustomOpen || activeRange === 'custom' ? 'active' : ''}`}
          onClick={handleCustomToggle}
          disabled={loading}
        >
          Custom Range...
        </button>
      </div>

      {isCustomOpen && (
        <form className="analytics-custom-date-form" onSubmit={handleApplyCustom}>
          <div className="custom-date-inputs">
            <label>
              From:
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                required
                disabled={loading}
              />
            </label>
            <label>
              To:
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                required
                disabled={loading}
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary btn-small"
              disabled={loading || !customStart || !customEnd}
            >
              Apply Filter
            </button>
            <button
              type="button"
              className="btn btn-outline btn-small"
              onClick={onReset}
              disabled={loading}
            >
              Reset
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AnalyticsDateFilter;
