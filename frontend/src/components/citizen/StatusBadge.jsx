import React from 'react';

const STATUS_CONFIG = {
  'Pending': {
    bg: '#fefce8',
    border: '#fde68a',
    text: '#92400e',
    dot: '#f59e0b',
    label: 'Pending'
  },
  'In Progress': {
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1e40af',
    dot: '#3b82f6',
    label: 'In Progress'
  },
  'Assigned': {
    bg: '#f0f9ff',
    border: '#bae6fd',
    text: '#075985',
    dot: '#0ea5e9',
    label: 'Assigned'
  },
  'Awaiting Verification': {
    bg: '#fff7ed',
    border: '#fed7aa',
    text: '#9a3412',
    dot: '#f97316',
    label: 'Awaiting Verification'
  },
  'Resolved': {
    bg: '#ecfdf5',
    border: '#a7f3d0',
    text: '#065f46',
    dot: '#10b981',
    label: 'Resolved'
  },
  'Reopened': {
    bg: '#fff1f2',
    border: '#fecdd3',
    text: '#9f1239',
    dot: '#f43f5e',
    label: 'Reopened'
  },
  'Under Administrative Review': {
    bg: '#faf5ff',
    border: '#e9d5ff',
    text: '#581c87',
    dot: '#a855f7',
    label: 'Under Review'
  }
};

const DEFAULT_CONFIG = {
  bg: '#f8fafc',
  border: '#e2e8f0',
  text: '#475569',
  dot: '#94a3b8',
  label: 'Unknown'
};

/**
 * StatusBadge — color-coded status badge for complaint statuses
 * @param {string} status - The status string
 * @param {string} [size='sm'] - 'sm' | 'md'
 */
const StatusBadge = ({ status, size = 'sm' }) => {
  const config = STATUS_CONFIG[status] || DEFAULT_CONFIG;

  const styles = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: size === 'md' ? '6px' : '5px',
    padding: size === 'md' ? '4px 10px' : '3px 8px',
    borderRadius: '9999px',
    border: `1px solid ${config.border}`,
    backgroundColor: config.bg,
    color: config.text,
    fontSize: size === 'md' ? '0.8rem' : '0.72rem',
    fontWeight: 600,
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
    lineHeight: 1.4
  };

  const dotStyles = {
    width: size === 'md' ? '7px' : '6px',
    height: size === 'md' ? '7px' : '6px',
    borderRadius: '50%',
    backgroundColor: config.dot,
    flexShrink: 0
  };

  return (
    <span style={styles}>
      <span style={dotStyles} />
      {config.label}
    </span>
  );
};

export default StatusBadge;
