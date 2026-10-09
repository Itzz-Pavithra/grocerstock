import express from 'express';
import {
  register,
  verifyOtp,
  resendOtp,
  login,
  getMe,
  updateProfile,
  forgotPassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import {
  loginRateLimiter,
  otpVerifyRateLimiter,
  otpResendRateLimiter,
  registerRateLimiter,
} from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/register', registerRateLimiter, register);
router.post('/verify-otp', otpVerifyRateLimiter, verifyOtp);
router.post('/resend-otp', otpResendRateLimiter, resendOtp);
router.post('/login', loginRateLimiter, login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/forgot-password', otpResendRateLimiter, forgotPassword);

export default router;
