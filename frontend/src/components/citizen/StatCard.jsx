import React from 'react';

/**
 * StatCard — reusable stat card for citizen dashboard
 * @param {string} title
 * @param {number|string} count
 * @param {React.ReactNode} icon
 * @param {string} accentColor - CSS color for the top border and icon
 * @param {string} [trend] - optional trend text
 * @param {function} [onClick]
 */
const StatCard = ({ title, count, icon, accentColor = '#3b82f6', trend, onClick }) => {
  return (
    <div
      className={`stat-card${onClick ? ' stat-card-clickable' : ''}`}
      style={{ '--accent': accentColor }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <div className="stat-card-top">
        <div className="stat-card-icon" style={{ backgroundColor: accentColor + '1a', color: accentColor }}>
          {icon}
        </div>
        <span className="stat-card-title">{title}</span>
      </div>
      <div className="stat-card-count">{count ?? '—'}</div>
      {trend && <div className="stat-card-trend">{trend}</div>}
    </div>
  );
};

export default StatCard;
