import React, { useState, useEffect, useCallback } from 'react';
import {
  submitFeedbackApi,
  getComplaintFeedbackApi,
  getStoredToken
} from '../../services/api';

const RATING_LABELS = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent'
};

export const FeedbackForm = ({ complaintId, status, onFeedbackSubmitted }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [existingFeedback, setExistingFeedback] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const token = getStoredToken();
  const isResolved = status === 'Resolved';

  // Fetch any previously submitted feedback for this complaint
  const fetchExistingFeedback = useCallback(async () => {
    if (!complaintId || !isResolved || !token) return;

    setLoadingExisting(true);
    try {
      const result = await getComplaintFeedbackApi(complaintId);
      if (result.success && result.data) {
        setExistingFeedback(result.data);
      }
    } catch {
      // Non-blocking: fail quietly if user cannot view existing feedback
    } finally {
      setLoadingExisting(false);
    }
  }, [complaintId, isResolved, token]);

  useEffect(() => {
    fetchExistingFeedback();
  }, [fetchExistingFeedback]);

  // Guard: Feedback form is strictly hidden for unresolved complaints
  if (!isResolved) {
    return null;
  }

  const handleStarClick = (selectedStar) => {
    setRating(selectedStar);
    setErrorMessage('');
  };

  const handleStarKeyDown = (e, star) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleStarClick(star);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!token) {
      setErrorMessage('Please sign in with your citizen account to rate this resolution.');
      return;
    }

    if (!rating || rating < 1 || rating > 5) {
      setErrorMessage('Please select a star rating between 1 and 5 stars.');
      return;
    }

    if (comment.length > 500) {
      setErrorMessage('Feedback comment cannot exceed 500 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitFeedbackApi(complaintId, {
        rating,
        comment: comment.trim()
      });

      if (result.success) {
        setSuccessMessage('Thank you! Your feedback has been recorded.');
        setExistingFeedback(result.data);
        if (onFeedbackSubmitted) {
          onFeedbackSubmitted(result.data);
        }
      } else {
        setErrorMessage(result.error || 'Failed to submit feedback. Please try again.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Network error submitting feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  // Render Already Submitted Feedback State
  if (existingFeedback) {
    return (
      <div className="track-detail-item feedback-section feedback-submitted-section">
        <div className="feedback-card feedback-submitted-card">
          <div className="feedback-header">
            <div className="feedback-badge-row">
              <span className="feedback-icon">⭐</span>
              <span className="track-detail-label" style={{ margin: 0 }}>
                Citizen Resolution Rating
              </span>
            </div>
            <span className="feedback-status-badge feedback-badge-completed">
              ✓ Feedback Submitted
            </span>
          </div>

          <div className="feedback-content">
            <div className="feedback-stars-display" aria-label={`Rated ${existingFeedback.rating} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`star-icon-static ${star <= existingFeedback.rating ? 'star-filled' : 'star-empty'}`}
                >
                  ★
                </span>
              ))}
              <span className="rating-label-text">
                {RATING_LABELS[existingFeedback.rating] || `${existingFeedback.rating}/5`}
              </span>
            </div>

            {existingFeedback.comment && (
              <div className="feedback-comment-box">
                <span className="feedback-comment-label">Your Comments:</span>
                <p className="feedback-comment-text">"{existingFeedback.comment}"</p>
              </div>
            )}

            <div className="feedback-footer-note">
              <span>Thank you for helping improve municipal public services.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Feedback Submission Form
  return (
    <div className="track-detail-item feedback-section">
      <div className="feedback-card">
        <div className="feedback-header">
          <div className="feedback-badge-row">
            <span className="feedback-icon">⭐</span>
            <span className="track-detail-label" style={{ margin: 0 }}>
              Rate Issue Resolution
            </span>
          </div>
          <span className="feedback-status-badge feedback-badge-pending">
            Feedback Requested
          </span>
        </div>

        <p className="feedback-intro-text">
          This complaint has been marked as <strong>Resolved</strong> by municipal authorities.
          How satisfied are you with the timeliness and quality of the repair?
        </p>

        {loadingExisting ? (
          <div className="feedback-loading">
            <span>Checking feedback status...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="feedback-form">
            {/* Interactive 1-5 Star Rating */}
            <div className="feedback-rating-group">
              <label className="feedback-field-label">
                Resolution Rating <span className="required-star">*</span>
              </label>
              <div
                className="feedback-stars-selector"
                role="radiogroup"
                aria-label="Rate issue resolution from 1 to 5 stars"
                onMouseLeave={() => setHoverRating(0)}
              >
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = star <= (hoverRating || rating);
                  return (
                    <button
                      key={star}
                      type="button"
                      role="radio"
                      aria-checked={rating === star}
                      aria-label={`${star} star${star > 1 ? 's' : ''} - ${RATING_LABELS[star]}`}
                      className={`star-btn ${isFilled ? 'star-filled' : 'star-empty'}`}
                      onClick={() => handleStarClick(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onKeyDown={(e) => handleStarKeyDown(e, star)}
                    >
                      ★
                    </button>
                  );
                })}
                <span className="active-rating-label">
                  {(hoverRating || rating) ? RATING_LABELS[hoverRating || rating] : 'Select a rating'}
                </span>
              </div>
            </div>

            {/* Optional Comment */}
            <div className="feedback-comment-group">
              <div className="feedback-label-row">
                <label htmlFor="feedback-comment" className="feedback-field-label">
                  Comments (Optional)
                </label>
                <span className={`char-counter ${comment.length > 480 ? 'char-counter-warn' : ''}`}>
                  {comment.length} / 500
                </span>
              </div>
              <textarea
                id="feedback-comment"
                className="feedback-textarea"
                rows="3"
                maxLength={500}
                placeholder="Share your experience regarding the repair quality, field team timeliness, or any remaining concerns..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* Error & Success Messages */}
            {errorMessage && (
              <div className="alert-box alert-error feedback-alert">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="alert-box alert-success feedback-alert">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>{successMessage}</span>
              </div>
            )}

            {/* Submit Action */}
            <div className="feedback-actions">
              <button
                type="submit"
                className="btn btn-primary feedback-submit-btn"
                disabled={submitting || rating < 1}
              >
                {submitting ? 'Submitting Feedback...' : 'Submit Resolution Feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default FeedbackForm;
