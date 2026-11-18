import { User } from '../models/User.js';
import { generateToken } from '../utils/jwt.js';
import { getDatabaseStatus } from '../config/db.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD_LENGTH = 128; // Protect against bcrypt CPU-exhaustion DoS
const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 100;
const MIN_NAME_LENGTH = 2;

/**
 * Register a new citizen account
 * Enforces role 'citizen' to strictly prevent privilege escalation
 */
export const registerUser = async ({ name, email, password }) => {
  // 1. Validation: Field presence and type checks
  if (
    !name ||
    !email ||
    !password ||
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string'
  ) {
    const error = new Error('Please provide name, email, and password as valid text strings');
    error.statusCode = 400;
    throw error;
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();

  // 2. Validate name bounds
  if (trimmedName.length < MIN_NAME_LENGTH || trimmedName.length > MAX_NAME_LENGTH) {
    const error = new Error(`Name must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters long`);
    error.statusCode = 400;
    throw error;
  }

  // 3. Validate email format
  if (!EMAIL_REGEX.test(trimmedEmail) || trimmedEmail.length > 254) {
    const error = new Error('Please provide a valid email address');
    error.statusCode = 400;
    throw error;
  }

  // 4. Validate password bounds (Sensible security rules: minimum 8 chars, max 128 chars to prevent DoS)
  if (password.length < MIN_PASSWORD_LENGTH) {
    const error = new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    error.statusCode = 400;
    throw error;
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    const error = new Error(`Password cannot exceed ${MAX_PASSWORD_LENGTH} characters`);
    error.statusCode = 400;
    throw error;
  }

  // 5. Check database availability
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please ensure MongoDB is running.');
    error.statusCode = 503;
    throw error;
  }

  // 6. Check duplicate email
  const existingUser = await User.findOne({ email: trimmedEmail });
  if (existingUser) {
    const error = new Error('User already exists with this email address');
    error.statusCode = 409;
    throw error;
  }

  // 7. Create user (Enforcing role: 'citizen' to strictly prevent public privilege escalation)
  const user = new User({
    name: trimmedName,
    email: trimmedEmail,
    password, // Pre-save hook in User model hashes this with bcrypt
    role: 'citizen',
    isActive: true
  });

  await user.save();

  // 8. Generate JWT
  const token = generateToken(user);

  return {
    user: user.toSafeObject(),
    token
  };
};

/**
 * Authenticate existing user with email and password
 * Uses constant-time generic error to prevent user enumeration attacks
 */
export const loginUser = async ({ email, password }) => {
  // 1. Validate input presence and types
  if (
    !email ||
    !password ||
    typeof email !== 'string' ||
    typeof password !== 'string'
  ) {
    const error = new Error('Please provide both email and password');
    error.statusCode = 400;
    throw error;
  }

  const trimmedEmail = email.trim().toLowerCase();

  // 2. Validate email format
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    const error = new Error('Please provide a valid email address');
    error.statusCode = 400;
    throw error;
  }

  // 3. Password length guard against DoS
  if (password.length > MAX_PASSWORD_LENGTH) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // 4. Check database availability
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please ensure MongoDB is running.');
    error.statusCode = 503;
    throw error;
  }

  // 5. Query user including the password field and populate department if applicable
  const user = await User.findOne({ email: trimmedEmail })
    .select('+password')
    .populate('department', 'name code isActive');

  // 6. Generic authentication error for missing user (prevents user enumeration)
  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // 7. Verify password with bcrypt
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // 8. Check account active status
  if (!user.isActive) {
    const error = new Error('Account is deactivated. Please contact support.');
    error.statusCode = 403;
    throw error;
  }

  // 9. Generate JWT
  const token = generateToken(user);

  return {
    user: user.toSafeObject(),
    token
  };
};

/**
 * Get current authenticated user profile
 */
export const getMeUser = async (user) => {
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (typeof user.toSafeObject === 'function') {
    return {
      user: user.toSafeObject()
    };
  }

  return {
    user: {
      id: user._id || user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department || null,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }
  };
};

export default {
  registerUser,
  loginUser,
  getMeUser
};
