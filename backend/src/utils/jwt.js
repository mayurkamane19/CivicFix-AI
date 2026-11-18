import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

/**
 * Generates a signed JWT for an authenticated user with explicitly configured algorithm
 * @param {object} user - User document or payload containing id, email, role
 * @returns {string} Signed JWT token
 */
export const generateToken = (user) => {
  const payload = {
    id: user._id ? user._id.toString() : user.id,
    email: user.email,
    role: user.role
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    algorithm: config.jwtAlgorithm || 'HS256'
  });
};

/**
 * Verifies a JWT enforcing the configured algorithm (HS256) to eliminate algorithm confusion
 * @param {string} token
 * @returns {object} Decoded token payload
 */
export const verifyToken = (token) => {
  return jwt.verify(token, config.jwtSecret, {
    algorithms: [config.jwtAlgorithm || 'HS256']
  });
};

export default {
  generateToken,
  verifyToken
};
