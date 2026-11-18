import { registerUser, loginUser, getMeUser } from '../services/authService.js';

/**
 * Controller to handle citizen registration
 * POST /api/auth/register
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const result = await registerUser({ name, email, password });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to handle user login
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser({ email, password });

    return res.status(200).json({
      success: true,
      message: 'User logged in successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to fetch currently authenticated user profile
 * GET /api/auth/me
 */
export const getMe = async (req, res, next) => {
  try {
    const result = await getMeUser(req.user);

    return res.status(200).json({
      success: true,
      message: 'Authenticated user profile retrieved',
      data: result.user
    });
  } catch (error) {
    next(error);
  }
};

export default {
  register,
  login,
  getMe
};
