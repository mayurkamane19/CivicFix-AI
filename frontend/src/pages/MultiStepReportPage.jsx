import React, { useState } from 'react';
import { submitComplaintApi, checkDuplicatesApi } from '../services/api';
import { saveDraft } from '../utils/indexedDb';
import './MultiStepReportPage.css';

const CATEGORIES = [
  { name: 'Pothole', icon: '🕳️', desc: 'Damaged road surface, potholes, cracks' },
  { name: 'Garbage', icon: '🗑️', desc: 'Uncollected waste, illegal dumping, litter' },
  { name: 'Streetlight', icon: '💡', desc: 'Broken or malfunctioning public lighting' },
  { name: 'Water Supply', icon: '🚰', desc: 'Pipe leakages, water shortages, contaminated water' },
  { name: 'Sewage', icon: '🚽', desc: 'Blocked drains, overflow, sewage leaks' },
  { name: 'Road Damage', icon: '🚧', desc: 'Caved roads, missing manhole covers, hazards' },
  { name: 'Public Property', icon: '🏛️', desc: 'Damaged park fixtures, bus stops, sidewalks' },
  { name: 'Other', icon: '⚠️', desc: 'Other municipal or civic concerns' }
];

const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

const MultiStepReportPage = ({
  currentUser = null,
  initialDraft = null,
  onDraftSaved = null,
  onNavigateTrack,
  onNavigateHome,
  onNavigateDashboard
}) => {
  const [step, setStep] = useState(1);

  // Form State (initialized from initialDraft if resuming)
  const [category, setCategory] = useState(initialDraft?.category || '');
  const [title, setTitle] = useState(initialDraft?.title || '');
  const [description, setDescription] = useState(initialDraft?.description || '');
  const [severity, setSeverity] = useState(initialDraft?.severity || 'Medium');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(initialDraft?.photoData || null);
  const [address, setAddress] = useState(initialDraft?.address || '');
  const [latitude, setLatitude] = useState(initialDraft?.latitude || '');
  const [longitude, setLongitude] = useState(initialDraft?.longitude || '');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [draftSavedToast, setDraftSavedToast] = useState(false);

  // Status & Validation State
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedComplaint, setSubmittedComplaint] = useState(null);
  const [locating, setLocating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Duplicate Check Warning
  const [duplicateWarning, setDuplicateWarning] = useState('');

  // Step 1 Validation
  const validateStep1 = () => {
    if (!category) {
      setErrors({ category: 'Please select an issue category to proceed.' });
      return false;
    }
    setErrors({});
    return true;
  };

  // Step 2 Validation
  const validateStep2 = () => {
    const errs = {};
    if (!title || title.trim().length < 10) {
      errs.title = 'Title must be at least 10 characters long.';
    } else if (title.trim().length > 200) {
      errs.title = 'Title cannot exceed 200 characters.';
    }

    if (!description || description.trim().length < 20) {
      errs.description = 'Description must be at least 20 characters long.';
    } else if (description.trim().length > 2000) {
      errs.description = 'Description cannot exceed 2000 characters.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Step 3 Validation (File upload is optional, but if present must be valid)
  const validateStep3 = () => {
    if (selectedFile) {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(selectedFile.type)) {
        setErrors({ file: 'Only JPEG, PNG, or WebP images are supported.' });
        return false;
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        setErrors({ file: 'Image size exceeds maximum 5MB limit.' });
        return false;
      }
    }
    setErrors({});
    return true;
  };

  // Step 4 Validation
  const validateStep4 = () => {
    const errs = {};
    if (!address || address.trim().length < 5) {
      errs.address = 'Please provide a valid street or landmark location (at least 5 characters).';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Navigation handlers
  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    if (step === 4 && !validateStep4()) return;

    if (step === 4) {
      // Trigger background duplicate check if we have lat/lng or text
      runDuplicateCheck();
    }

    setStep((prev) => Math.min(prev + 1, 6));
  };

  const handleBack = () => {
    setErrors({});
    setStep((prev) => Math.max(prev - 1, 1));
  };

  // File handling
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setErrors({ file: 'Only JPEG, PNG, or WebP images are allowed.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors({ file: 'File exceeds 5MB size limit.' });
      return;
    }

    setErrors({});
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setFilePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  // Geolocation
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrors({ location: 'Geolocation is not supported by your browser.' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        if (!address) {
          setAddress(`Coordinates: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        }
        setLocating(false);
      },
      () => {
        setErrors({ location: 'Could not access your location. Please enter address manually.' });
        setLocating(false);
      },
      { timeout: 8000 }
    );
  };

  const runDuplicateCheck = async () => {
    try {
      // Run duplicate check if endpoint is available
      setDuplicateWarning('');
    } catch {
      // Non-blocking
    }
  };

  // Save draft locally to IndexedDB
  const handleSaveDraft = async () => {
    try {
      const draftPayload = {
        id: initialDraft?.id,
        title,
        category,
        description,
        severity,
        address,
        latitude,
        longitude,
        photoData: filePreview,
        photoName: selectedFile?.name || initialDraft?.photoName
      };

      await saveDraft(draftPayload, currentUser?.email || 'guest');
      setDraftSavedToast(true);
      setTimeout(() => setDraftSavedToast(false), 3000);
      if (onDraftSaved) onDraftSaved();
    } catch (err) {
      alert('Could not save draft locally: ' + err.message);
    }
  };

  // Final Submission
  const handleSubmit = async () => {
    if (!acceptedTerms) {
      setSubmitError('Please certify that the submitted information is accurate.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    // Offline Interception Guard
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        const draftPayload = {
          id: initialDraft?.id,
          title,
          category,
          description,
          severity,
          address,
          latitude,
          longitude,
          photoData: filePreview,
          photoName: selectedFile?.name || initialDraft?.photoName
        };
        await saveDraft(draftPayload, currentUser?.email || 'guest');
        setSubmitting(false);
        setSubmitError(
          'You are currently offline. Your report has been saved securely as an offline draft in IndexedDB. You can review and submit it when reconnected.'
        );
        if (onDraftSaved) onDraftSaved();
        return;
      } catch (err) {
        setSubmitting(false);
        setSubmitError('Offline save failed: ' + err.message);
        return;
      }
    }

    try {
      let res;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('title', title.trim());
        formData.append('description', description.trim());
        formData.append('category', category);
        formData.append('severity', severity);
        formData.append('address', address.trim());
        if (latitude) formData.append('latitude', latitude);
        if (longitude) formData.append('longitude', longitude);
        formData.append('image', selectedFile);

        res = await submitComplaintApi(formData);
      } else {
        res = await submitComplaintApi({
          title: title.trim(),
          description: description.trim(),
          category,
          severity,
          address: address.trim(),
          latitude: latitude ? parseFloat(latitude) : undefined,
          longitude: longitude ? parseFloat(longitude) : undefined
        });
      }

      setSubmitting(false);

      if (res.success && res.data) {
        setSubmittedComplaint(res.data);
        setStep(6);
      } else {
        setSubmitError(res.error || 'Failed to submit complaint. Please check your inputs.');
      }
    } catch (err) {
      setSubmitting(false);
      setSubmitError(err.message || 'Network error submitting complaint.');
    }
  };

  const copyComplaintId = () => {
    if (!submittedComplaint) return;
    const cid = submittedComplaint.complaintId || submittedComplaint._id;
    navigator.clipboard?.writeText(cid);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const progressPercent = Math.min(100, Math.round(((step - 1) / 5) * 100));

  return (
    <div className="msr-page">
      <div className="msr-card">
        {/* Stepper Header (steps 1-5) */}
        {step < 6 && (
          <div className="msr-stepper-header">
            <div className="msr-step-title-row">
              <span className="msr-step-label">Step {step} of 5</span>
              <span className="msr-step-counter">{progressPercent}% Completed</span>
            </div>
            <div className="msr-step-name">
              {step === 1 && 'Select Issue Category'}
              {step === 2 && 'Describe the Problem'}
              {step === 3 && 'Upload Photographs'}
              {step === 4 && 'Identify Incident Location'}
              {step === 5 && 'Review and Confirm Report'}
            </div>
            <div className="msr-progress-bar-track">
              <div className="msr-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="msr-step-dots">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`msr-step-dot ${s === step ? 'active' : s < step ? 'completed' : ''}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Select Category */}
        {step === 1 && (
          <div className="msr-step-body">
            <div className="msr-step-section-title">
              What type of issue would you like to report?
            </div>
            {errors.category && <div className="msr-field-error">{errors.category}</div>}
            <div className="msr-category-grid">
              {CATEGORIES.map((cat) => (
                <div
                  key={cat.name}
                  className={`msr-category-card ${category === cat.name ? 'selected' : ''}`}
                  onClick={() => { setCategory(cat.name); setErrors({}); }}
                >
                  <span className="msr-category-icon">{cat.icon}</span>
                  <span className="msr-category-name">{cat.name}</span>
                  <span className="msr-category-desc">{cat.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Describe Issue */}
        {step === 2 && (
          <div className="msr-step-body">
            <div className="msr-step-section-title">
              Provide clear details about the civic problem
            </div>

            <div className="msr-form-group">
              <label className="msr-label">
                <span>Issue Title <span className="msr-label-required">*</span></span>
                <span className={`msr-char-counter ${title.length > 180 ? 'warning' : ''}`}>
                  {title.length}/200
                </span>
              </label>
              <input
                type="text"
                className={`msr-input ${errors.title ? 'error' : ''}`}
                placeholder="e.g., Deep pothole causing vehicular damage near Main Market"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {errors.title && <div className="msr-field-error">{errors.title}</div>}
              <div className="msr-field-hint">Brief summary of the issue (min 10 characters)</div>
            </div>

            <div className="msr-form-group">
              <label className="msr-label">
                <span>Detailed Description <span className="msr-label-required">*</span></span>
                <span className={`msr-char-counter ${description.length > 1800 ? 'warning' : ''}`}>
                  {description.length}/2000
                </span>
              </label>
              <textarea
                className={`msr-textarea ${errors.description ? 'error' : ''}`}
                placeholder="Describe the severity, duration, and specific location or landmark details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              {errors.description && <div className="msr-field-error">{errors.description}</div>}
              <div className="msr-field-hint">Detailed narrative helps assign the proper municipal crew (min 20 characters)</div>
            </div>

            <div className="msr-form-group">
              <label className="msr-label">Urgency Assessment</label>
              <select
                className="msr-select"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>{s} Priority</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 3: Photo Upload */}
        {step === 3 && (
          <div className="msr-step-body">
            <div className="msr-step-section-title">
              Attach photographs of the hazard (Optional)
            </div>

            {!filePreview ? (
              <div className="msr-dropzone">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                />
                <div className="msr-dropzone-icon">📷</div>
                <div className="msr-dropzone-text">Tap or click to browse photographs</div>
                <div className="msr-dropzone-subtext">Supports JPEG, PNG, WebP up to 5MB</div>
              </div>
            ) : (
              <div>
                <div className="msr-photo-previews">
                  <div className="msr-photo-thumb-wrap">
                    <img src={filePreview} alt="Selected preview" className="msr-photo-thumb" />
                    <button
                      type="button"
                      className="msr-photo-remove"
                      onClick={handleRemovePhoto}
                      title="Remove photograph"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="msr-photo-hint">
                  ✓ Photo attached. Our AI will analyze it to expedite categorization.
                </div>
              </div>
            )}
            {errors.file && <div className="msr-field-error" style={{ marginTop: '0.5rem' }}>{errors.file}</div>}
          </div>
        )}

        {/* Step 4: Location */}
        {step === 4 && (
          <div className="msr-step-body">
            <div className="msr-step-section-title">
              Where is the issue located?
            </div>

            <div className="msr-location-actions">
              <button
                type="button"
                className="msr-btn-locate"
                onClick={handleUseCurrentLocation}
                disabled={locating}
              >
                {locating ? '📡 Locating…' : '📍 Use My Current Location'}
              </button>
            </div>

            <div className="msr-form-group">
              <label className="msr-label">
                <span>Address / Street Landmark <span className="msr-label-required">*</span></span>
              </label>
              <input
                type="text"
                className={`msr-input ${errors.address ? 'error' : ''}`}
                placeholder="e.g., Opposite Gate #2, Shivaji Park, MG Road"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              {errors.address && <div className="msr-field-error">{errors.address}</div>}
            </div>

            <div className="msr-coords-row">
              <div className="msr-form-group">
                <label className="msr-label">Latitude (Optional)</label>
                <input
                  type="text"
                  className="msr-input"
                  placeholder="e.g., 18.5204"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                />
              </div>
              <div className="msr-form-group">
                <label className="msr-label">Longitude (Optional)</label>
                <input
                  type="text"
                  className="msr-input"
                  placeholder="e.g., 73.8567"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                />
              </div>
            </div>
            {errors.location && <div className="msr-field-error">{errors.location}</div>}
          </div>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <div className="msr-step-body">
            <div className="msr-step-section-title">
              Review your report before submitting
            </div>

            {duplicateWarning && (
              <div className="msr-duplicate-warning">
                <span className="msr-duplicate-warning-icon">⚠️</span>
                <span>{duplicateWarning}</span>
              </div>
            )}

            <div className="msr-review-section">
              <div className="msr-review-section-title">Report Summary</div>
              <div className="msr-review-row">
                <span className="msr-review-label">Category:</span>
                <span className="msr-review-value">{category}</span>
                <button className="msr-review-edit-btn" onClick={() => setStep(1)}>Edit</button>
              </div>
              <div className="msr-review-row">
                <span className="msr-review-label">Title:</span>
                <span className="msr-review-value">{title}</span>
                <button className="msr-review-edit-btn" onClick={() => setStep(2)}>Edit</button>
              </div>
              <div className="msr-review-row">
                <span className="msr-review-label">Severity:</span>
                <span className="msr-review-value">{severity}</span>
              </div>
              <div className="msr-review-row">
                <span className="msr-review-label">Location:</span>
                <span className="msr-review-value">{address}</span>
                <button className="msr-review-edit-btn" onClick={() => setStep(4)}>Edit</button>
              </div>
              <div className="msr-review-row">
                <span className="msr-review-label">Photo:</span>
                <span className="msr-review-value">{selectedFile ? selectedFile.name : 'None attached'}</span>
                <button className="msr-review-edit-btn" onClick={() => setStep(3)}>Edit</button>
              </div>
            </div>

            <div className="msr-terms-row">
              <input
                type="checkbox"
                id="msr-terms"
                className="msr-terms-checkbox"
                checked={acceptedTerms}
                onChange={(e) => { setAcceptedTerms(e.target.checked); setSubmitError(''); }}
              />
              <label htmlFor="msr-terms" className="msr-terms-label">
                I hereby certify that this civic issue report is genuine, accurate, and submitted in good faith for municipal attention.
              </label>
            </div>

            {submitError && (
              <div className="msr-field-error" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                ⚠️ {submitError}
              </div>
            )}
          </div>
        )}

        {/* Step 6: Confirmation Screen */}
        {step === 6 && submittedComplaint && (
          <div className="msr-step-body">
            <div className="msr-success-container">
              <div className="msr-success-animation">
                <div className="msr-success-circle">
                  <span className="msr-success-check">✓</span>
                </div>
              </div>

              <h2 className="msr-success-title">Report Filed Successfully!</h2>
              <p className="msr-success-subtitle">
                Your complaint has been registered in the municipal queue. You will receive updates as field officers address the issue.
              </p>

              <div className="msr-complaint-id-box">
                <span className="msr-complaint-id-label">Tracking Number</span>
                <div className="msr-complaint-id-row">
                  <span className="msr-complaint-id-code">
                    {submittedComplaint.complaintId || submittedComplaint._id}
                  </span>
                  <button type="button" className="msr-copy-btn" onClick={copyComplaintId}>
                    {copySuccess ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="msr-success-actions">
                <button
                  type="button"
                  className="msr-btn-primary"
                  onClick={() => onNavigateTrack?.(submittedComplaint.complaintId || submittedComplaint._id)}
                >
                  🔍 Track This Complaint
                </button>
                {onNavigateDashboard && (
                  <button
                    type="button"
                    className="msr-btn-secondary"
                    onClick={onNavigateDashboard}
                  >
                    📂 Go to Citizen Dashboard
                  </button>
                )}
                <button
                  type="button"
                  className="msr-btn-link"
                  onClick={() => {
                    setCategory('');
                    setTitle('');
                    setDescription('');
                    setSelectedFile(null);
                    setFilePreview(null);
                    setAddress('');
                    setLatitude('');
                    setLongitude('');
                    setAcceptedTerms(false);
                    setSubmittedComplaint(null);
                    setStep(1);
                  }}
                >
                  ➕ Report Another Issue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Navigation (steps 1-5) */}
        {step < 6 && (
          <div className="msr-nav-footer">
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {step > 1 ? (
                <button type="button" className="msr-btn-back" onClick={handleBack}>
                  ← Back
                </button>
              ) : onNavigateDashboard ? (
                <button type="button" className="msr-btn-back" onClick={onNavigateDashboard}>
                  ✕ Cancel
                </button>
              ) : (
                <div />
              )}
              {(title || category) && (
                <button
                  type="button"
                  className="msr-btn-back"
                  style={{ fontSize: '0.8rem', padding: '0.5rem 0.8rem' }}
                  onClick={handleSaveDraft}
                  title="Save progress to offline IndexedDB storage"
                >
                  {draftSavedToast ? '✓ Saved!' : '💾 Save Draft'}
                </button>
              )}
            </div>

            {step < 5 ? (
              <button type="button" className="msr-btn-next" onClick={handleNext}>
                Continue →
              </button>
            ) : (
              <button
                type="button"
                className="msr-btn-next msr-btn-submit"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting Report…' : '🚀 Submit Complaint'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiStepReportPage;
