import React from 'react';

/**
 * ComplaintFilters Component
 * Provides comprehensive search and filtering controls for municipal admins
 */
export const ComplaintFilters = ({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  status,
  onStatusChange,
  severity,
  onSeverityChange,
  department = 'all',
  onDepartmentChange,
  departments = [],
  sortBy,
  onSortByChange,
  onResetFilters,
  totalResults
}) => {
  const categories = [
    { label: 'All Categories', value: 'all' },
    { label: 'Road Damage', value: 'Road Damage' },
    { label: 'Garbage', value: 'Garbage' },
    { label: 'Water Leakage', value: 'Water Leakage' },
    { label: 'Streetlight', value: 'Streetlight' },
    { label: 'Drainage', value: 'Drainage' },
    { label: 'Other', value: 'Other' }
  ];

  const statuses = [
    { label: 'All Statuses', value: 'all' },
    { label: 'Pending', value: 'Pending' },
    { label: 'In Progress', value: 'In Progress' },
    { label: 'Resolved', value: 'Resolved' }
  ];

  const severities = [
    { label: 'All AI Severities', value: 'all' },
    { label: 'Critical', value: 'Critical' },
    { label: 'High', value: 'High' },
    { label: 'Medium', value: 'Medium' },
    { label: 'Low', value: 'Low' }
  ];

  const sortOptions = [
    { label: 'Newest First', value: 'newest' },
    { label: 'Oldest First', value: 'oldest' }
  ];

  const isFiltered =
    Boolean(search) ||
    category !== 'all' ||
    status !== 'all' ||
    severity !== 'all' ||
    (department && department !== 'all') ||
    sortBy !== 'newest';

  return (
    <div className="complaint-filters-card">
      <div className="filters-grid">
        {/* Search input */}
        <div className="filter-group search-group">
          <label htmlFor="filter-search" className="filter-label">
            Search
          </label>
          <div className="search-input-wrapper">
            <svg
              className="search-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="filter-search"
              type="text"
              className="filter-input search-input"
              placeholder="Search by ID, title, or address..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => onSearchChange('')}
                title="Clear search text"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Category dropdown */}
        <div className="filter-group">
          <label htmlFor="filter-category" className="filter-label">
            Category
          </label>
          <select
            id="filter-category"
            className="filter-select"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status dropdown */}
        <div className="filter-group">
          <label htmlFor="filter-status" className="filter-label">
            Status
          </label>
          <select
            id="filter-status"
            className="filter-select"
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Severity dropdown */}
        <div className="filter-group">
          <label htmlFor="filter-severity" className="filter-label">
            AI Severity
          </label>
          <select
            id="filter-severity"
            className="filter-select"
            value={severity}
            onChange={(e) => onSeverityChange(e.target.value)}
          >
            {severities.map((sev) => (
              <option key={sev.value} value={sev.value}>
                {sev.label}
              </option>
            ))}
          </select>
        </div>

        {/* Department dropdown */}
        {departments && departments.length > 0 && (
          <div className="filter-group">
            <label htmlFor="filter-department" className="filter-label">
              Department
            </label>
            <select
              id="filter-department"
              className="filter-select"
              value={department}
              onChange={(e) => onDepartmentChange && onDepartmentChange(e.target.value)}
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sort By dropdown */}
        <div className="filter-group">
          <label htmlFor="filter-sort" className="filter-label">
            Sort Order
          </label>
          <select
            id="filter-sort"
            className="filter-select"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
          >
            {sortOptions.map((so) => (
              <option key={so.value} value={so.value}>
                {so.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter toolbar summary */}
      <div className="filters-footer">
        <div className="filters-count">
          Showing <strong>{totalResults}</strong> matching complaints
        </div>

        {isFiltered && (
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={onResetFilters}
          >
            ↺ Reset Filters
          </button>
        )}
      </div>
    </div>
  );
};

export default ComplaintFilters;
