// /server/src/routes/groups.js
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getPool } from '../config/db.js';
import { success, error } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { BalanceService } from '../services/balanceService.js';
import { EmailService } from '../services/emailService.js';
import { generateRandomToken } from '../utils/token.js';

const router = express.Router();

const createGroupSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['trip', 'home', 'couple', 'other']).default('other'),
  coverEmoji: z.string().max(10).default('💰')
});

const inviteMemberSchema = z.object({
  email: z.string().email()
});

/**
 * GET /api/groups
 * List all groups for current user with balances
 */
router.get('/', authenticate, async (req, res) => {
  const pool = getPool();

  try {
    const [groups] = await pool.execute(`
      SELECT 
        g.id, g.name, g.description, g.type, g.cover_emoji, g.created_at,
        COUNT(DISTINCT gm.user_id) as member_count,
        u.name as created_by_name
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id AND gm.is_active = TRUE
      JOIN users u ON g.created_by = u.id
      WHERE gm.user_id = ? AND g.deleted_at IS NULL
      GROUP BY g.id
      ORDER BY g.updated_at DESC
    `, [req.user.id]);

    // Get balance summary for each group
    const groupsWithBalance = await Promise.all(groups.map(async (group) => {
      const balances = await BalanceService.calculateGroupBalances(group.id);
      const userBalance = balances.find(b => b.userId === req.user.id);
      
      return {
        ...group,
        coverEmoji: group.cover_emoji,
        createdBy: group.created_by_name,
        myBalance: userBalance ? userBalance.netBalance : 0
      };
    }));

    success(res, groupsWithBalance);
  } catch (err) {
    console.error('Get groups error:', err);
    error(res, 'Failed to fetch groups', 500);
  }
});

/**
 * POST /api/groups
 * Create a new group
 */
