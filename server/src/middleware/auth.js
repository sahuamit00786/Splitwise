// /server/src/middleware/auth.js
import { verifyAccessToken } from '../utils/token.js';
import { error } from '../utils/response.js';
import { getPool } from '../config/db.js';

/**
 * Authenticate user via JWT access token
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Access token required', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return error(res, 'Invalid or expired token', 401);
    }

    // Fetch user from database to ensure they still exist and are verified
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT id, name, email, avatar_url, is_verified FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (rows.length === 0) {
      return error(res, 'User not found', 404);
    }

    const user = rows[0];

    if (!user.is_verified) {
      return error(res, 'Email not verified. Please verify your email first.', 403);
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return error(res, 'Authentication failed', 500);
  }
}

/**
 * Optional authentication - attaches user if valid token present
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyAccessToken(token);

      if (decoded) {
        const pool = getPool();
        const [rows] = await pool.execute(
          'SELECT id, name, email, avatar_url, is_verified FROM users WHERE id = ?',
          [decoded.userId]
        );

        if (rows.length > 0 && rows[0].is_verified) {
          req.user = rows[0];
        }
      }
    }
    
    next();
  } catch (err) {
    next();
  }
}
