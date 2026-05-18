// /server/src/routes/users.js
import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getPool } from '../config/db.js';
import { success, error } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatarUrl: z.string().url().nullable().optional()
});

const updatePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(100)
});

/**
 * GET /api/users/search
 * Search users by name or email
 */
router.get('/search', authenticate, async (req, res) => {
  const { q } = req.query;
  const pool = getPool();

  if (!q || q.length < 2) {
    return error(res, 'Search query must be at least 2 characters', 400);
  }

  try {
    const [users] = await pool.execute(`
      SELECT id, name, email, avatar_url
      FROM users
      WHERE (name LIKE ? OR email LIKE ?)
        AND id != ?
      LIMIT 20
    `, [`%${q}%`, `%${q}%`, req.user.id]);

    success(res, users);
  } catch (err) {
    console.error('Search users error:', err);
    error(res, 'Search failed', 500);
  }
});

/**
 * PUT /api/users/profile
 * Update current user's profile
 */
router.put('/profile', authenticate, validate(updateProfileSchema), async (req, res) => {
  const { name, avatarUrl } = req.body;
  const pool = getPool();

  try {
    const updates = [];
    const values = [];

    if (name) {
      updates.push('name = ?');
      values.push(name);
    }

    if (avatarUrl !== undefined) {
      updates.push('avatar_url = ?');
      values.push(avatarUrl);
    }

    if (updates.length === 0) {
      return error(res, 'No fields to update', 400);
    }

    values.push(req.user.id);

    await pool.execute(`
      UPDATE users SET ${updates.join(', ')} WHERE id = ?
    `, values);

    success(res, { name, avatarUrl }, 'Profile updated successfully');
  } catch (err) {
    console.error('Update profile error:', err);
    error(res, 'Failed to update profile', 500);
  }
});

/**
 * PUT /api/users/password
 * Change current user's password
 */
router.put('/password', authenticate, validate(updatePasswordSchema), async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const pool = getPool();

  try {
    const [users] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);

    if (users.length === 0) {
      return error(res, 'User not found', 404);
    }

    const validPassword = await bcrypt.compare(currentPassword, users[0].password_hash);

    if (!validPassword) {
      return error(res, 'Current password is incorrect', 401);
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, req.user.id]);

    success(res, null, 'Password changed successfully');
  } catch (err) {
    console.error('Change password error:', err);
    error(res, 'Failed to change password', 500);
  }
});

export default router;
