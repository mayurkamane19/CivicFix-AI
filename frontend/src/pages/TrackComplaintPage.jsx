import React, { useState, useEffect, useCallback } from 'react';
import {
  trackComplaintApi,
  analyzeComplaintApi,
  checkDuplicatesApi
} from '../services/api';

export const TrackComplaintPage = ({ initialComplaintId = '', onNavigateReport, onNavigateHome }) => {
  const [searchId, setSearchId] = useState(initialComplaintId || '');
  const [loading, setLoading] = useState(false);
  const [complaintData, setComplaintData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [searched, setSearched] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');

  const fetchComplaint = useCallback(async (idToTrack) => {
    if (!idToTrack || !idToTrack.trim()) {
      setErrorMessage('Please enter a Complaint ID (e.g. CFX-20261115-4821).');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSearched(true);
    setImageLoadError(false);

    try {
      const result = await trackComplaintApi(idToTrack.trim());

      if (result.success) {
        setComplaintData(result.data);
        setErrorMessage('');
      } else {
        setComplaintData(null);
        setErrorMessage(result.error || 'Complaint not found with this ID.');
      }
    } catch (err) {
      setComplaintData(null);
      setErrorMessage(err.message || 'An error occurred while tracking the complaint.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Automatically query if initialComplaintId is provided
  useEffect(() => {
    if (initialComplaintId && initialComplaintId.trim()) {
      setSearchId(initialComplaintId);
      fetchComplaint(initialComplaintId);
    }
  }, [initialComplaintId, fetchComplaint]);

  // Reset image load error when complaint data changes
  useEffect(() => {
    setImageLoadError(false);
    setAnalyzeError('');
    setDuplicateError('');
  }, [complaintData?.complaintId]);

  const handleTriggerAnalysis = async () => {
    if (!complaintData?.complaintId) return;
    setAnalyzing(true);
    setAnalyzeError('');

    try {
      const result = await analyzeComplaintApi(complaintData.complaintId, true);
      if (result.success && result.data) {
        setComplaintData(result.data);
      } else {
        setAnalyzeError(result.error || 'Failed to analyze complaint with AI');
      }
    } catch (err) {
      setAnalyzeError(err.message || 'Error communicating with AI service');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCheckDuplicates = async () => {
    if (!complaintData?.complaintId) return;
    setCheckingDuplicates(true);
    setDuplicateError('');

    try {
      const result = await checkDuplicatesApi(complaintData.complaintId, true);
      if (result.success && result.data) {
        setComplaintData(result.data);
      } else {
        setDuplicateError(result.error || 'Failed to check for duplicate complaints');
      }
    } catch (err) {
      setDuplicateError(err.message || 'Error checking for duplicates');
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchComplaint(searchId);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Resolved':
        return 'status-badge-resolved';
      case 'In Progress':
        return 'status-badge-progress';
      case 'Pending':
      default:
        return 'status-badge-pending';
    }
  };

  const formattedDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card track-card">
        {/* Header */}
        <div className="auth-header">
          <div className="brand-icon-wrapper small" style={{ margin: '0 auto 0.75rem' }}>
            <svg
              className="brand-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h2 className="auth-title">Track Public Complaint</h2>
          <p className="auth-subtitle">
            Enter your unique Complaint ID to check real-time municipal inspection and resolution status
          </p>
        </div>

        {/* Tracking Search Form */}
        <form onSubmit={handleSearchSubmit} className="track-search-form">
          <div className="track-input-group">
            <input
              type="text"
              className="form-input track-input"
              placeholder="e.g. CFX-20261115-4821"
              value={searchId}
              onChange={(e) => {
                setSearchId(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              disabled={loading}
              required
            />
            <button
              type="submit"
              className="btn btn-primary track-search-btn"
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Track'}
            </button>
          </div>
        </form>

        {/* Error Alert */}
        {errorMessage && (
          <div className="alert-box alert-error" style={{ marginTop: '1.25rem' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Result Card */}
        {complaintData && (
          <div className="track-result-panel">
            <div className="track-result-header">
              <div className="track-ticket-meta">
                <span className="meta-subtitle">MUNICIPAL TICKET</span>
                <h3 className="track-ticket-id">{complaintData.complaintId}</h3>
                {complaintData.emailNotificationsEnabled && (
                  <span className="email-status-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '9999px', marginTop: '4px' }}>
                    📧 Email Alerts Active
                  </span>
                )}
              </div>
              <span className={`status-pill-large ${getStatusBadgeClass(complaintData.status)}`}>
                <span className="status-dot-large"></span>
                {complaintData.status}
              </span>
            </div>

            {/* Visual Resolution Pipeline */}
            <div className="resolution-timeline">
              <div
                className={`timeline-step ${
                  complaintData.status === 'Pending' ||
                  complaintData.status === 'In Progress' ||
                  complaintData.status === 'Resolved'
                    ? 'step-active'
                    : ''
                }`}
              >
                <div className="step-circle">1</div>
                <span className="step-label">Submitted</span>
              </div>
              <div className="timeline-connector"></div>
              <div
                className={`timeline-step ${
                  complaintData.status === 'In Progress' || complaintData.status === 'Resolved'
                    ? 'step-active'
                    : ''
                }`}
              >
                <div className="step-circle">2</div>
                <span className="step-label">In Progress</span>
              </div>
              <div className="timeline-connector"></div>
              <div className={`timeline-step ${complaintData.status === 'Resolved' ? 'step-active' : ''}`}>
                <div className="step-circle">3</div>
                <span className="step-label">Resolved</span>
              </div>
            </div>

            <div className="track-details-list">
              <div className="track-detail-item">
                <span className="track-detail-label">Title</span>
                <span className="track-detail-value font-semibold">{complaintData.title}</span>
              </div>

              <div className="track-detail-item">
                <span className="track-detail-label">Category</span>
                <span className="track-category-tag">{complaintData.category}</span>
              </div>

              {/* Department & Officer Assignment (Phase 11) */}
              <div className="track-detail-item">
                <span className="track-detail-label">Municipal Assignment</span>
                <div className="track-detail-value">
                  {complaintData.assignedDepartmentName ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span className="badge badge-dept" style={{ alignSelf: 'flex-start', padding: '0.25rem 0.6rem' }}>
                        🏢 {complaintData.assignedDepartmentName}
                      </span>
                      {complaintData.assignedOfficerName && (
                        <span style={{ fontSize: '0.875rem', color: 'var(--slate-600)' }}>
                          Assigned Officer: <strong>{complaintData.assignedOfficerName}</strong>
                        </span>
                      )}
                      {complaintData.assignedAt && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                          Dispatched: {formatDate(complaintData.assignedAt)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--slate-400)', fontStyle: 'italic' }}>
                      Queueing for departmental triage
                    </span>
                  )}
                </div>
              </div>

              <div className="track-detail-item">
                <span className="track-detail-label">Location Address</span>
                <span className="track-detail-value">{complaintData.address}</span>
              </div>

              {(complaintData.latitude !== null && complaintData.latitude !== undefined) && (
                <div className="track-detail-item">
                  <span className="track-detail-label">GPS Coordinates</span>
                  <span className="track-detail-value font-mono">
                    {complaintData.latitude}, {complaintData.longitude}
                  </span>
                </div>
              )}

              <div className="track-detail-item">
                <span className="track-detail-label">Description</span>
                <p className="track-description-text">{complaintData.description}</p>
              </div>

              {/* Photo Evidence Section (Phase 5) */}
              {complaintData.imageUrl && (
                <div className="track-detail-item">
                  <span className="track-detail-label">Attached Photo Evidence</span>
                  <div className="track-image-container">
                    {!imageLoadError ? (
                      <div className="track-image-wrapper">
                        <img
                          src={complaintData.imageUrl}
                          alt={`Visual evidence for complaint ${complaintData.complaintId}`}
                          className="track-complaint-image"
                          onError={() => setImageLoadError(true)}
                          loading="lazy"
                        />
                        <a
                          href={complaintData.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="track-image-overlay-btn"
                          title="Open full resolution in new tab"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                          <span>Full Resolution</span>
                        </a>
                      </div>
                    ) : (
                      <div className="track-image-fallback">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <div className="track-fallback-content">
                          <span className="fallback-text">Photo preview could not be loaded directly.</span>
                          <a
                            href={complaintData.imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="fallback-link"
                          >
                            Open direct image link ↗
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AI Image Analysis (Mini Phase 15.3) */}
              {complaintData.imageAnalysis && (
                <div className="track-detail-item track-ai-item track-image-ai-item">
                  <div className="track-ai-header">
                    <div className="ai-badge-row">
                      <span className="ai-sparkle-icon">📷</span>
                      <span className="track-detail-label" style={{ margin: 0 }}>AI Image Analysis</span>
                    </div>
                    <span className={`ai-status-pill status-${complaintData.imageAnalysis.status?.toLowerCase() || 'pending'}`}>
                      {complaintData.imageAnalysis.status || 'Pending'}
                    </span>
                  </div>

                  {complaintData.imageAnalysis.status === 'Completed' ? (
                    <div className="track-ai-card track-image-ai-card">
                      {complaintData.imageAnalysis.isUnclearOrUnsuitable && (
                        <div className="ai-unsuitable-warning-box">
                          <span className="unsuitable-warning-icon">⚠️</span>
                          <div className="unsuitable-warning-text">
                            <strong>Image Advisory:</strong>{' '}
                            {complaintData.imageAnalysis.unsuitableReason || 'The uploaded photo was flagged as unclear, blurry, or non-civic.'}
                          </div>
                        </div>
                      )}

                      <div className="track-ai-meta-grid">
                        {complaintData.imageAnalysis.possibleIssueType && (
                          <div className="track-ai-cell">
                            <span className="ai-metric-label">Detected Issue Type</span>
                            <span className="image-ai-issue-tag">
                              {complaintData.imageAnalysis.possibleIssueType}
                            </span>
                          </div>
                        )}

                        {complaintData.imageAnalysis.suggestedCategory && (
                          <div className="track-ai-cell">
                            <span className="ai-metric-label">AI Suggested Category</span>
                            <div className="ai-category-compare">
                              <span className="ai-suggested-tag">{complaintData.imageAnalysis.suggestedCategory}</span>
                              {complaintData.imageAnalysis.suggestedCategory !== complaintData.category && (
                                <span className="ai-compare-note">(Citizen filed: {complaintData.category})</span>
                              )}
                            </div>
                          </div>
                        )}

                        {complaintData.imageAnalysis.suggestedSeverity && (
                          <div className="track-ai-cell">
                            <span className="ai-metric-label">Visual Severity</span>
                            <span className={`severity-pill severity-pill-${complaintData.imageAnalysis.suggestedSeverity.toLowerCase()}`}>
                              <span className="severity-dot"></span>
                              {complaintData.imageAnalysis.suggestedSeverity} Severity
                            </span>
                          </div>
                        )}

                        {complaintData.imageAnalysis.confidence && (
                          <div className="track-ai-cell">
                            <span className="ai-metric-label">Visual Confidence</span>
                            <span className={`confidence-pill confidence-${complaintData.imageAnalysis.confidence.toLowerCase()}`}>
                              {complaintData.imageAnalysis.confidence} Confidence
                            </span>
                          </div>
                        )}
                      </div>

                      {complaintData.imageAnalysis.shortDescription && (
                        <div className="track-ai-section">
                          <span className="ai-block-label">Visual Scene Description</span>
                          <p className="ai-summary-text">{complaintData.imageAnalysis.shortDescription}</p>
                        </div>
                      )}

                      <div className="ai-disclaimer-footnote">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>
                          AI visual analysis generated by Google Gemini. Findings are automated suggestions for municipal review, not verified municipal decisions.
                        </span>
                      </div>
                    </div>
                  ) : complaintData.imageAnalysis.status === 'Failed' ? (
                    <div className="ai-status-note ai-status-failed" style={{ marginTop: '0.5rem' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>
                        AI visual analysis is temporarily unavailable for this photo.
                      </span>
                    </div>
                  ) : (
                    <div className="ai-status-note ai-status-pending" style={{ marginTop: '0.5rem' }}>
                      <span className="status-dot"></span>
                      <span>AI visual analysis is currently queued or in progress.</span>
                    </div>
                  )}
                </div>
              )}

              {/* AI Municipal Analysis (Phase 6) */}
              <div className="track-detail-item track-ai-item">
                <div className="track-ai-header">
                  <div className="ai-badge-row">
                    <span className="ai-sparkle-icon">✨</span>
                    <span className="track-detail-label" style={{ margin: 0 }}>Google Gemini Municipal Advisory</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-small ai-action-btn"
                    onClick={handleTriggerAnalysis}
                    disabled={analyzing}
                  >
                    {analyzing
                      ? 'Analyzing with Gemini...'
                      : (complaintData.aiAnalysis?.status === 'Completed'
                          ? '↻ Refresh AI Analysis'
                          : '✨ Analyze with AI')}
                  </button>
                </div>

                {analyzeError && (
                  <div className="alert-box alert-error" style={{ margin: '0.75rem 0 0' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{analyzeError}</span>
                  </div>
                )}

                {complaintData.aiAnalysis?.status === 'Completed' ? (
                  <div className="track-ai-card">
                    <div className="track-ai-meta-grid">
                      <div className="track-ai-cell">
                        <span className="ai-metric-label">Estimated Severity</span>
                        <span className={`severity-pill severity-pill-${(complaintData.aiAnalysis.severity || 'medium').toLowerCase()}`}>
                          <span className="severity-dot"></span>
                          {complaintData.aiAnalysis.severity} Severity
                        </span>
                      </div>
                      <div className="track-ai-cell">
                        <span className="ai-metric-label">AI Suggested Category</span>
                        <div className="ai-category-compare">
                          <span className="ai-suggested-tag">{complaintData.aiAnalysis.suggestedCategory}</span>
                          {complaintData.aiAnalysis.suggestedCategory !== complaintData.category && (
                            <span className="ai-compare-note">(Citizen filed: {complaintData.category})</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="track-ai-section">
                      <span className="ai-block-label">Automated Summary</span>
                      <p className="ai-summary-text">{complaintData.aiAnalysis.summary}</p>
                    </div>

                    <div className="track-ai-section">
                      <span className="ai-block-label">Recommended Response Department</span>
                      <span className="ai-department-tag">{complaintData.aiAnalysis.recommendedDepartment}</span>
                    </div>

                    <div className="track-ai-section">
                      <span className="ai-block-label">Suggested Action for Field Crews</span>
                      <p className="ai-action-text">{complaintData.aiAnalysis.suggestedAction}</p>
                    </div>

                    <div className="ai-disclaimer-footnote">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>
                        AI analysis generated by Google Gemini for municipal prioritization. Citizen inputs are never overwritten.
                      </span>
                    </div>
                  </div>
                ) : complaintData.aiAnalysis?.status === 'Failed' ? (
                  <div className="ai-status-note ai-status-failed" style={{ marginTop: '0.75rem' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>
                      AI automated analysis is currently unavailable ({complaintData.aiAnalysis.errorMessage || 'Click "Analyze with AI" above to run analysis'}).
                    </span>
                  </div>
                ) : (
                  <div className="ai-status-note ai-status-pending" style={{ marginTop: '0.75rem' }}>
                    <span className="status-dot"></span>
                    <span>AI analysis has not yet been processed for this ticket. Click "Analyze with AI" above to run Google Gemini.</span>
                  </div>
                )}
              </div>

              {/* Duplicate Detection Advisory (Phase 7) */}
              <div className="track-detail-item track-duplicate-item">
                <div className="track-ai-header">
                  <div className="ai-badge-row">
                    <span className="duplicate-icon">📋</span>
                    <span className="track-detail-label" style={{ margin: 0 }}>Duplicate Detection Advisory</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-small ai-action-btn"
                    onClick={handleCheckDuplicates}
                    disabled={checkingDuplicates}
                  >
                    {checkingDuplicates
                      ? 'Checking Duplicates...'
                      : (complaintData.duplicateCheck?.status === 'Completed'
                          ? '↻ Re-check Duplicates'
                          : '📋 Check Duplicates')}
                  </button>
                </div>

                {duplicateError && (
                  <div className="alert-box alert-error" style={{ margin: '0.75rem 0 0' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{duplicateError}</span>
                  </div>
                )}

                {complaintData.duplicateCheck?.status === 'Completed' ? (
                  complaintData.duplicateCheck.isPotentialDuplicate &&
                  complaintData.duplicateCheck.matchedComplaints &&
                  complaintData.duplicateCheck.matchedComplaints.length > 0 ? (
                    <div className="track-duplicate-card">
                      <div className="track-duplicate-alert">
                        <span className="duplicate-alert-badge">
                          ⚠️ Potential Similar Complaint(s) ({complaintData.duplicateCheck.matchedComplaints.length})
                        </span>
                        <span className={`confidence-pill confidence-${(complaintData.duplicateCheck.confidence || 'medium').toLowerCase()}`}>
                          {complaintData.duplicateCheck.confidence} Confidence ({Math.round((complaintData.duplicateCheck.similarityScore || 0) * 100)}%)
                        </span>
                      </div>

                      <div className="duplicate-matches-list">
                        {complaintData.duplicateCheck.matchedComplaints.map((match) => (
                          <div key={match.complaintId} className="duplicate-match-item">
                            <div className="duplicate-match-top">
                              <span className="duplicate-match-id">{match.complaintId}</span>
                              <span className={`confidence-pill confidence-${(match.confidence || 'medium').toLowerCase()}`}>
                                {match.confidence} ({Math.round(match.similarityScore * 100)}%)
                              </span>
                              <span className={`status-badge-mini status-${(match.status || 'pending').toLowerCase().replace(' ', '-')}`}>
                                {match.status}
                              </span>
                            </div>
                            <p className="duplicate-match-title">{match.title}</p>
                            <div className="duplicate-match-meta">
                              <span className="duplicate-meta-tag">{match.category}</span>
                              {match.distanceMeters !== null && match.distanceMeters !== undefined && (
                                <span className="duplicate-meta-distance">
                                  📍 ~{match.distanceMeters}m away
                                </span>
                              )}
                              {match.createdAt && (
                                <span className="duplicate-meta-date">
                                  🕒 {new Date(match.createdAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="ai-disclaimer-footnote">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                        </svg>
                        <span>
                          Advisory suggestion for municipal dispatchers. Complaints are never automatically merged or deleted.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="duplicate-none-found" style={{ marginTop: '0.75rem' }}>
                      <span className="check-mark">✓</span>
                      <span>No similar complaints detected. This report appears to be an isolated incident.</span>
                    </div>
                  )
                ) : complaintData.duplicateCheck?.status === 'Failed' ? (
                  <div className="ai-status-note ai-status-failed" style={{ marginTop: '0.75rem' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>
                      Duplicate check service is currently unavailable ({complaintData.duplicateCheck.errorMessage || 'Click "Check Duplicates" above to retry'}).
                    </span>
                  </div>
                ) : (
                  <div className="ai-status-note ai-status-pending" style={{ marginTop: '0.75rem' }}>
                    <span className="status-dot"></span>
                    <span>Duplicate detection has not been run for this ticket yet. Click "Check Duplicates" above.</span>
                  </div>
                )}
              </div>

              {/* Resolution Progress & Status History Timeline (Phase 10) */}
              <div className="track-detail-item track-history-item">
                <div className="track-history-header">
                  <div className="history-badge-row">
                    <span className="history-icon">📜</span>
                    <span className="track-detail-label" style={{ margin: 0 }}>
                      Resolution Activity &amp; Status Timeline
                    </span>
                  </div>
                  <span className="history-count-badge">
                    {(complaintData.statusHistory || []).length} update(s)
                  </span>
                </div>

                {complaintData.statusHistory && complaintData.statusHistory.length > 0 ? (
                  <div className="track-timeline-list">
                    {/* Initial submission event */}
                    <div className="track-timeline-entry initial-submission-entry">
                      <div className="track-timeline-dot submitted-dot"></div>
                      <div className="track-timeline-body">
                        <div className="track-timeline-header-line">
                          <span className="track-timeline-title">Issue Reported by Citizen</span>
                          <span className="track-timeline-date">
                            {formattedDate(complaintData.submissionDate || complaintData.createdAt)}
                          </span>
                        </div>
                        <p className="track-timeline-sub">
                          Ticket registered in municipal dispatch system with status <strong>Pending</strong>.
                        </p>
                      </div>
                    </div>

                    {/* Historical status transitions */}
                    {complaintData.statusHistory.map((entry, idx) => (
                      <div key={entry.id || idx} className="track-timeline-entry">
                        <div
                          className={`track-timeline-dot ${
                            entry.newStatus === 'Resolved' ? 'resolved-dot' : 'progress-dot'
                          }`}
                        ></div>
                        <div className="track-timeline-body">
                          <div className="track-timeline-header-line">
                            <span className="track-timeline-title">
                              Status updated to{' '}
                              <span
                                className={`status-badge-inline ${getStatusBadgeClass(
                                  entry.newStatus
                                )}`}
                              >
                                {entry.newStatus}
                              </span>
                            </span>
                            <span className="track-timeline-date">
                              {formattedDate(entry.changedAt)}
                            </span>
                          </div>
                          <p className="track-timeline-sub">
                            Action verified by {entry.changedByName || 'Municipal Administrator'}
                          </p>
                          {entry.note && (
                            <div className="track-history-note">
                              <span className="note-icon">💬</span>
                              <span className="note-content">{entry.note}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="track-no-history-state">
                    <div className="track-timeline-entry initial-submission-entry">
                      <div className="track-timeline-dot submitted-dot"></div>
                      <div className="track-timeline-body">
                        <div className="track-timeline-header-line">
                          <span className="track-timeline-title">Complaint Successfully Submitted</span>
                          <span className="track-timeline-date">
                            {formattedDate(complaintData.submissionDate || complaintData.createdAt)}
                          </span>
                        </div>
                        <p className="track-timeline-sub">
                          The complaint has been recorded and is currently in its initial{' '}
                          <strong>Pending</strong> review stage. Further status transitions and
                          municipal notes will appear here as field work progresses.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="track-detail-item">
                <span className="track-detail-label">Submission Date</span>
                <span className="track-detail-value">
                  {formattedDate(complaintData.submissionDate || complaintData.createdAt)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Empty state when searched and no result and no error */}
        {!complaintData && searched && !errorMessage && !loading && (
          <div className="empty-track-state">
            <p>No complaint found with this ID. Please double check your ticket number.</p>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="auth-footer">
          <p className="auth-switch-text">
            Need to submit a new hazard report?{' '}
            <button
              type="button"
              className="link-button"
              onClick={onNavigateReport}
            >
              Report an Issue
            </button>
          </p>
          <button
            type="button"
            className="link-button back-link"
            onClick={onNavigateHome}
          >
            &larr; Return to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrackComplaintPage;
