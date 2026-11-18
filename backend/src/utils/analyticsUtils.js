/**
 * CivicFix AI - Analytics Utilities
 * Helper functions for date math, metric formatting, percentage change calculations,
 * and CSV formula injection sanitization.
 */

/**
 * Parses and bounds a date range parameter
 * @param {object} options
 * @param {string} [options.range='30d'] - Preset: '7d', '30d', '90d', '180d', 'all', 'custom'
 * @param {string} [options.startDate] - ISO date string for custom range
 * @param {string} [options.endDate] - ISO date string for custom range
 * @returns {object} { startDate: Date|null, endDate: Date|null, prevStartDate: Date|null, prevEndDate: Date|null, range: string, label: string }
 */
export const parseDateRange = ({ range = '30d', startDate, endDate } = {}) => {
  const now = new Date();
  let start = null;
  let end = new Date(now);

  const normalizedRange = String(range || '30d').toLowerCase().trim();

  if (normalizedRange === '7d') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (normalizedRange === '30d') {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (normalizedRange === '90d') {
    start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  } else if (normalizedRange === '180d') {
    start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  } else if (normalizedRange === 'all') {
    start = null;
    end = null;
  } else if (normalizedRange === 'custom') {
    if (startDate) {
      const parsedStart = new Date(startDate);
      if (!isNaN(parsedStart.getTime())) {
        start = parsedStart;
      }
    }
    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (!isNaN(parsedEnd.getTime())) {
        // Set end of day (23:59:59.999) for inclusive custom end date
        end = new Date(parsedEnd.setHours(23, 59, 59, 999));
      }
    }
    // If start is after end, fallback to last 30 days
    if (start && end && start > end) {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      end = new Date(now);
    }
  } else {
    // Default fallback to 30 days
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  // Calculate equivalent previous baseline period for comparison
  let prevStart = null;
  let prevEnd = null;

  if (start && end) {
    const durationMs = end.getTime() - start.getTime();
    prevEnd = new Date(start.getTime());
    prevStart = new Date(start.getTime() - durationMs);
  }

  let label = 'Last 30 Days';
  if (normalizedRange === '7d') label = 'Last 7 Days';
  else if (normalizedRange === '90d') label = 'Last 90 Days';
  else if (normalizedRange === '180d') label = 'Last 6 Months';
  else if (normalizedRange === 'all') label = 'All Time';
  else if (normalizedRange === 'custom') label = 'Custom Range';

  return {
    startDate: start,
    endDate: end,
    prevStartDate: prevStart,
    prevEndDate: prevEnd,
    range: normalizedRange,
    label
  };
};

/**
 * Calculates percentage change between current and previous periods
 * @param {number} current
 * @param {number} previous
 * @returns {number|null} Returns rounded percentage or null if no baseline
 */
export const calculatePercentageChange = (current = 0, previous = 0) => {
  const curr = Number(current) || 0;
  const prev = Number(previous) || 0;

  if (prev === 0) {
    if (curr === 0) return 0;
    return null; // Distinguish undefined percentage (division by 0) from 0%
  }

  const change = ((curr - prev) / prev) * 100;
  return Math.round(change * 10) / 10;
};

/**
 * Calculates resolution rate percentage
 * @param {number} resolvedCount
 * @param {number} totalCount
 * @returns {number} Percentage rounded to 1 decimal place (0 to 100)
 */
export const calculateResolutionRate = (resolvedCount = 0, totalCount = 0) => {
  const resolved = Number(resolvedCount) || 0;
  const total = Number(totalCount) || 0;

  if (total <= 0) return 0;
  const rate = (resolved / total) * 100;
  return Math.min(100, Math.max(0, Math.round(rate * 10) / 10));
};

/**
 * Calculates the mathematical median from a list of numbers
 * @param {number[]} values
 * @returns {number}
 */
export const calculateMedian = (values = []) => {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const validNumbers = values.filter((v) => typeof v === 'number' && !isNaN(v) && v >= 0);
  if (validNumbers.length === 0) return 0;

  const sorted = [...validNumbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 !== 0) {
    return Math.round(sorted[mid] * 10) / 10;
  }
  return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
};

/**
 * Human-friendly duration string
 * @param {number} hours
 * @returns {string}
 */
export const formatDurationHours = (hours) => {
  if (typeof hours !== 'number' || isNaN(hours) || hours <= 0) {
    return '0 hrs';
  }
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins} min${mins === 1 ? '' : 's'}`;
  }
  if (hours < 24) {
    return `${Math.round(hours * 10) / 10} hrs`;
  }
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days} day${days === 1 ? '' : 's'}`;
};

/**
 * Sanitizes a single cell value for CSV export to prevent Formula Injection (CSV Injection)
 * Prefixes a single quote if the string begins with =, +, -, @, \t, or \r
 * @param {any} value
 * @returns {string}
 */
export const sanitizeCsvValue = (value) => {
  if (value === null || value === undefined) return '""';
  let str = String(value);

  // Check for CSV Formula Injection prefixes
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape existing double quotes by doubling them
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
};
