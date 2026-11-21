import React, { useState, useEffect, useCallback } from 'react';
import { getDraftsByUser, deleteDraft, saveDraft } from '../../utils/indexedDb';
import { submitComplaintApi } from '../../services/api';
import './pwa.css';

/**
 * DraftsManagerModal
 * Allows citizens to view, edit, delete, and explicitly submit offline complaint drafts.
 */
export const DraftsManagerModal = ({
  isOpen,
  onClose,
  currentUser,
  onEditDraft,
  onDraftSubmitted
}) => {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const userEmail = currentUser?.email || 'guest';

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getDraftsByUser(userEmail);
      setDrafts(list);
    } catch (err) {
      console.warn('Could not read IndexedDB drafts:', err);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    if (isOpen) {
      loadDrafts();
      setStatusMessage(null);
    }
  }, [isOpen, loadDrafts]);

  if (!isOpen) return null;

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this saved draft?')) {
      return;
    }
    await deleteDraft(id);
    await loadDrafts();
  };

  const handleSubmitDraft = async (draft) => {
    // 1. Mandatory Explicit Citizen Confirmation
    const confirmed = window.confirm(
      `Submit draft "${draft.title || 'Untitled Complaint'}" to the municipal queue?`
    );
    if (!confirmed) return;

    if (!navigator.onLine) {
      alert('Cannot submit draft while offline. Please connect to the internet first.');
      return;
    }

    setSubmittingId(draft.id);
    setStatusMessage(null);

    try {
      let res;
      // Convert base64 photoData to File/Blob if available
      if (draft.photoData) {
        const fetchRes = await fetch(draft.photoData);
        const blob = await fetchRes.blob();
        const file = new File([blob], draft.photoName || 'complaint.jpg', { type: blob.type || 'image/jpeg' });

        const formData = new FormData();
        formData.append('title', draft.title);
        formData.append('description', draft.description);
        formData.append('category', draft.category);
        formData.append('severity', draft.severity || 'Medium');
        formData.append('address', draft.address);
        if (draft.latitude) formData.append('latitude', draft.latitude);
        if (draft.longitude) formData.append('longitude', draft.longitude);
        formData.append('image', file);

        res = await submitComplaintApi(formData);
      } else {
        res = await submitComplaintApi({
          title: draft.title,
          description: draft.description,
          category: draft.category,
          severity: draft.severity || 'Medium',
          address: draft.address,
          latitude: draft.latitude ? parseFloat(draft.latitude) : undefined,
          longitude: draft.longitude ? parseFloat(draft.longitude) : undefined
        });
      }

      setSubmittingId(null);

      if (res.success && res.data) {
        // Success: remove draft from IndexedDB
        await deleteDraft(draft.id);
        await loadDrafts();
        setStatusMessage({
          type: 'success',
          text: `Draft submitted successfully! Tracking Number: ${res.data.complaintId || res.data._id}`
        });
        if (onDraftSubmitted) onDraftSubmitted(res.data);
      } else {
        // Failure: preserve draft for retry and record error
        await saveDraft({ ...draft, lastError: res.error || 'Submission failed' }, userEmail);
        await loadDrafts();
        setStatusMessage({
          type: 'error',
          text: `Failed to submit draft: ${res.error || 'Network error'}. Draft preserved for retry.`
        });
      }
    } catch (err) {
      setSubmittingId(null);
      setStatusMessage({
        type: 'error',
        text: `Error submitting draft: ${err.message}. Draft preserved for retry.`
      });
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="pwa-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="drafts-title">
      <div className="pwa-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="pwa-modal-header">
          <div>
            <h2 id="drafts-title" className="pwa-modal-title">💾 Saved Offline Drafts</h2>
            <div className="pwa-modal-subtitle">
              {drafts.length} draft{drafts.length === 1 ? '' : 's'} stored securely in your browser's IndexedDB
            </div>
          </div>
          <button className="pwa-btn-close" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {statusMessage && (
          <div className={`pwa-status-alert ${statusMessage.type === 'success' ? 'pwa-alert-success' : 'pwa-alert-error'}`}>
            {statusMessage.type === 'success' ? '✓ ' : '⚠️ '}
            {statusMessage.text}
          </div>
        )}

        <div className="pwa-modal-body">
          {loading ? (
            <div className="pwa-loading-state">Loading saved drafts…</div>
          ) : drafts.length === 0 ? (
            <div className="pwa-empty-state">
              <span className="pwa-empty-icon">📂</span>
              <h3>No saved drafts</h3>
              <p>When you report civic issues while offline, drafts will be preserved here until you reconnect.</p>
            </div>
          ) : (
            <div className="pwa-drafts-list">
              {drafts.map((d) => (
                <div key={d.id} className="pwa-draft-card">
                  <div className="pwa-draft-header">
                    <span className="pwa-draft-category">📁 {d.category || 'General'}</span>
                    <span className="pwa-draft-status-badge">Saved Locally</span>
                  </div>

                  <h4 className="pwa-draft-title">{d.title || 'Untitled Draft'}</h4>
                  <p className="pwa-draft-desc">{d.description || 'No description provided.'}</p>

                  <div className="pwa-draft-meta">
                    <span>📍 {d.address || 'Location on map'}</span>
                    <span>🕐 Saved: {formatDate(d.updatedAt)}</span>
                    {d.photoName && <span>📷 {d.photoName}</span>}
                  </div>

                  {d.lastError && (
                    <div className="pwa-draft-error-notice">
                      ⚠️ Previous attempt failed: {d.lastError}
                    </div>
                  )}

                  <div className="pwa-draft-actions">
                    <button
                      type="button"
                      className="pwa-btn pwa-btn-primary"
                      disabled={submittingId === d.id}
                      onClick={() => handleSubmitDraft(d)}
                    >
                      {submittingId === d.id ? 'Submitting…' : '🚀 Submit Report'}
                    </button>
                    {onEditDraft && (
                      <button
                        type="button"
                        className="pwa-btn pwa-btn-outline"
                        onClick={() => {
                          onEditDraft(d);
                          onClose();
                        }}
                      >
                        ✏️ Edit in Wizard
                      </button>
                    )}
                    <button
                      type="button"
                      className="pwa-btn pwa-btn-danger"
                      onClick={() => handleDelete(d.id)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DraftsManagerModal;
