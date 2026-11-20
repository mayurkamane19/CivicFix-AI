import React, { useState } from 'react';
import { submitOfficerResolutionApi } from '../../services/api.js';

/**
 * OfficerResolutionModal
 * Modal dialogue for field officers to submit resolution remarks and before/after photographs
 */
export const OfficerResolutionModal = ({
  complaint,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [remarks, setRemarks] = useState('');
  const [caption, setCaption] = useState('');
  const [afterFiles, setAfterFiles] = useState([]);
  const [beforeFiles, setBeforeFiles] = useState([]);
  const [afterPreviews, setAfterPreviews] = useState([]);
  const [beforePreviews, setBeforePreviews] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !complaint) return null;

  const handleAfterFilesChange = (e) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files).slice(0, 5);
      setAfterFiles(filesArr);
      const previews = filesArr.map(file => URL.createObjectURL(file));
      setAfterPreviews(previews);
    }
  };

  const handleBeforeFilesChange = (e) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files).slice(0, 5);
      setBeforeFiles(filesArr);
      const previews = filesArr.map(file => URL.createObjectURL(file));
      setBeforePreviews(previews);
    }
  };

  const removeAfterFile = (index) => {
    const newFiles = [...afterFiles];
    newFiles.splice(index, 1);
    setAfterFiles(newFiles);

    const newPreviews = [...afterPreviews];
    newPreviews.splice(index, 1);
    setAfterPreviews(newPreviews);
  };

  const removeBeforeFile = (index) => {
    const newFiles = [...beforeFiles];
    newFiles.splice(index, 1);
    setBeforeFiles(newFiles);

    const newPreviews = [...beforePreviews];
    newPreviews.splice(index, 1);
    setBeforePreviews(newPreviews);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!remarks || remarks.trim().length < 10) {
      setErrorMessage('Please provide resolution remarks of at least 10 characters.');
      return;
    }

    const existingAfter = complaint.resolutionEvidence?.afterImages?.length || 0;
    if (afterFiles.length === 0 && existingAfter === 0) {
      setErrorMessage('At least one completion (after) photograph is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('remarks', remarks.trim());
      if (caption.trim()) {
        formData.append('caption', caption.trim());
      }

      afterFiles.forEach((file) => {
        formData.append('afterImages', file);
      });

      beforeFiles.forEach((file) => {
        formData.append('beforeImages', file);
      });

      const res = await submitOfficerResolutionApi(complaint.complaintId || complaint._id, formData);

      if (res.success) {
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        setErrorMessage(res.error || 'Failed to submit resolution.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred while uploading resolution evidence.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container officer-resolution-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Submit Resolution Evidence</h3>
            <p className="complaint-ref-subtitle">
              Complaint <strong>#{complaint.complaintId}</strong> — {complaint.title}
            </p>
          </div>
          <button type="button" className="close-button" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}

            {/* Complaint summary brief */}
            <div className="modal-complaint-brief">
              <span className={`priority-badge priority-${(complaint.priority || 'medium').toLowerCase()}`}>
                {complaint.priority} Priority
              </span>
              <span className="location-indicator">
                📍 {complaint.location?.address || 'Location provided'}
              </span>
              {complaint.sla?.remainingHours !== undefined && (
                <span className={`sla-badge ${complaint.sla?.isOverdue ? 'badge-danger' : 'badge-info'}`}>
                  {complaint.sla?.isOverdue ? 'Overdue' : `${complaint.sla.remainingHours}h remaining`}
                </span>
              )}
            </div>

            {/* Resolution Remarks */}
            <div className="form-group">
              <label htmlFor="officerRemarks">
                Resolution Remarks & Action Details <span className="required-star">*</span>
              </label>
              <textarea
                id="officerRemarks"
                className="form-control"
                rows="4"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Detail the work performed on-site (e.g. 'Repaired 2-inch pipe leak, resurfaced asphalt and tested pressure successfully'). Minimum 10 characters."
                required
              ></textarea>
              <div className="char-count">
                {remarks.length} characters (minimum 10 required)
              </div>
            </div>

            {/* After Images (Mandatory) */}
            <div className="form-group">
              <label htmlFor="afterPhotos">
                After / Completion Photos <span className="required-star">*</span>
              </label>
              <input
                id="afterPhotos"
                type="file"
                className="form-control-file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleAfterFilesChange}
              />
              <small className="form-text text-muted">
                Clear photo showing the completed resolution. Max 5 images, up to 5MB each.
              </small>

              {afterPreviews.length > 0 && (
                <div className="previews-row">
                  {afterPreviews.map((url, idx) => (
                    <div key={idx} className="preview-thumb-container">
                      <img src={url} alt={`After preview ${idx + 1}`} className="preview-thumb" />
                      <button
                        type="button"
                        className="btn-remove-thumb"
                        onClick={() => removeAfterFile(idx)}
                        title="Remove photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Before Images (Optional) */}
            <div className="form-group">
              <label htmlFor="beforePhotos">
                Before / Initial Condition Photos (Optional):
              </label>
              <input
                id="beforePhotos"
                type="file"
                className="form-control-file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleBeforeFilesChange}
              />
              <small className="form-text text-muted">
                Initial condition photos taken upon site arrival before starting work.
              </small>

              {beforePreviews.length > 0 && (
                <div className="previews-row">
                  {beforePreviews.map((url, idx) => (
                    <div key={idx} className="preview-thumb-container">
                      <img src={url} alt={`Before preview ${idx + 1}`} className="preview-thumb" />
                      <button
                        type="button"
                        className="btn-remove-thumb"
                        onClick={() => removeBeforeFile(idx)}
                        title="Remove photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Caption */}
            <div className="form-group">
              <label htmlFor="photoCaption">Photo Caption / Note (Optional):</label>
              <input
                id="photoCaption"
                type="text"
                className="form-control"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="e.g. Final inspection upon completion"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || remarks.trim().length < 10 || (afterFiles.length === 0 && !(complaint.resolutionEvidence?.afterImages?.length > 0))}
            >
              {isSubmitting ? 'Uploading Evidence...' : 'Submit Resolution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OfficerResolutionModal;
