import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { loginRateLimiter, registerRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public Authentication Endpoints with Rate Limiting Guards
router.post('/register', registerRateLimiter, register);
router.post('/login', loginRateLimiter, login);

// Protected Authentication Profile Endpoint
router.get('/me', protect, getMe);

export default router;
