// /server/src/config/db.js
import mysql from 'mysql2/promise';
import { env } from './env.js';

let pool = null;

/**
 * Get or create MySQL connection pool
 * @returns {mysql.Pool}
 */
export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.name,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
  }
  return pool;
}

/**
 * Test database connection
 * @returns {Promise<boolean>}
 */
export async function testConnection() {
  try {
    const connection = await getPool().getConnection();
    await connection.ping();
    connection.release();
    console.log('✓ Database connected successfully');
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Close database pool
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
