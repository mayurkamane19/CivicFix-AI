import path from 'path';
import multer from 'multer';
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Validates image buffer magic bytes against JPEG, PNG, and WebP signatures
 * Provides defense-in-depth against extension-spoofed binaries.
 * @param {Buffer} buffer
 * @returns {{isValid: boolean, format: string|null}}
 */
export const validateImageBuffer = (buffer) => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) {
    return { isValid: false, format: null, mimeType: null };
  }

  // 1. Check JPEG (SOI marker: 0xFF, 0xD8, 0xFF)
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isValid: true, format: 'jpeg', mimeType: 'image/jpeg' };
  }

  // 2. Check PNG (0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
  if (buffer.length >= 8) {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.subarray(0, 8).equals(pngHeader)) {
      return { isValid: true, format: 'png', mimeType: 'image/png' };
    }
  }

  // 3. Check WebP (RIFF header + WEBP sub-header at offset 8)
  if (buffer.length >= 12) {
    const isRiff = buffer.subarray(0, 4).toString('ascii') === 'RIFF';
    const isWebp = buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    if (isRiff && isWebp) {
      return { isValid: true, format: 'webp', mimeType: 'image/webp' };
    }
  }

  return { isValid: false, format: null, mimeType: null };
};

/**
 * Multer memory storage configuration (keeps files in RAM buffer)
 */
const storage = multer.memoryStorage();

/**
 * File filter to ensure only approved media formats are accepted
 */
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  const isValidMime = ALLOWED_MIME_TYPES.includes(mime);
  const isValidExt = ALLOWED_EXTENSIONS.includes(ext);

  if (isValidMime && isValidExt) {
    return cb(null, true);
  }

  const error = new Error(
    `Unsupported image format. Allowed formats: JPEG, PNG, WebP (received: ${ext || mime || 'unknown'})`
  );
  error.statusCode = 400;
  return cb(error, false);
};

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1
  },
  fileFilter
});

export const uploadMulti = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 5
  },
  fileFilter
});

let mockUploader = null;

/**
 * Injects a mock uploader function for unit testing without live Cloudinary calls
 * @param {Function|null} fn
 */
export const setMockUploader = (fn) => {
  mockUploader = fn;
};

/**
 * Resets the uploader to standard Cloudinary operation
 */
export const resetUploader = () => {
  mockUploader = null;
};

/**
 * Uploads an in-memory image buffer to Cloudinary in the civicfix/complaints folder
 * @param {Buffer} buffer
 * @param {string} originalname
 * @returns {Promise<{secure_url: string, public_id: string, format: string, bytes: number}>}
 */
export const uploadImageToCloudinary = async (buffer, originalname = 'complaint-image') => {
  // If mock uploader is set (for testing), execute mock with buffer validation
  if (mockUploader) {
    const { isValid, format } = validateImageBuffer(buffer);
    if (!isValid) {
      const error = new Error('Corrupted or invalid image data. Only JPEG, PNG, and WebP are supported.');
      error.statusCode = 400;
      throw error;
    }
    return mockUploader(buffer, originalname, format);
  }

  if (!isCloudinaryConfigured()) {
    const error = new Error(
      'Cloud media storage is not configured. Please set CLOUDINARY credentials in backend/.env'
    );
    error.statusCode = 503;
    throw error;
  }

  // Magic bytes buffer verification
  const { isValid, format } = validateImageBuffer(buffer);
  if (!isValid) {
    const error = new Error('Corrupted or invalid image data. Only JPEG, PNG, and WebP are supported.');
    error.statusCode = 400;
    throw error;
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'civicfix/complaints',
        resource_type: 'image',
        format: format || undefined
      },
      (error, result) => {
        if (error) {
          const err = new Error(error.message || 'Failed to upload image to Cloudinary');
          err.statusCode = error.http_code || 502;
          return reject(err);
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          format: result.format,
          bytes: result.bytes
        });
      }
    );

    uploadStream.end(buffer);
  });
};

/**
 * Uploads multiple image buffers to Cloudinary with rollback on error
 * @param {Array<{buffer: Buffer, originalname?: string}>} files
 * @returns {Promise<Array<{secure_url: string, public_id: string, format: string, bytes: number}>>}
 */
export const uploadMultipleImagesToCloudinary = async (files = []) => {
  if (!Array.isArray(files) || files.length === 0) return [];

  const uploadedResults = [];
  try {
    for (const file of files) {
      if (!file || !file.buffer) continue;
      const res = await uploadImageToCloudinary(file.buffer, file.originalname || 'evidence-image');
      uploadedResults.push(res);
    }
    return uploadedResults;
  } catch (error) {
    // Rollback any successfully uploaded images to prevent orphaned storage
    for (const item of uploadedResults) {
      if (item.public_id) {
        await deleteImageFromCloudinary(item.public_id);
      }
    }
    throw error;
  }
};

/**
 * Deletes an uploaded image from Cloudinary (used for rollback if database save fails)
 * @param {string} publicId
 * @returns {Promise<object|null>}
 */
export const deleteImageFromCloudinary = async (publicId) => {
  if (!publicId || !isCloudinaryConfigured()) {
    return null;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (err) {
    console.error('Failed to cleanup Cloudinary asset during rollback:', publicId, err.message);
    return null;
  }
};

export default {
  upload,
  uploadMulti,
  validateImageBuffer,
  uploadImageToCloudinary,
  uploadMultipleImagesToCloudinary,
  deleteImageFromCloudinary,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS
};
