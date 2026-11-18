import { v2 as cloudinary } from 'cloudinary';
import { config } from './env.js';

/**
 * Configure Cloudinary SDK instance safely without leaking credentials.
 */
if (config.cloudinary.isConfigured) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true
  });
}

/**
 * Returns whether Cloudinary is properly configured with all required credentials
 * @returns {boolean}
 */
export const isCloudinaryConfigured = () => {
  return config.cloudinary.isConfigured;
};

/**
 * Returns safe diagnostic metadata about Cloudinary status without exposing secrets
 * @returns {object}
 */
export const getCloudinaryStatus = () => {
  return {
    configured: config.cloudinary.isConfigured,
    cloudName: config.cloudinary.cloudName || null,
    apiKeyMasked: config.cloudinary.apiKey
      ? `${config.cloudinary.apiKey.slice(0, 4)}****`
      : null
  };
};

export { cloudinary };
export default cloudinary;
