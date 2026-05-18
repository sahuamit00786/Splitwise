// /server/src/routes/auth.js
import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getPool } from '../config/db.js';
import { env } from '../config/env.js';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken,
  generateRandomToken 
} from '../utils/token.js';
import { success, error } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { EmailService } from '../services/emailService.js';

const router = express.Router();

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const forgotPasswordSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8).max(100)
});

const verifyEmailSchema = z.object({
  token: z.string()
});

/**
 * POST /api/auth/register
 * Register a new user and send verification email
 */
router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const { name, email, password } = req.body;
  const pool = getPool();

  try {
    // Check if user already exists
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    
    if (existing.length > 0) {
      return error(res, 'Email already registered', 409);
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = generateRandomToken(32);
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await pool.execute(`
      INSERT INTO users (id, name, email, password_hash, verification_token, verification_token_expires)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, name, email, passwordHash, verificationToken, verificationTokenExpires]);

    // Send verification email
    await EmailService.sendVerification(email, name, verificationToken);

    success(res, { userId, email }, 'Registration successful. Please check your email to verify your account.', 201);
  } catch (err) {
    console.error('Register error:', err);
    error(res, 'Registration failed', 500);
  }
});

/**
 * GET /api/auth/verify-email
 * Verify user's email address
 */
router.get('/verify-email', validate(verifyEmailSchema, 'query'), async (req, res) => {
  const { token } = req.query;
  const pool = getPool();

  try {
    const [users] = await pool.execute(`
      UPDATE users 
      SET is_verified = TRUE, verification_token = NULL, verification_token_expires = NULL
      WHERE verification_token = ? AND verification_token_expires > NOW()
    `, [token]);

    if (users.affectedRows === 0) {
      return error(res, 'Invalid or expired verification token', 400);
    }

    success(res, null, 'Email verified successfully. You can now log in.');
  } catch (err) {
    console.error('Verify email error:', err);
    error(res, 'Email verification failed', 500);
  }
});

/**
 * POST /api/auth/login
 * Login user and set JWT cookies
 */
router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const pool = getPool();

  try {
    const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return error(res, 'Invalid credentials', 401);
    }

    const user = users[0];

    if (!user.is_verified) {
      return error(res, 'Please verify your email before logging in', 403);
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return error(res, 'Invalid credentials', 401);
    }

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Set httpOnly cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    success(res, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url
      }
    }, 'Login successful');
  } catch (err) {
    console.error('Login error:', err);
    error(res, 'Login failed', 500);
  }
});

/**
 * POST /api/auth/logout
 * Clear authentication cookies
 */
router.post('/logout', (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  success(res, null, 'Logged out successfully');
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.cookies || {};

  if (!refreshToken) {
    return error(res, 'Refresh token required', 401);
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      return error(res, 'Invalid or expired refresh token', 401);
    }

    const newAccessToken = generateAccessToken(decoded.userId);

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000
    });

    success(res, null, 'Token refreshed successfully');
  } catch (err) {
    console.error('Refresh token error:', err);
    error(res, 'Token refresh failed', 500);
  }
});

/**
 * POST /api/auth/forgot-password
 * Send password reset email
 */
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), async (req, res) => {
  const { email } = req.body;
  const pool = getPool();

  try {
    const [users] = await pool.execute('SELECT id, name, email FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      // Don't reveal if email exists for security
      return success(res, null, 'If an account exists, a password reset link has been sent.');
    }

    const user = users[0];
    const resetToken = generateRandomToken(32);
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.execute(`
      UPDATE users 
      SET reset_token = ?, reset_token_expires = ?
      WHERE id = ?
    `, [resetToken, resetTokenExpires, user.id]);

    await EmailService.sendPasswordReset(user.email, user.name, resetToken);

    success(res, null, 'If an account exists, a password reset link has been sent.');
  } catch (err) {
    console.error('Forgot password error:', err);
    error(res, 'Failed to process request', 500);
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
  const { token, password } = req.body;
  const pool = getPool();

  try {
    const [users] = await pool.execute(`
      SELECT id FROM users 
      WHERE reset_token = ? AND reset_token_expires > NOW()
    `, [token]);

    if (users.length === 0) {
      return error(res, 'Invalid or expired reset token', 400);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.execute(`
      UPDATE users 
      SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL
      WHERE reset_token = ?
    `, [passwordHash, token]);

    success(res, null, 'Password reset successfully');
  } catch (err) {
    console.error('Reset password error:', err);
    error(res, 'Password reset failed', 500);
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    success(res, {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      avatarUrl: req.user.avatar_url
    });
  } catch (err) {
    console.error('Get profile error:', err);
    error(res, 'Failed to get profile', 500);
  }
});

export default router;
