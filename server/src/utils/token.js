// /server/src/utils/token.js
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

/**
 * Generate access token
 * @param {string} userId - User ID
 * @returns {string}
 */
export function generateAccessToken(userId) {
  return jwt.sign({ userId }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessTokenExpiry
  });
}

/**
 * Generate refresh token
 * @param {string} userId - User ID
 * @returns {string}
 */
export function generateRefreshToken(userId) {
  return jwt.sign({ userId }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshTokenExpiry
  });
}

/**
 * Verify token
 * @param {string} token - JWT token
 * @param {string} secret - Secret key
 * @returns {object|null}
 */
export function verifyToken(token, secret) {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
}

/**
 * Verify access token
 * @param {string} token - Access token
 * @returns {object|null}
 */
export function verifyAccessToken(token) {
  return verifyToken(token, env.jwt.accessSecret);
}

/**
 * Verify refresh token
 * @param {string} token - Refresh token
 * @returns {object|null}
 */
export function verifyRefreshToken(token) {
  return verifyToken(token, env.jwt.refreshSecret);
}

/**
 * Generate random token for email verification/invitation
 * @param {number} bytes - Number of random bytes
 * @returns {string}
 */
export function generateRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}
