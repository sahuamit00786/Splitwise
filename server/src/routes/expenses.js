// /server/src/routes/expenses.js
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getPool } from '../config/db.js';
import { success, error } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { SplitService } from '../services/splitService.js';

const router = express.Router();

const createExpenseSchema = z.object({
  title: z.string().min(1).max(255),
  amount: z.number().positive(),
  currency: z.string().length(3).default('INR'),
  category: z.enum(['food','transport','accommodation','entertainment','shopping','utilities','health','other']).default('other'),
  splitType: z.enum(['equal','exact','percentage','shares']).default('equal'),
  paidBy: z.string(),
  date: z.string(),
  notes: z.string().max(1000).optional(),
  splits: z.array(z.object({
    userId: z.string(),
    amount: z.number().optional(),
    percentage: z.number().optional(),
    shares: z.number().optional()
  })).min(2)
});

const updateExpenseSchema = createExpenseSchema.partial();

/**
 * GET /api/groups/:id/expenses
 * List expenses for a group with pagination and filters
 */
router.get('/groups/:groupId/expenses', authenticate, async (req, res) => {
  const { groupId } = req.params;
  const { page = 1, limit = 20, category, search, startDate, endDate } = req.query;
  const pool = getPool();

  try {
    // Check membership
    const [membership] = await pool.execute(`
      SELECT 1 FROM group_members
      WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `, [groupId, req.user.id]);

    if (membership.length === 0) {
      return error(res, 'Access denied', 403);
    }

    let query = `
      SELECT 
        e.id, e.title, e.amount, e.currency, e.category, e.split_type,
        e.paid_by, u.name as paid_by_name, u.avatar_url as paid_by_avatar,
        e.date, e.notes, e.created_at,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('userId', es.user_id, 'owedAmount', es.owed_amount, 'isSettled', es.is_settled))
         FROM expense_splits es WHERE es.expense_id = e.id) as splits
      FROM expenses e
      JOIN users u ON e.paid_by = u.id
      WHERE e.group_id = ? AND e.deleted_at IS NULL
    `;

    const params = [groupId];

    if (category) {
      query += ' AND e.category = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND e.title LIKE ?';
      params.push(`%${search}%`);
    }

    if (startDate) {
      query += ' AND e.date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND e.date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY e.date DESC, e.created_at DESC';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [expenses] = await pool.execute(query, params);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total FROM expenses
      WHERE group_id = ? AND deleted_at IS NULL
    `;
    const [countResult] = await pool.execute(countQuery, [groupId]);

    const parsedExpenses = expenses.map(e => ({
      ...e,
      splitType: e.split_type,
      paidBy: e.paid_by,
      paidByName: e.paid_by_name,
      paidByAvatar: e.paid_by_avatar,
      splits: e.splits ? JSON.parse(e.splits) : []
    }));

    success(res, {
      expenses: parsedExpenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Get expenses error:', err);
    error(res, 'Failed to fetch expenses', 500);
  }
});

/**
 * POST /api/groups/:id/expenses
 * Add a new expense with split logic
 */
router.post('/groups/:groupId/expenses', authenticate, validate(createExpenseSchema), async (req, res) => {
  const { groupId } = req.params;
  const { title, amount, currency, category, splitType, paidBy, date, notes, splits } = req.body;
  const pool = getPool();

  try {
    // Check membership
    const [membership] = await pool.execute(`
      SELECT 1 FROM group_members
      WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `, [groupId, req.user.id]);

    if (membership.length === 0) {
      return error(res, 'Access denied', 403);
    }

    // Verify payer is a member
    const [payerCheck] = await pool.execute(`
      SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `, [groupId, paidBy]);

    if (payerCheck.length === 0) {
      return error(res, 'Payer must be a group member', 400);
    }

    const expenseId = uuidv4();

    // Calculate splits using SplitService
    const participantData = splits.map(s => ({
      userId: s.userId,
      amount: s.amount,
      percentage: s.percentage,
      shares: s.shares
    }));

    let calculatedSplits;
    try {
      calculatedSplits = SplitService.calculate(splitType, amount, participantData);
    } catch (splitError) {
      return error(res, splitError.message, 400);
    }

    // Start transaction
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Insert expense
      await connection.execute(`
        INSERT INTO expenses (id, group_id, paid_by, title, amount, currency, category, split_type, notes, date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [expenseId, groupId, paidBy, title, amount, currency, category, splitType, notes || null, date]);

      // Insert splits
      for (const split of calculatedSplits) {
        await connection.execute(`
          INSERT INTO expense_splits (id, expense_id, user_id, owed_amount)
          VALUES (?, ?, ?, ?)
        `, [uuidv4(), expenseId, split.userId, split.owedAmount]);
      }

      // Log activity
      await connection.execute(`
        INSERT INTO activity_log (id, group_id, user_id, action, metadata)
        VALUES (?, ?, ?, 'expense_added', JSON_OBJECT('title', ?, 'amount', ?))
      `, [uuidv4(), groupId, req.user.id, title, amount]);

      await connection.commit();
      success(res, { id: expenseId }, 'Expense added successfully', 201);
    } catch (txError) {
      await connection.rollback();
      throw txError;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Create expense error:', err);
    error(res, 'Failed to add expense', 500);
  }
});

/**
 * GET /api/groups/:id/expenses/:eid
 * Get expense detail
 */
router.get('/groups/:groupId/expenses/:expenseId', authenticate, async (req, res) => {
  const { groupId, expenseId } = req.params;
  const pool = getPool();

  try {
    const [membership] = await pool.execute(`
      SELECT 1 FROM group_members
      WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `, [groupId, req.user.id]);

    if (membership.length === 0) {
      return error(res, 'Access denied', 403);
    }

    const [expenses] = await pool.execute(`
      SELECT 
        e.*, u.name as paid_by_name, u.avatar_url as paid_by_avatar
      FROM expenses e
      JOIN users u ON e.paid_by = u.id
      WHERE e.id = ? AND e.group_id = ? AND e.deleted_at IS NULL
    `, [expenseId, groupId]);

    if (expenses.length === 0) {
      return error(res, 'Expense not found', 404);
    }

    const [splits] = await pool.execute(`
      SELECT user_id, owed_amount, paid_amount, is_settled
      FROM expense_splits
      WHERE expense_id = ?
    `, [expenseId]);

    success(res, {
      ...expenses[0],
      splitType: expenses[0].split_type,
      paidBy: expenses[0].paid_by,
      paidByName: expenses[0].paid_by_name,
      paidByAvatar: expenses[0].paid_by_avatar,
      splits
    });
  } catch (err) {
    console.error('Get expense error:', err);
    error(res, 'Failed to fetch expense', 500);
  }
});

/**
 * PUT /api/groups/:id/expenses/:eid
 * Edit expense
 */
router.put('/groups/:groupId/expenses/:expenseId', authenticate, validate(updateExpenseSchema), async (req, res) => {
  const { groupId, expenseId } = req.params;
  const pool = getPool();

  try {
    const [membership] = await pool.execute(`
      SELECT role FROM group_members
      WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `, [groupId, req.user.id]);

    if (membership.length === 0) {
      return error(res, 'Access denied', 403);
    }

    // Check if user created the expense or is admin
    const [expenses] = await pool.execute('SELECT paid_by FROM expenses WHERE id = ?', [expenseId]);
    
    if (expenses.length === 0) {
      return error(res, 'Expense not found', 404);
    }

    if (expenses[0].paid_by !== req.user.id && membership[0].role !== 'admin') {
      return error(res, 'Only expense creator or admin can edit', 403);
    }

    const { title, amount, category, notes } = req.body;
    const updates = [];
    const values = [];

    if (title) {
      updates.push('title = ?');
      values.push(title);
    }
    if (amount) {
      updates.push('amount = ?');
      values.push(amount);
    }
    if (category) {
      updates.push('category = ?');
      values.push(category);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (updates.length === 0) {
      return error(res, 'No fields to update', 400);
    }

    values.push(expenseId);

    await pool.execute(`
      UPDATE expenses SET ${updates.join(', ')} WHERE id = ?
    `, values);

    success(res, null, 'Expense updated successfully');
  } catch (err) {
    console.error('Update expense error:', err);
    error(res, 'Failed to update expense', 500);
  }
});

/**
 * DELETE /api/groups/:id/expenses/:eid
 * Soft delete expense
 */
router.delete('/groups/:groupId/expenses/:expenseId', authenticate, async (req, res) => {
  const { groupId, expenseId } = req.params;
  const pool = getPool();

  try {
    const [membership] = await pool.execute(`
      SELECT role FROM group_members
      WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `, [groupId, req.user.id]);

    if (membership.length === 0) {
      return error(res, 'Access denied', 403);
    }

    const [expenses] = await pool.execute('SELECT paid_by FROM expenses WHERE id = ?', [expenseId]);
    
    if (expenses.length === 0) {
      return error(res, 'Expense not found', 404);
    }

    if (expenses[0].paid_by !== req.user.id && membership[0].role !== 'admin') {
      return error(res, 'Only expense creator or admin can delete', 403);
    }

    await pool.execute('UPDATE expenses SET deleted_at = NOW() WHERE id = ?', [expenseId]);

    success(res, null, 'Expense deleted successfully');
  } catch (err) {
    console.error('Delete expense error:', err);
    error(res, 'Failed to delete expense', 500);
  }
});

export default router;
