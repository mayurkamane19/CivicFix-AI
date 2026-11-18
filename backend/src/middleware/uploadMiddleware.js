import { upload } from '../services/uploadService.js';

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

export default {
  handleImageUpload
};
