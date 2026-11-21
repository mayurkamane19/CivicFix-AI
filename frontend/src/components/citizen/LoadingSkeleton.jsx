import React from 'react';

/**
 * LoadingSkeleton — animated placeholder cards matching complaint card shape
 * @param {number} [count=3]
 */
const LoadingSkeleton = ({ count = 3 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-card-header">
            <div className="skeleton-block skeleton-id" />
            <div className="skeleton-block skeleton-badge" />
          </div>
          <div className="skeleton-block skeleton-title" />
          <div className="skeleton-block skeleton-desc" />
          <div className="skeleton-block skeleton-desc skeleton-desc-short" />
          <div className="skeleton-card-footer">
            <div className="skeleton-block skeleton-meta" />
            <div className="skeleton-block skeleton-btn" />
          </div>
        </div>
      ))}
    </>
  );
};

export default LoadingSkeleton;
