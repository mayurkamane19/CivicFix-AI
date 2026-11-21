import React, { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../components/citizen/StatusBadge';
import PhotoComparison from '../components/citizen/PhotoComparison';
import StatusTimeline from '../components/citizen/StatusTimeline';
import { ResolutionVerificationCard } from '../components/resolution/ResolutionVerificationCard';
import FeedbackForm from '../components/feedback/FeedbackForm';
import { getMyCitizenComplaintDetailsApi } from '../services/api';
import './CitizenComplaintDetailsPage.css';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

/**
 * CitizenComplaintDetailsPage
 * Authenticated citizen view for an individual complaint with full timeline,
 * safe AI classification, SLA status, resolution evidence verification, and feedback.
 */
const CitizenComplaintDetailsPage = ({
  complaintId,
  currentUser,
  onNavigateBack,
  onNavigateHome
}) => {
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  const fetchDetails = useCallback(async () => {
    if (!complaintId) return;
    setLoading(true);
    setError(null);

    const res = await getMyCitizenComplaintDetailsApi(complaintId);
    setLoading(false);

    if (res.success && res.data) {
      setComplaint(res.data);
    } else {
      setError(res.error || 'Failed to load complaint details');
    }
  }, [complaintId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  if (loading) {
    return (
      <div className="ccdp-page">
        <div className="ccdp-loading">
          <span className="ccdp-spinner" />
          <span>Retrieving complaint #{complaintId}…</span>
        </div>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="ccdp-page">
        <div className="ccdp-body">
          <div className="ccdp-error">
            <span>⚠️ {error || 'Complaint not found or access denied.'}</span>
            <button className="cd-btn cd-btn-outline" onClick={onNavigateBack}>
              ← Back to Complaints
            </button>
          </div>
        </div>
      </div>
    );
  }

  const resEvidence = complaint.resolutionEvidence;
  const isAwaitingVerification =
    resEvidence?.status === 'Submitted by Officer' ||
    resEvidence?.status === 'Awaiting Citizen Verification';
  const isVerified = resEvidence?.status === 'Verified by Citizen';
  const isUnderReview =
    complaint.status === 'Under Administrative Review' ||
    resEvidence?.status === 'Under Administrative Review';

  // Compare before/after images if available
  const beforeImg = resEvidence?.beforeImages?.[0] || (complaint.imageUrl ? { url: complaint.imageUrl } : null);
  const afterImg = resEvidence?.afterImages?.[0] || null;

  return (
    <div className="ccdp-page">
      {/* Top Header */}
      <div className="ccdp-header">
        <div className="ccdp-header-inner">
          <div>
            <div className="ccdp-header-top">
              <span className="ccdp-id-badge">#{complaint.complaintId || complaintId}</span>
              <StatusBadge status={isAwaitingVerification ? 'Awaiting Verification' : complaint.status} size="md" />
              {complaint.category && (
                <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                  📁 {complaint.category}
                </span>
              )}
            </div>
            <h1 className="ccdp-title">{complaint.title || 'Civic Issue'}</h1>
            <div className="ccdp-header-meta">
              Reported on {formatDate(complaint.createdAt)} • Last updated {formatDate(complaint.updatedAt)}
            </div>
          </div>
          <button className="ccdp-back-btn" onClick={onNavigateBack}>
            ← Back to List
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="ccdp-body">
        {/* SLA Status Card */}
        {complaint.sla && (
          <div className={`ccdp-sla-banner ${complaint.sla.breached ? 'ccdp-sla-overdue' : 'ccdp-sla-ontrack'}`}>
            <div>
              <strong>⏱️ Service Level Agreement (SLA):</strong>{' '}
              {complaint.sla.breached ? (
                <span>Resolution target was breached</span>
              ) : (
                <span>
                  Resolution expected within deadline ({Math.max(0, complaint.sla.remainingHours ?? 0)}h remaining)
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.85rem' }}>
              Target: {formatDate(complaint.sla.deadline)}
            </div>
          </div>
        )}

        {/* Section 1: Complaint Details & Description */}
        <div className="ccdp-card">
          <div className="ccdp-card-title">📝 Issue Description & Location</div>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: '#334155', whiteSpace: 'pre-wrap' }}>
            {complaint.description || 'No description provided.'}
          </p>

          <div className="ccdp-info-grid">
            <div className="ccdp-info-item">
              <span className="ccdp-info-label">Category</span>
              <span className="ccdp-info-val">📁 {complaint.category || 'General'}</span>
            </div>
            <div className="ccdp-info-item">
              <span className="ccdp-info-label">Severity</span>
              <span className="ccdp-info-val">
                {complaint.severity ? `⚠️ ${complaint.severity}` : 'Standard'}
              </span>
            </div>
            <div className="ccdp-info-item">
              <span className="ccdp-info-label">Location</span>
              <span className="ccdp-info-val">📍 {complaint.address || 'Location on map'}</span>
            </div>
            {complaint.department && (
              <div className="ccdp-info-item">
                <span className="ccdp-info-label">Assigned Department</span>
                <span className="ccdp-info-val">🏛️ {complaint.department}</span>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Uploaded Issue Photograph */}
        {complaint.imageUrl && (
          <div className="ccdp-card">
            <div className="ccdp-card-title">📷 Issue Photograph (Original Submission)</div>
            <img
              src={complaint.imageUrl}
              alt="Uploaded issue"
              className="ccdp-complaint-img"
              onClick={() => setLightboxSrc(complaint.imageUrl)}
              title="Click to expand"
            />
          </div>
        )}

        {/* Section 3: Citizen-Safe AI Assessment */}
        {complaint.aiAnalysis && (
          <div className="ccdp-card">
            <div className="ccdp-card-title">🤖 AI Automated Assessment</div>
            <div className="ccdp-info-grid">
              <div className="ccdp-info-item">
                <span className="ccdp-info-label">AI Suggested Category</span>
                <span className="ccdp-info-val">
                  {complaint.aiAnalysis.suggestedCategory || complaint.category || 'Verified'}
                </span>
              </div>
              <div className="ccdp-info-item">
                <span className="ccdp-info-label">Priority Assessment</span>
                <span className="ccdp-info-val">
                  {complaint.aiAnalysis.priority || 'Standard municipal queue'}
                </span>
              </div>
            </div>
            {complaint.aiAnalysis.summary && (
              <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#475569', fontStyle: 'italic' }}>
                Summary: {complaint.aiAnalysis.summary}
              </p>
            )}
          </div>
        )}

        {/* Section 4: Resolution Evidence & Verification (Phase 19 Integration) */}
        {resEvidence && (resEvidence.status !== 'Not Submitted' || resEvidence.remarks || afterImg) && (
          <div className="ccdp-card">
            <div className="ccdp-card-title">
              ✅ Resolution Evidence & Field Verification
            </div>

            {/* Before / After Photo Comparison */}
            {(beforeImg || afterImg) && (
              <div style={{ marginBottom: '1.25rem' }}>
                <PhotoComparison
                  beforeImage={beforeImg}
                  afterImage={afterImg}
                  beforeLabel="Before Work"
                  afterLabel="After Resolution"
                />
              </div>
            )}

            {/* Resolution Remarks */}
            {resEvidence.remarks && (
              <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Field Officer Remarks
                </div>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.9rem', color: '#1e293b' }}>
                  {resEvidence.remarks}
                </p>
              </div>
            )}

            {/* Verification Status Card Component */}
            <ResolutionVerificationCard
              complaint={complaint}
              resolutionEvidence={resEvidence}
              currentUser={currentUser}
              onStatusUpdated={fetchDetails}
            />

            {/* Reopening History info */}
            {resEvidence.reopenCount > 0 && (
              <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                Contested {resEvidence.reopenCount} of {resEvidence.maxReopenLimit || 3} allowed times.
                {isUnderReview && (
                  <span style={{ color: '#7c3aed', fontWeight: 600, display: 'block', marginTop: '0.3rem' }}>
                    ⚖️ This complaint has reached maximum citizen reopens and is currently Under Administrative Review by municipal authorities.
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Section 5: Citizen Feedback (Phase 16 Integration) */}
        {complaint.status === 'Resolved' && (
          <div className="ccdp-card">
            <div className="ccdp-card-title">⭐ Citizen Feedback & Rating</div>
            <FeedbackForm
              complaintId={complaint.complaintId || complaintId}
              resolutionStatus={resEvidence?.status}
            />
          </div>
        )}

        {/* Section 6: Status History & Timeline */}
        <div className="ccdp-card">
          <div className="ccdp-card-title">📜 Lifecycle Timeline</div>
          <StatusTimeline
            entries={(complaint.statusHistory || []).map((h) => ({
              newStatus: h.newStatus,
              timestamp: h.changedAt,
              changedBy: h.changedByName,
              note: h.note
            }))}
            submittedAt={complaint.createdAt}
            mostRecentFirst={true}
          />
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxSrc && (
        <div
          className="photo-lightbox-overlay"
          onClick={() => setLightboxSrc(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="photo-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxSrc} alt="Full view" className="photo-lightbox-img" />
            <button
              type="button"
              className="photo-lightbox-close"
              onClick={() => setLightboxSrc(null)}
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CitizenComplaintDetailsPage;
