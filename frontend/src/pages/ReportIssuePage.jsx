import React, { useState, useRef, useEffect } from 'react';
import { submitComplaintApi, getStoredUser } from '../services/api';

const CATEGORIES = [
  'Road Damage',
  'Garbage',
  'Water Leakage',
  'Streetlight',
  'Drainage',
  'Other'
];

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const ReportIssuePage = ({ onNavigateTrack, onNavigateHome }) => {
  const currentUser = getStoredUser();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    address: '',
    latitude: '',
    longitude: '',
    citizenEmail: currentUser?.email || '',
    emailNotificationsEnabled: currentUser?.emailNotificationsEnabled || false
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedData, setSubmittedData] = useState(null);
  const [copied, setCopied] = useState(false);

  // Revoke object URL on unmount or when image changes
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMessage) setErrorMessage('');
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (errorMessage) setErrorMessage('');

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setErrorMessage('Unsupported image format. Please select a JPEG, PNG, or WebP photo.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate size limit (5MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage('Image exceeds the maximum allowed size of 5 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleCopyId = () => {
    if (submittedData?.complaintId) {
      navigator.clipboard.writeText(submittedData.complaintId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Client-side validations
    if (!formData.title.trim()) {
      setErrorMessage('Please provide a complaint title.');
      return;
    }

    if (formData.title.trim().length < 3) {
      setErrorMessage('Title must be at least 3 characters long.');
      return;
    }

    if (!formData.category) {
      setErrorMessage('Please select an issue category.');
      return;
    }

    if (!formData.description.trim()) {
      setErrorMessage('Please provide a detailed description of the issue.');
      return;
    }

    if (formData.description.trim().length < 10) {
      setErrorMessage('Description must be at least 10 characters long.');
      return;
    }

    if (!formData.address.trim()) {
      setErrorMessage('Please specify the incident location or address.');
      return;
    }

    if (formData.latitude !== '') {
      const lat = Number(formData.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        setErrorMessage('Latitude must be a valid number between -90 and 90.');
        return;
      }
    }

    if (formData.longitude !== '') {
      const lng = Number(formData.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        setErrorMessage('Longitude must be a valid number between -180 and 180.');
        return;
      }
    }

    if (formData.emailNotificationsEnabled) {
      if (!formData.citizenEmail.trim()) {
        setErrorMessage('Please provide an email address to receive update notifications, or uncheck the email notification option.');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.citizenEmail.trim())) {
        setErrorMessage('Please provide a valid email address for notifications.');
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        address: formData.address.trim(),
        ...(formData.latitude !== '' && { latitude: Number(formData.latitude) }),
        ...(formData.longitude !== '' && { longitude: Number(formData.longitude) }),
        ...(formData.citizenEmail.trim() && { citizenEmail: formData.citizenEmail.trim() }),
        emailNotificationsEnabled: Boolean(formData.emailNotificationsEnabled && formData.citizenEmail.trim())
      };

      const result = await submitComplaintApi(payload, imageFile);

      if (result.success) {
        setSubmittedData(result.data);
      } else {
        setErrorMessage(result.error || 'Failed to submit complaint. Please try again.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Reset form to submit another complaint
  const handleReset = () => {
    handleRemoveImage();
    setSubmittedData(null);
    setFormData({
      title: '',
      description: '',
      category: '',
      address: '',
      latitude: '',
      longitude: '',
      citizenEmail: currentUser?.email || '',
      emailNotificationsEnabled: currentUser?.emailNotificationsEnabled || false
    });
    setErrorMessage('');
  };

  // ---------------------------------------------------------------------------
  // Success Confirmation Screen
  // ---------------------------------------------------------------------------
  if (submittedData) {
    return (
      <div className="auth-page-container">
        <div className="auth-card report-success-card">
          <div className="success-icon-badge">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>

          <h2 className="auth-title">Issue Reported Successfully!</h2>
          <p className="auth-subtitle">
            Your complaint has been registered with the municipal response system under ticket ID:
          </p>

          <div className="complaint-id-box">
            <span className="complaint-id-label">Tracking Number</span>
            <div className="complaint-id-row">
              <code className="complaint-id-code">{submittedData.complaintId}</code>
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={handleCopyId}
                title="Copy to clipboard"
              >
                {copied ? '✓ Copied' : 'Copy ID'}
              </button>
            </div>
          </div>

          <div className="summary-details">
            <div className="summary-item">
              <span className="summary-label">Title:</span>
              <span className="summary-val">{submittedData.title}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Category:</span>
              <span className="summary-val">{submittedData.category}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Status:</span>
              <span className="status-badge-mini status-pending">{submittedData.status}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Address:</span>
              <span className="summary-val">{submittedData.address}</span>
            </div>

            {submittedData.emailNotificationsEnabled && (
              <div className="summary-item" style={{ background: '#f0fdf4', padding: '8px 12px', borderRadius: '6px', border: '1px solid #bbf7d0', color: '#166534', fontSize: '13px' }}>
                <span>📧 <strong>Email alerts enabled:</strong> A registration confirmation and subsequent milestone updates will be delivered to your inbox.</span>
              </div>
            )}

            {submittedData.imageUrl && (
              <div className="summary-item summary-photo-item">
                <span className="summary-label">Attached Photo:</span>
                <div className="summary-photo-preview-box">
                  <img
                    src={submittedData.imageUrl}
                    alt="Uploaded incident visual evidence"
                    className="summary-photo-thumb"
                  />
                  <a
                    href={submittedData.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="summary-photo-link"
                  >
                    View Full Image ↗
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* AI Municipal Advisory Section (Phase 6) */}
          {submittedData.aiAnalysis && (
            <div className="ai-advisory-card">
              <div className="ai-advisory-header">
                <div className="ai-badge-row">
                  <span className="ai-sparkle-icon">✨</span>
                  <span className="ai-badge-title">Google Gemini Municipal Advisory</span>
                </div>
                <span className="ai-disclaimer-pill">AI Advisory • Citizen Input Preserved</span>
              </div>

              {submittedData.aiAnalysis.status === 'Completed' ? (
                <div className="ai-advisory-body">
                  <div className="ai-metric-row">
                    <div className="ai-metric-item">
                      <span className="ai-metric-label">Estimated Severity</span>
                      <span className={`severity-pill severity-pill-${(submittedData.aiAnalysis.severity || 'medium').toLowerCase()}`}>
                        <span className="severity-dot"></span>
                        {submittedData.aiAnalysis.severity} Severity
                      </span>
                    </div>
                    <div className="ai-metric-item">
                      <span className="ai-metric-label">AI Suggested Category</span>
                      <div className="ai-category-compare">
                        <span className="ai-suggested-tag">{submittedData.aiAnalysis.suggestedCategory}</span>
                        {submittedData.aiAnalysis.suggestedCategory !== submittedData.category && (
                          <span className="ai-compare-note">(Citizen filed: {submittedData.category})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="ai-detail-block">
                    <span className="ai-block-label">Automated Issue Summary</span>
                    <p className="ai-summary-text">{submittedData.aiAnalysis.summary}</p>
                  </div>

                  <div className="ai-detail-block">
                    <span className="ai-block-label">Recommended Response Department</span>
                    <span className="ai-department-tag">{submittedData.aiAnalysis.recommendedDepartment}</span>
                  </div>

                  <div className="ai-detail-block">
                    <span className="ai-block-label">Suggested Action for Field Crews</span>
                    <p className="ai-action-text">{submittedData.aiAnalysis.suggestedAction}</p>
                  </div>
                </div>
              ) : submittedData.aiAnalysis.status === 'Failed' ? (
                <div className="ai-status-note ai-status-failed">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>
                    AI automated analysis temporarily unavailable ({submittedData.aiAnalysis.errorMessage || 'Queued for municipal inspection'}).
                  </span>
                </div>
              ) : (
                <div className="ai-status-note ai-status-pending">
                  <span className="status-dot"></span>
                  <span>AI analysis is queued for processing.</span>
                </div>
              )}
            </div>
          )}

          {/* Similar Complaints Found Section (Phase 7) */}
          {submittedData.duplicateCheck && (
            <div className="duplicate-check-card">
              <div className="duplicate-check-header">
                <div className="duplicate-badge-row">
                  <span className="duplicate-icon">📋</span>
                  <span className="duplicate-title">Similar Complaints Found</span>
                </div>
                <span className="duplicate-disclaimer-pill">
                  {submittedData.duplicateCheck.isPotentialDuplicate
                    ? 'Potential Match Advisory'
                    : 'Unique Report Verified'}
                </span>
              </div>

              {submittedData.duplicateCheck.status === 'Completed' ? (
                submittedData.duplicateCheck.isPotentialDuplicate &&
                submittedData.duplicateCheck.matchedComplaints &&
                submittedData.duplicateCheck.matchedComplaints.length > 0 ? (
                  <div className="duplicate-matches-wrapper">
                    <p className="duplicate-advisory-intro">
                      Our similarity detection identified <strong>{submittedData.duplicateCheck.matchedComplaints.length}</strong> existing ticket(s) with similar descriptions or nearby location. Your new ticket remains registered for independent review:
                    </p>

                    <div className="duplicate-matches-list">
                      {submittedData.duplicateCheck.matchedComplaints.map((match) => (
                        <div key={match.complaintId} className="duplicate-match-item">
                          <div className="duplicate-match-top">
                            <span className="duplicate-match-id">{match.complaintId}</span>
                            <span className={`confidence-pill confidence-${(match.confidence || 'medium').toLowerCase()}`}>
                              {match.confidence} Similarity ({Math.round(match.similarityScore * 100)}%)
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
                  </div>
                ) : (
                  <div className="duplicate-none-found">
                    <span className="check-mark">✓</span>
                    <span>No similar complaints found. Your issue report appears to be unique in this vicinity.</span>
                  </div>
                )
              ) : (
                <div className="duplicate-none-found" style={{ color: 'var(--slate-500)' }}>
                  <span>Duplicate detection check was unavailable during submission.</span>
                </div>
              )}
            </div>
          )}

          <div className="success-actions">
            <button
              type="button"
              className="btn btn-primary full-width btn-large"
              onClick={() => onNavigateTrack(submittedData.complaintId)}
            >
              Track This Issue Live &rarr;
            </button>
            <div className="success-subactions">
              <button
                type="button"
                className="link-button"
                onClick={handleReset}
              >
                + Report Another Issue
              </button>
              <button
                type="button"
                className="link-button back-link"
                onClick={onNavigateHome}
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Submission Form Screen
  // ---------------------------------------------------------------------------
  return (
    <div className="auth-page-container">
      <div className="auth-card report-form-card">
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
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="auth-title">Report a Public Issue</h2>
          <p className="auth-subtitle">
            Submit municipal infrastructure hazards or civic sanitation concerns for inspection and resolution
          </p>
        </div>

        {/* Guest Submission Notice */}
        <div className="guest-notice-banner">
          <span className="guest-notice-badge">Guest Submission</span>
          <span className="guest-notice-text">
            No account required. You will receive an instant unique Complaint ID to track resolution progress.
          </span>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="alert-box alert-error">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {/* Title */}
          <div className="form-group">
            <label className="form-label" htmlFor="complaint-title">
              Complaint Title <span className="label-required">*</span>
            </label>
            <input
              id="complaint-title"
              type="text"
              name="title"
              className="form-input"
              placeholder="e.g. Hazardous deep pothole near crosswalk"
              value={formData.title}
              onChange={handleChange}
              disabled={loading}
              maxLength={150}
              required
            />
          </div>

          {/* Category */}
          <div className="form-group">
            <label className="form-label" htmlFor="complaint-category">
              Issue Category <span className="label-required">*</span>
            </label>
            <select
              id="complaint-category"
              name="category"
              className="form-input form-select"
              value={formData.category}
              onChange={handleChange}
              disabled={loading}
              required
            >
              <option value="">-- Select an issue category --</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="form-group">
            <div className="label-row">
              <label className="form-label" htmlFor="complaint-description">
                Incident Description <span className="label-required">*</span>
              </label>
              <span className="label-hint">Min 10 characters</span>
            </div>
            <textarea
              id="complaint-description"
              name="description"
              className="form-input form-textarea"
              placeholder="Describe the problem, severity, approximate duration, and impact on traffic or public safety..."
              rows={4}
              value={formData.description}
              onChange={handleChange}
              disabled={loading}
              maxLength={2000}
              required
            />
          </div>

          {/* Address */}
          <div className="form-group">
            <label className="form-label" htmlFor="complaint-address">
              Complete Location Address <span className="label-required">*</span>
            </label>
            <input
              id="complaint-address"
              type="text"
              name="address"
              className="form-input"
              placeholder="e.g. In front of 142 Elm St, near Lincoln Park intersection"
              value={formData.address}
              onChange={handleChange}
              disabled={loading}
              maxLength={300}
              required
            />
          </div>

          {/* Optional Coordinates (Latitude & Longitude) */}
          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label" htmlFor="complaint-lat">
                Latitude <span className="label-optional">(Optional)</span>
              </label>
              <input
                id="complaint-lat"
                type="number"
                step="any"
                name="latitude"
                className="form-input"
                placeholder="e.g. 37.7749"
                value={formData.latitude}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="complaint-lng">
                Longitude <span className="label-optional">(Optional)</span>
              </label>
              <input
                id="complaint-lng"
                type="number"
                step="any"
                name="longitude"
                className="form-input"
                placeholder="e.g. -122.4194"
                value={formData.longitude}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          {/* Image Upload Field (Optional) */}
          <div className="form-group">
            <div className="label-row">
              <label className="form-label" htmlFor="complaint-image">
                Issue Photo Evidence <span className="label-optional">(Optional)</span>
              </label>
              <span className="label-hint">JPEG, PNG, WebP up to 5 MB</span>
            </div>

            {/* Hidden File Input */}
            <input
              id="complaint-image"
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              onChange={handleImageChange}
              disabled={loading}
              style={{ display: 'none' }}
            />

            {!imagePreview ? (
              <div
                className="file-upload-dropzone"
                onClick={() => !loading && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <div className="upload-icon-wrapper">
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <div className="upload-prompt">
                  <span className="upload-prompt-primary">Click to select a photo</span>
                  <span className="upload-prompt-secondary">Attach visual proof of the issue for municipal field crews</span>
                </div>
              </div>
            ) : (
              <div className="file-preview-card">
                <div className="file-preview-content">
                  <img
                    src={imagePreview}
                    alt="Incident preview"
                    className="file-preview-thumb"
                  />
                  <div className="file-preview-info">
                    <span className="file-name" title={imageFile?.name}>
                      {imageFile?.name}
                    </span>
                    <span className="file-size">
                      {imageFile ? formatFileSize(imageFile.size) : ''}
                    </span>
                    <button
                      type="button"
                      className="link-button change-photo-link"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                    >
                      Change Photo
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-remove-photo"
                  onClick={handleRemoveImage}
                  disabled={loading}
                  title="Remove this photo"
                  aria-label="Remove attached photo"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Email Notification Opt-In Section (Phase 13) */}
          <div className="notification-optin-box" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', margin: '16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <input
                id="complaint-email-optin"
                type="checkbox"
                name="emailNotificationsEnabled"
                checked={formData.emailNotificationsEnabled}
                onChange={(e) => setFormData(prev => ({ ...prev, emailNotificationsEnabled: e.target.checked }))}
                style={{ marginTop: '4px', cursor: 'pointer' }}
                disabled={loading}
              />
              <label htmlFor="complaint-email-optin" style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>
                Keep me updated via email
                <span style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: '#64748b', marginTop: '2px' }}>
                  Receive automated alerts when municipal dispatchers assign field crews or resolve this issue.
                </span>
              </label>
            </div>

            {formData.emailNotificationsEnabled && (
              <div className="form-group" style={{ marginTop: '12px', marginBottom: 0 }}>
                <label className="form-label" htmlFor="complaint-citizen-email" style={{ fontSize: '13px' }}>
                  Email Address for Updates <span className="label-required">*</span>
                </label>
                <input
                  id="complaint-citizen-email"
                  type="email"
                  name="citizenEmail"
                  className="form-input"
                  placeholder="your.email@example.com"
                  value={formData.citizenEmail}
                  onChange={handleChange}
                  disabled={loading}
                  required={formData.emailNotificationsEnabled}
                />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  🛡️ Privacy Guarantee: Your email address is confidential, strictly used for ticket milestones, and never shown publicly.
                </span>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary full-width btn-large"
            disabled={loading}
          >
            {loading
              ? (imageFile ? 'Uploading Photo & Submitting...' : 'Submitting Report...')
              : 'Submit Incident Report'}
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="auth-footer">
          <p className="auth-switch-text">
            Already have a ticket number?{' '}
            <button
              type="button"
              className="link-button"
              onClick={() => onNavigateTrack('')}
            >
              Track Complaint Here
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

export default ReportIssuePage;
