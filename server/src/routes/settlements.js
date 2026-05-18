// /server/src/routes/settlements.js
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getPool } from '../config/db.js';
import { success, error } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

const createSettlementSchema = z.object({
  payerId: z.string(),
  payeeId: z.string(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('INR'),
  note: z.string().max(500).optional()
});

/**
 * GET /api/groups/:id/settlements
 * List all settlements for a group
 */
router.get('/groups/:groupId/settlements', authenticate, async (req, res) => {
  const { groupId } = req.params;
  const pool = getPool();

  try {
    const [membership] = await pool.execute(`
      SELECT 1 FROM group_members
      WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `, [groupId, req.user.id]);

    if (membership.length === 0) {
      return error(res, 'Access denied', 403);
    }

    const [settlements] = await pool.execute(`
      SELECT 
        s.*, 
        p.name as payer_name, p.avatar_url as payer_avatar,
        py.name as payee_name, py.avatar_url as payee_avatar
      FROM settlements s
      JOIN users p ON s.payer_id = p.id
      JOIN users py ON s.payee_id = py.id
      WHERE s.group_id = ?
      ORDER BY s.settled_at DESC
    `, [groupId]);

    success(res, settlements.map(s => ({
      ...s,
      payerId: s.payer_id,
      payerName: s.payer_name,
      payerAvatar: s.payer_avatar,
      payeeId: s.payee_id,
      payeeName: s.payee_name,
      payeeAvatar: s.payee_avatar
    })));
  } catch (err) {
    console.error('Get settlements error:', err);
    error(res, 'Failed to fetch settlements', 500);
  }
});

/**
 * POST /api/groups/:id/settle
 * Record a payment between members
 */
router.post('/groups/:groupId/settle', authenticate, validate(createSettlementSchema), async (req, res) => {
  const { groupId } = req.params;
  const { payerId, payeeId, amount, currency, note } = req.body;
  const pool = getPool();

  try {
    // Check membership
    const [membership] = await pool.execute(`
      SELECT role FROM group_members
      WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `, [groupId, req.user.id]);

    if (membership.length === 0) {
      return error(res, 'Access denied', 403);
    }

    // Verify both parties are members
    const [members] = await pool.execute(`
      SELECT user_id FROM group_members
      WHERE group_id = ? AND user_id IN (?, ?) AND is_active = TRUE
    `, [groupId, payerId, payeeId]);

    if (members.length !== 2) {
      return error(res, 'Both payer and payee must be group members', 400);
    }

    const settlementId = uuidv4();

    // Start transaction
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Insert settlement
      await connection.execute(`
        INSERT INTO settlements (id, group_id, payer_id, payee_id, amount, currency, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [settlementId, groupId, payerId, payeeId, amount, currency, note || null]);

      // Log activity
      await connection.execute(`
        INSERT INTO activity_log (id, group_id, user_id, action, metadata)
        VALUES (?, ?, ?, 'settlement_recorded', JSON_OBJECT('amount', ?, 'payer_id', ?, 'payee_id', ?))
      `, [uuidv4(), groupId, req.user.id, amount, payerId, payeeId]);

      await connection.commit();
      success(res, { id: settlementId }, 'Settlement recorded successfully', 201);
    } catch (txError) {
      await connection.rollback();
      throw txError;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Create settlement error:', err);
    error(res, 'Failed to record settlement', 500);
  }
});

export default router;
