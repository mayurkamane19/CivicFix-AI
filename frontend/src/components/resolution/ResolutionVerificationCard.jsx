import React, { useState } from 'react';
import { verifyResolutionApi, rejectResolutionApi } from '../../services/api.js';

/**
 * ResolutionVerificationCard
 * Displays submitted resolution evidence (before/after photos & remarks),
 * allows citizen verification or contesting with reason and rebuttal photos,
 * and renders verification status badges and reopen history.
 */
export const ResolutionVerificationCard = ({
  complaint,
  resolutionEvidence,
  onStatusUpdated,
  currentUser = null
}) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedRejectionFiles, setSelectedRejectionFiles] = useState([]);
  const [isSubmittingRejection, setIsSubmittingRejection] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [activePhotoTab, setActivePhotoTab] = useState('comparison'); // 'comparison' | 'before' | 'after'
  const [lightboxImage, setLightboxImage] = useState(null);

  const evidence = resolutionEvidence || complaint?.resolutionEvidence || {};
  const status = evidence.status || 'Not Submitted';
  const beforeImages = evidence.beforeImages || [];
  const afterImages = evidence.afterImages || [];
  const reopenCount = evidence.reopenCount || 0;
  const maxLimit = evidence.maxReopenLimit || 3;
  const reopenHistory = evidence.reopeningHistory || [];

  const canCitizenAct = complaint?.status === 'Resolved' && status === 'Awaiting Citizen Verification';

  const handleVerify = async () => {
    if (!window.confirm('Are you satisfied that this issue has been completely and correctly resolved?')) {
      return;
    }
    setActionError('');
    setActionSuccess('');
    setIsVerifying(true);
    try {
      const res = await verifyResolutionApi(complaint.complaintId || complaint._id);
      if (res.success) {
        setActionSuccess('Thank you! Resolution verified successfully.');
        if (onStatusUpdated) onStatusUpdated();
      } else {
        setActionError(res.error || 'Failed to verify resolution.');
      }
    } catch (err) {
      setActionError(err.message || 'Error communicating with server.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files).slice(0, 3);
      setSelectedRejectionFiles(filesArray);
    }
  };

  const handleRejectionSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason || rejectionReason.trim().length < 10) {
      setActionError('Please provide a specific reason of at least 10 characters.');
      return;
    }

    setActionError('');
    setActionSuccess('');
    setIsSubmittingRejection(true);

    try {
      const formData = new FormData();
      formData.append('reason', rejectionReason.trim());
      selectedRejectionFiles.forEach((file) => {
        formData.append('evidenceImages', file);
      });

      const res = await rejectResolutionApi(complaint.complaintId || complaint._id, formData);
      if (res.success) {
        setActionSuccess(res.message || 'Complaint reopened successfully.');
        setShowReopenModal(false);
        setRejectionReason('');
        setSelectedRejectionFiles([]);
        if (onStatusUpdated) onStatusUpdated();
      } else {
        setActionError(res.error || 'Failed to contest resolution.');
      }
    } catch (err) {
      setActionError(err.message || 'Error submitting contest request.');
    } finally {
      setIsSubmittingRejection(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'Verified by Citizen':
        return <span className="status-badge badge-verified">✓ Verified by Citizen</span>;
      case 'Awaiting Citizen Verification':
        return <span className="status-badge badge-awaiting">⏳ Awaiting Citizen Verification</span>;
      case 'Rejected by Citizen':
        return <span className="status-badge badge-rejected">✗ Rejected & Reopened</span>;
      case 'Under Administrative Review':
        return <span className="status-badge badge-admin-review">⚠️ Under Administrative Review</span>;
      case 'Reopened':
        return <span className="status-badge badge-reopened">↻ Reopened</span>;
      default:
        return <span className="status-badge badge-secondary">{status}</span>;
    }
  };

  if (!evidence || (!evidence.remarks && afterImages.length === 0 && status === 'Not Submitted')) {
    return null;
  }

  return (
    <div className="resolution-card card">
      <div className="resolution-card-header">
        <div className="header-title-row">
          <div className="header-icon">📷</div>
          <div>
            <h3 className="section-title">Resolution Verification & Evidence</h3>
            <p className="section-subtitle">
              Submitted by <strong>{evidence.submittedByName || 'Field Officer'}</strong>
              {evidence.submittedAt && ` on ${new Date(evidence.submittedAt).toLocaleString()}`}
            </p>
          </div>
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      {actionSuccess && <div className="alert alert-success">{actionSuccess}</div>}
      {actionError && <div className="alert alert-danger">{actionError}</div>}

      {/* Officer Remarks */}
      {evidence.remarks && (
        <div className="resolution-remarks-box">
          <span className="remarks-label">Officer Remarks:</span>
          <p className="remarks-text">{evidence.remarks}</p>
        </div>
      )}

      {/* Visual Photo Comparison */}
      {(beforeImages.length > 0 || afterImages.length > 0) && (
        <div className="evidence-media-container">
          <div className="evidence-tab-bar">
            <button
              type="button"
              className={`tab-btn ${activePhotoTab === 'comparison' ? 'active' : ''}`}
              onClick={() => setActivePhotoTab('comparison')}
            >
              Side-by-Side Comparison
            </button>
            <button
              type="button"
              className={`tab-btn ${activePhotoTab === 'after' ? 'active' : ''}`}
              onClick={() => setActivePhotoTab('after')}
            >
              After Photos ({afterImages.length})
            </button>
            {beforeImages.length > 0 && (
              <button
                type="button"
                className={`tab-btn ${activePhotoTab === 'before' ? 'active' : ''}`}
                onClick={() => setActivePhotoTab('before')}
              >
                Before Photos ({beforeImages.length})
              </button>
            )}
          </div>

          {/* Comparison View */}
          {activePhotoTab === 'comparison' && (
            <div className="photo-comparison-grid">
              <div className="comparison-column before-column">
                <div className="column-label before-tag">BEFORE RESOLUTION</div>
                {beforeImages.length > 0 ? (
                  beforeImages.map((img, idx) => (
                    <div key={idx} className="evidence-photo-wrapper" onClick={() => setLightboxImage(img.url)}>
                      <img src={img.url} alt={`Before ${idx + 1}`} className="evidence-photo" />
                      {img.caption && <div className="photo-caption">{img.caption}</div>}
                    </div>
                  ))
                ) : (
                  <div className="no-photo-placeholder">
                    <p>No initial condition photo provided.</p>
                  </div>
                )}
              </div>

              <div className="comparison-column after-column">
                <div className="column-label after-tag">AFTER RESOLUTION</div>
                {afterImages.length > 0 ? (
                  afterImages.map((img, idx) => (
                    <div key={idx} className="evidence-photo-wrapper" onClick={() => setLightboxImage(img.url)}>
                      <img src={img.url} alt={`After ${idx + 1}`} className="evidence-photo" />
                      {img.caption && <div className="photo-caption">{img.caption}</div>}
                    </div>
                  ))
                ) : (
                  <div className="no-photo-placeholder">
                    <p>No completion photo attached.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Only After Photos */}
          {activePhotoTab === 'after' && (
            <div className="evidence-gallery-grid">
              {afterImages.map((img, idx) => (
                <div key={idx} className="evidence-photo-wrapper" onClick={() => setLightboxImage(img.url)}>
                  <img src={img.url} alt={`After ${idx + 1}`} className="evidence-photo" />
                  {img.caption && <div className="photo-caption">{img.caption}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Only Before Photos */}
          {activePhotoTab === 'before' && (
            <div className="evidence-gallery-grid">
              {beforeImages.map((img, idx) => (
                <div key={idx} className="evidence-photo-wrapper" onClick={() => setLightboxImage(img.url)}>
                  <img src={img.url} alt={`Before ${idx + 1}`} className="evidence-photo" />
                  {img.caption && <div className="photo-caption">{img.caption}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Citizen Action Verification Bar */}
      {canCitizenAct && (
        <div className="citizen-action-banner">
          <div className="banner-content">
            <h4>Has your issue been resolved satisfactorily?</h4>
            <p>
              Please inspect the proof submitted by the officer above. Confirm resolution to finalize your
              complaint and rate your experience, or contest if the work is incomplete.
            </p>
          </div>
          <div className="banner-buttons">
            <button
              type="button"
              className="btn btn-success verify-btn"
              onClick={handleVerify}
              disabled={isVerifying}
            >
              {isVerifying ? 'Confirming...' : '✓ Confirm Resolution'}
            </button>
            <button
              type="button"
              className="btn btn-outline-danger contest-btn"
              onClick={() => setShowReopenModal(true)}
              disabled={isVerifying}
            >
              ✕ Contest / Reopen
            </button>
          </div>
        </div>
      )}

      {/* Reopening History Log */}
      {reopenHistory.length > 0 && (
        <div className="reopen-history-section">
          <h5 className="sub-heading">Reopening & Contest History ({reopenCount}/{maxLimit})</h5>
          <div className="reopen-timeline">
            {reopenHistory.map((item, idx) => (
              <div key={idx} className="reopen-item">
                <div className="reopen-dot"></div>
                <div className="reopen-meta">
                  <strong>{item.reopenedByName || 'Citizen'}</strong> reopened on{' '}
                  {new Date(item.reopenedAt).toLocaleString()}
                </div>
                <div className="reopen-reason">"{item.reason}"</div>
                {item.rejectionEvidence && item.rejectionEvidence.length > 0 && (
                  <div className="rejection-photos-row">
                    {item.rejectionEvidence.map((photo, pIdx) => (
                      <img
                        key={pIdx}
                        src={photo.url}
                        alt="Rebuttal evidence"
                        className="rebuttal-thumb"
                        onClick={() => setLightboxImage(photo.url)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reopen Contest Modal */}
      {showReopenModal && (
        <div className="modal-overlay" onClick={() => setShowReopenModal(false)}>
          <div className="modal-container reopen-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Contest Resolution & Reopen Complaint</h3>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowReopenModal(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleRejectionSubmit}>
              <div className="modal-body">
                <div className="reopen-notice-box">
                  <span className="notice-icon">ℹ️</span>
                  <span>
                    You are reopening this complaint. It will be sent back to the field officer to take
                    corrective action. Reopen count: <strong>{reopenCount + 1} of {maxLimit}</strong>.
                    {reopenCount + 1 >= maxLimit && (
                      <span className="warning-text"> Note: Reaching {maxLimit} reopens escalates this complaint directly to municipal administration.</span>
                    )}
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="rejectionReason">
                    Why is this resolution unsatisfactory? <span className="required-star">*</span>
                  </label>
                  <textarea
                    id="rejectionReason"
                    className="form-control"
                    rows="4"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Describe what is still unresolved or defective (minimum 10 characters)..."
                    required
                  ></textarea>
                  <div className="char-count">
                    {rejectionReason.length} characters (minimum 10)
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="rejectionPhotos">
                    Attach Rebuttal Photographs (Optional, up to 3):
                  </label>
                  <input
                    id="rejectionPhotos"
                    type="file"
                    className="form-control-file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleFileChange}
                  />
                  <small className="form-text text-muted">
                    Take photos showing the current condition to help the field officer. Max 5MB each.
                  </small>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowReopenModal(false)}
                  disabled={isSubmittingRejection}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={isSubmittingRejection || rejectionReason.trim().length < 10}
                >
                  {isSubmittingRejection ? 'Submitting Contest...' : 'Reopen Complaint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox / Zoom view */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImage} alt="Expanded evidence" className="lightbox-img" />
            <button
              type="button"
              className="lightbox-close"
              onClick={() => setLightboxImage(null)}
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResolutionVerificationCard;
