// /server/src/routes/dashboard.js
import express from 'express';
import { getPool } from '../config/db.js';
import { success, error } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import { BalanceService } from '../services/balanceService.js';

const router = express.Router();

/**
 * GET /api/dashboard
 * Get user's dashboard with total owed/owing and recent activity
 */
router.get('/', authenticate, async (req, res) => {
  const pool = getPool();

  try {
    // Get overall balance summary
    const dashboard = await BalanceService.getUserDashboard(req.user.id);

    // Get recent activity across all groups
    const [activities] = await pool.execute(`
      SELECT 
        al.*, 
        u.name as user_name, u.avatar_url,
        g.id as group_id, g.name as group_name, g.cover_emoji
      FROM activity_log al
      JOIN users u ON al.user_id = u.id
      LEFT JOIN groups g ON al.group_id = g.id
      WHERE EXISTS (
        SELECT 1 FROM group_members gm 
        WHERE gm.group_id = COALESCE(al.group_id, g.id) 
          AND gm.user_id = ? 
          AND gm.is_active = TRUE
      )
      ORDER BY al.created_at DESC
      LIMIT 20
    `, [req.user.id]);

    // Get groups summary
    const [groups] = await pool.execute(`
      SELECT 
        g.id, g.name, g.cover_emoji,
        COUNT(DISTINCT gm.user_id) as member_count
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id AND gm.is_active = TRUE
      WHERE gm.user_id = ? AND g.deleted_at IS NULL
      GROUP BY g.id
      ORDER BY g.updated_at DESC
      LIMIT 10
    `, [req.user.id]);

    success(res, {
      balances: dashboard,
      recentActivity: activities.map(a => ({
        ...a,
        groupId: a.group_id,
        groupName: a.group_name,
        coverEmoji: a.cover_emoji,
        userName: a.user_name,
        avatarUrl: a.avatar_url
      })),
      groupsSummary: groups.map(g => ({
        ...g,
        coverEmoji: g.cover_emoji
      }))
    });
  } catch (err) {
    console.error('Get dashboard error:', err);
    error(res, 'Failed to fetch dashboard', 500);
  }
});

export default router;