router.post('/', authenticate, validate(createGroupSchema), async (req, res) => {
  const { name, description, type, coverEmoji } = req.body;
  const pool = getPool();
  const groupId = uuidv4();

  try {
    await pool.execute(`
      INSERT INTO groups (id, name, description, type, cover_emoji, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [groupId, name, description || null, type, coverEmoji, req.user.id]);

    // Add creator as admin member
    await pool.execute(`
      INSERT INTO group_members (id, group_id, user_id, role)
      VALUES (?, ?, ?, 'admin')
    `, [uuidv4(), groupId, req.user.id]);

    // Log activity
    await pool.execute(`
      INSERT INTO activity_log (id, group_id, user_id, action, metadata)
      VALUES (?, ?, ?, 'group_created', JSON_OBJECT('name', ?))
    `, [uuidv4(), groupId, req.user.id, name]);

    success(res, { id: groupId }, 'Group created successfully', 201);
  } catch (err) {
    console.error('Create group error:', err);
    error(res, 'Failed to create group', 500);
  }
});

/**
 * GET /api/groups/:id
 * Get group details with members and totals
 */
router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const pool = getPool();

  try {
    // Check membership
    const [membership] = await pool.execute(`
      SELECT role FROM group_members
      WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `, [id, req.user.id]);

    if (membership.length === 0) {
      return error(res, 'Access denied. You are not a member of this group.', 403);
    }

    // Get group details
    const [groups] = await pool.execute(`
      SELECT 
        g.*, u.name as created_by_name
      FROM groups g
      JOIN users u ON g.created_by = u.id
      WHERE g.id = ? AND g.deleted_at IS NULL
    `, [id]);

    if (groups.length === 0) {
      return error(res, 'Group not found', 404);
    }

    // Get members
    const [members] = await pool.execute(`
      SELECT u.id, u.name, u.email, u.avatar_url, gm.role, gm.joined_at
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ? AND gm.is_active = TRUE
    `, [id]);

    // Get total spend
    const [totals] = await pool.execute(`
      SELECT 
        COUNT(*) as expense_count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM expenses
      WHERE group_id = ? AND deleted_at IS NULL
    `, [id]);

    // Get balances
    const balances = await BalanceService.calculateGroupBalances(id);

    success(res, {
      ...groups[0],
      coverEmoji: groups[0].cover_emoji,
      createdBy: groups[0].created_by_name,
      members,
      totalSpend: parseFloat(totals[0].total_amount),
      expenseCount: parseInt(totals[0].expense_count),
      balances
    });
  } catch (err) {
    console.error('Get group error:', err);
    error(res, 'Failed to fetch group', 500);
  }
});

/**
 * PUT /api/groups/:id
 * Update group (admin only)
 */
router.put('/:id', authenticate, validate(createGroupSchema.partial()), async (req, res) => {
  const { id } = req.params;
  const { name, description, type, coverEmoji } = req.body;
  const pool = getPool();

  try {
    // Check admin role
    const [membership] = await pool.execute(`
      SELECT role FROM group_members
      WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `, [id, req.user.id]);

    if (membership.length === 0 || membership[0].role !== 'admin') {
      return error(res, 'Admin access required', 403);
    }

    const updates = [];
    const values = [];

    if (name) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (type) {
      updates.push('type = ?');
      values.push(type);
    }
    if (coverEmoji) {
      updates.push('cover_emoji = ?');
      values.push(coverEmoji);
    }

    if (updates.length === 0) {
      return error(res, 'No fields to update', 400);
    }

    values.push(id);

    await pool.execute(`
      UPDATE groups SET ${updates.join(', ')} WHERE id = ?
    `, values);

    success(res, null, 'Group updated successfully');
  } catch (err) {
    console.error('Update group error:', err);
    error(res, 'Failed to update group', 500);
  }
});

/**
 * DELETE /api/groups/:id
 * Soft delete group (admin only)
 */
router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const pool = getPool();

  try {
    const [membership] = await pool.execute(`
      SELECT role FROM group_members
      WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `, [id, req.user.id]);

    if (membership.length === 0 || membership[0].role !== 'admin') {
      return error(res, 'Admin access required', 403);
    }

    await pool.execute('UPDATE groups SET deleted_at = NOW() WHERE id = ?', [id]);

    success(res, null, 'Group deleted successfully');
  } catch (err) {
    console.error('Delete group error:', err);
    error(res, 'Failed to delete group', 500);
  }
});

/**
 * POST /api/groups/:id/invite
 * Invite member by email
 */
router.post('/:id/invite', authenticate, validate(inviteMemberSchema), async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  const pool = getPool();

  try {
    // Check membership
    const [membership] = await pool.execute(`
      SELECT 1 FROM group_members
      WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `, [id, req.user.id]);

    if (membership.length === 0) {
      return error(res, 'Access denied', 403);
    }

    // Get group info
    const [groups] = await pool.execute('SELECT name FROM groups WHERE id = ?', [id]);
    if (groups.length === 0) {
      return error(res, 'Group not found', 404);
    }

    // Check if already member
    const [existingMembers] = await pool.execute(`
      SELECT u.id FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ? AND u.email = ? AND gm.is_active = TRUE
    `, [id, email]);

    if (existingMembers.length > 0) {
      return error(res, 'User is already a member', 409);
    }

    const token = generateRandomToken(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await pool.execute(`
      INSERT INTO invitations (id, group_id, invited_by, email, token, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [uuidv4(), id, req.user.id, email, token, expiresAt]);

    // Send invitation email
    const [inviter] = await pool.execute('SELECT name FROM users WHERE id = ?', [req.user.id]);
    await EmailService.sendGroupInvitation(email, inviter[0].name, groups[0].name, token);

    success(res, { token }, 'Invitation sent successfully', 201);
  } catch (err) {
    console.error('Invite member error:', err);
    error(res, 'Failed to send invitation', 500);
  }
});

/**
 * POST /api/groups/:id/join
 * Accept invitation and join group
 */
router.post('/:id/join', authenticate, async (req, res) => {
  const { id } = req.params;
  const { token } = req.body;
  const pool = getPool();

  try {
    const [invitations] = await pool.execute(`
      SELECT id, email, status FROM invitations
      WHERE group_id = ? AND token = ? AND expires_at > NOW()
    `, [id, token]);

    if (invitations.length === 0) {
      return error(res, 'Invalid or expired invitation', 400);
    }

    const invitation = invitations[0];

    if (invitation.status !== 'pending') {
      return error(res, 'Invitation already used', 400);
    }

    if (invitation.email !== req.user.email) {
      return error(res, 'This invitation was sent to a different email', 403);
    }

    // Add user to group
    await pool.execute(`
      INSERT INTO group_members (id, group_id, user_id, role)
      VALUES (?, ?, ?, 'member')
    `, [uuidv4(), id, req.user.id]);

    // Mark invitation as accepted
    await pool.execute('UPDATE invitations SET status = ? WHERE id = ?', ['accepted', invitation.id]);

    success(res, null, 'Joined group successfully');
  } catch (err) {
    console.error('Join group error:', err);
    error(res, 'Failed to join group', 500);
  }
});

/**
 * DELETE /api/groups/:id/members/:userId
 * Remove member from group (admin only)
 */
router.delete('/:id/members/:userId', authenticate, async (req, res) => {
  const { id, userId } = req.params;
  const pool = getPool();

  try {
    const [membership] = await pool.execute(`
      SELECT role FROM group_members
      WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `, [id, req.user.id]);

    if (membership.length === 0 || membership[0].role !== 'admin') {
      return error(res, 'Admin access required', 403);
    }

    // Can't remove yourself
    if (userId === req.user.id) {
      return error(res, 'Cannot remove yourself. Leave the group instead.', 400);
    }

    await pool.execute(`
      UPDATE group_members SET is_active = FALSE
      WHERE group_id = ? AND user_id = ?
    `, [id, userId]);

    success(res, null, 'Member removed successfully');
  } catch (err) {
    console.error('Remove member error:', err);
    error(res, 'Failed to remove member', 500);
  }
});

/**
 * GET /api/groups/:id/balances
 * Get per-member balance summary
 */
router.get('/:id/balances', authenticate, async (req, res) => {
  const { id } = req.params;
  const pool = getPool();

  try {
    const [membership] = await pool.execute(`
      SELECT 1 FROM group_members
      WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `, [id, req.user.id]);

    if (membership.length === 0) {
      return error(res, 'Access denied', 403);
    }

    const balances = await BalanceService.calculateGroupBalances(id);
    const suggestions = BalanceService.suggestSettlements(balances);

    success(res, { balances, suggestions });
  } catch (err) {
    console.error('Get balances error:', err);
    error(res, 'Failed to fetch balances', 500);
  }
});

/**
 * GET /api/groups/:id/activity
 * Get recent activity feed
 */
router.get('/:id/activity', authenticate, async (req, res) => {
  const { id } = req.params;
  const { limit = 50 } = req.query;
  const pool = getPool();

  try {
    const [membership] = await pool.execute(`
      SELECT 1 FROM group_members
      WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `, [id, req.user.id]);

    if (membership.length === 0) {
      return error(res, 'Access denied', 403);
    }

    const [activities] = await pool.execute(`
      SELECT al.*, u.name as user_name, u.avatar_url
      FROM activity_log al
      JOIN users u ON al.user_id = u.id
      WHERE al.group_id = ?
      ORDER BY al.created_at DESC
      LIMIT ?
    `, [id, parseInt(limit)]);

    success(res, activities);
  } catch (err) {
    console.error('Get activity error:', err);
    error(res, 'Failed to fetch activity', 500);
  }
});

export default router;
