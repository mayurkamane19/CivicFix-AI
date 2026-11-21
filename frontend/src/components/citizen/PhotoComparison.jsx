import React, { useState } from 'react';

/**
 * PhotoComparison — side-by-side before/after photo display with lightbox.
 * Props:
 *   beforeImage  : { url, caption? } | null
 *   afterImage   : { url, caption? } | null
 *   beforeLabel  : string (default "Before")
 *   afterLabel   : string (default "After")
 */
const PhotoComparison = ({
  beforeImage = null,
  afterImage = null,
  beforeLabel = 'Before',
  afterLabel = 'After',
}) => {
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [beforeErr, setBeforeErr] = useState(false);
  const [afterErr, setAfterErr] = useState(false);

  const openLightbox = (src) => setLightboxSrc(src);
  const closeLightbox = () => setLightboxSrc(null);

  const PhotoSlot = ({ image, label, hasErr, onErr }) => (
    <div className="photo-comparison-slot">
      <div className={`photo-slot-label ${label === beforeLabel ? 'before-label' : 'after-label'}`}>
        {label === beforeLabel ? '📷' : '✅'} {label}
      </div>
      {image && image.url && !hasErr ? (
        <div
          className="photo-slot-img-wrapper"
          onClick={() => openLightbox(image.url)}
          title="Click to expand"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') openLightbox(image.url); }}
        >
          <img
            src={image.url}
            alt={`${label} photo`}
            className="photo-slot-img"
            onError={onErr}
            loading="lazy"
          />
          <div className="photo-slot-expand-hint">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
            Expand
          </div>
        </div>
      ) : (
        <div className="photo-slot-placeholder">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span>{image ? 'Photo could not be loaded' : `No ${label.toLowerCase()} photo`}</span>
        </div>
      )}
      {image?.caption && !hasErr && (
        <p className="photo-slot-caption">{image.caption}</p>
      )}
    </div>
  );

  if (!beforeImage && !afterImage) return null;

  return (
    <div className="photo-comparison-container">
      <div className="photo-comparison-grid">
        <PhotoSlot
          image={beforeImage}
          label={beforeLabel}
          hasErr={beforeErr}
          onErr={() => setBeforeErr(true)}
        />
        <div className="photo-comparison-divider">
          <span className="divider-arrow">→</span>
        </div>
        <PhotoSlot
          image={afterImage}
          label={afterLabel}
          hasErr={afterErr}
          onErr={() => setAfterErr(true)}
        />
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="photo-lightbox-overlay"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Photo lightbox"
        >
          <div
            className="photo-lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxSrc}
              alt="Expanded view"
              className="photo-lightbox-img"
            />
            <button
              type="button"
              className="photo-lightbox-close"
              onClick={closeLightbox}
              aria-label="Close lightbox"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoComparison;
