import { upload, uploadMulti } from '../services/uploadService.js';

/**
 * Express middleware for single image upload field named 'image'
 * Handles Multer limit errors and unexpected field errors.
 */
export const handleImageUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const error = new Error('Image file size exceeds the 5MB limit');
        error.statusCode = 400;
        return next(error);
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        const error = new Error(`Unexpected field for file upload: '${err.field}'. Expected field name 'image'.`);
        error.statusCode = 400;
        return next(error);
      }
      if (!err.statusCode) {
        err.statusCode = 400;
      }
      return next(err);
    }
    next();
  });
};

/**
 * Express middleware for multiple resolution evidence photos:
 * Supports beforeImages, afterImages, and generic images fields (max 5 each)
 */
export const handleEvidenceUpload = (req, res, next) => {
  const fields = [
    { name: 'beforeImages', maxCount: 5 },
    { name: 'afterImages', maxCount: 5 },
    { name: 'images', maxCount: 5 },
    { name: 'evidenceImages', maxCount: 5 }
  ];

  uploadMulti.fields(fields)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const error = new Error('One or more images exceed the 5MB limit');
        error.statusCode = 400;
        return next(error);
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        const error = new Error(`Unexpected file field '${err.field}'. Allowed fields: beforeImages, afterImages, images, evidenceImages.`);
        error.statusCode = 400;
        return next(error);
      }
      if (!err.statusCode) {
        err.statusCode = 400;
      }
      return next(err);
    }
    next();
  });
};

/**
 * Helper for array upload (e.g. rejection evidence images)
 */
export const handleMultipleImages = (fieldName = 'images', maxCount = 5) => {
  return (req, res, next) => {
    uploadMulti.array(fieldName, maxCount)(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const error = new Error('One or more images exceed the 5MB limit');
          error.statusCode = 400;
          return next(error);
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          const error = new Error(`Unexpected field for upload: '${err.field}'. Expected '${fieldName}'.`);
          error.statusCode = 400;
          return next(error);
        }
        if (!err.statusCode) {
          err.statusCode = 400;
        }
        return next(err);
      }
      next();
    });
  };
};

export default {
  handleImageUpload,
  handleEvidenceUpload,
  handleMultipleImages
};
