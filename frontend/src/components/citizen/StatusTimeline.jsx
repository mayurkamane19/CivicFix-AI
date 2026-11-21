import React from 'react';

const STATUS_ICONS = {
  'Pending': { icon: '🕐', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  'Assigned': { icon: '📋', color: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd' },
  'In Progress': { icon: '🔧', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  'Resolved': { icon: '✅', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
  'Reopened': { icon: '↩️', color: '#f43f5e', bg: '#fff1f2', border: '#fecdd3' },
  'Under Administrative Review': { icon: '⚖️', color: '#a855f7', bg: '#faf5ff', border: '#e9d5ff' },
  'Awaiting Verification': { icon: '👁️', color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
  'Closed': { icon: '🔒', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
};

const DEFAULT_STATUS_STYLE = { icon: '•', color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0' };

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

/**
 * StatusTimeline — vertical timeline of status history entries.
 * Props:
 *   entries  : Array<{ newStatus, timestamp, changedBy?, note?, description? }>
 *   submittedAt : ISO date string for initial submission event
 *   mostRecentFirst : boolean (default true)
 */
const StatusTimeline = ({
  entries = [],
  submittedAt = null,
  mostRecentFirst = true,
}) => {
  // Build a combined list: initial submission + history transitions
  const submissionEntry = submittedAt
    ? {
        newStatus: 'Pending',
        timestamp: submittedAt,
        description: 'Issue reported and registered in municipal system.',
        isInitial: true,
      }
    : null;

  const allEntries = submissionEntry
    ? [submissionEntry, ...entries]
    : [...entries];

  const sorted = mostRecentFirst ? [...allEntries].reverse() : allEntries;

  if (sorted.length === 0) {
    return (
      <div className="status-timeline-empty">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>No status history available yet.</span>
      </div>
    );
  }

  return (
    <div className="status-timeline">
      {sorted.map((entry, idx) => {
        const statusKey = entry.newStatus || entry.status || 'Pending';
        const style = STATUS_ICONS[statusKey] || DEFAULT_STATUS_STYLE;
        const isLast = idx === sorted.length - 1;

        return (
          <div key={idx} className={`status-timeline-entry ${entry.isInitial ? 'timeline-entry-initial' : ''}`}>
            {/* Connector line */}
            {!isLast && <div className="timeline-connector-line" style={{ borderColor: style.border }} />}

            {/* Icon dot */}
            <div
              className="timeline-dot"
              style={{ background: style.bg, border: `2px solid ${style.border}`, color: style.color }}
              title={statusKey}
            >
              <span className="timeline-dot-icon">{style.icon}</span>
            </div>

            {/* Entry body */}
            <div className="timeline-entry-body">
              <div className="timeline-entry-header">
                <span
                  className="timeline-status-label"
                  style={{ color: style.color, background: style.bg, border: `1px solid ${style.border}` }}
                >
                  {statusKey}
                </span>
                {entry.timestamp && (
                  <span className="timeline-entry-date">{formatDate(entry.timestamp)}</span>
                )}
              </div>

              {(entry.description || entry.note) && (
                <p className="timeline-entry-description">
                  {entry.description || entry.note}
                </p>
              )}

              {entry.changedBy && !entry.isInitial && (
                <span className="timeline-entry-actor">Updated by: {entry.changedBy}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatusTimeline;
