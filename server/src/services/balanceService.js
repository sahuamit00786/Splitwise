// /server/src/services/balanceService.js
import { getPool } from '../config/db.js';

/**
 * Service for calculating balances and suggesting settlements
 */
export class BalanceService {
  /**
   * Calculate net balance for each member in a group
   * @param {string} groupId - Group ID
   * @returns {Promise<Array>} Array of {userId, name, netBalance} objects
   */
  static async calculateGroupBalances(groupId) {
    const pool = getPool();
    
    // Get all active members
    const [members] = await pool.execute(`
      SELECT gm.user_id, u.name, u.avatar_url
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ? AND gm.is_active = TRUE
    `, [groupId]);

    if (members.length === 0) {
      return [];
    }

    const balances = {};
    
    // Initialize balances for all members
    members.forEach(m => {
      balances[m.user_id] = {
        userId: m.user_id,
        name: m.name,
        avatarUrl: m.avatar_url,
        paidTotal: 0,
        owedTotal: 0,
        settledReceived: 0,
        settledPaid: 0
      };
    });

    // Get all expenses and their splits for this group
    const [expenses] = await pool.execute(`
      SELECT e.id, e.paid_by, es.user_id, es.owed_amount, es.paid_amount
      FROM expenses e
      JOIN expense_splits es ON e.id = es.expense_id
      WHERE e.group_id = ? AND e.deleted_at IS NULL
    `, [groupId]);

    // Calculate paid and owed amounts
    expenses.forEach(exp => {
      // Amount the payer paid for others
      if (balances[exp.paid_by]) {
        balances[exp.paid_by].paidTotal += parseFloat(exp.owed_amount);
      }
      
      // Amount each person owes
      if (balances[exp.user_id]) {
        balances[exp.user_id].owedTotal += parseFloat(exp.owed_amount);
      }
    });

    // Get all settlements
    const [settlements] = await pool.execute(`
      SELECT payer_id, payee_id, amount
      FROM settlements
      WHERE group_id = ?
    `, [groupId]);

    // Apply settlements
    settlements.forEach(s => {
      const amount = parseFloat(s.amount);
      if (balances[s.payer_id]) {
        balances[s.payer_id].settledPaid += amount;
      }
      if (balances[s.payee_id]) {
        balances[s.payee_id].settledReceived += amount;
      }
    });

    // Calculate net balance for each member
    // Positive = they are owed money, Negative = they owe money
    return Object.values(balances).map(b => ({
      userId: b.userId,
      name: b.name,
      avatarUrl: b.avatarUrl,
      netBalance: Math.round((b.paidTotal - b.owedTotal + b.settledReceived - b.settledPaid) * 100) / 100
    }));
  }

  /**
   * Suggest minimum transactions to settle all debts in a group
   * Uses greedy algorithm to minimize number of transactions
   * @param {Array} balances - Array of {userId, netBalance} objects
   * @returns {Array} Array of {fromUserId, toUserId, amount} suggestions
   */
  static suggestSettlements(balances) {
    // Separate into debtors (negative) and creditors (positive)
    const debtors = balances
      .filter(b => b.netBalance < -0.01)
      .map(b => ({ userId: b.userId, amount: Math.abs(b.netBalance) }))
      .sort((a, b) => a.amount - b.amount);
    
    const creditors = balances
      .filter(b => b.netBalance > 0.01)
      .map(b => ({ userId: b.userId, amount: b.netBalance }))
      .sort((a, b) => a.amount - b.amount);

    const suggestions = [];
    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      
      const amount = Math.min(debtor.amount, creditor.amount);
      
      if (amount > 0.01) {
        suggestions.push({
          fromUserId: debtor.userId,
          toUserId: creditor.userId,
          amount: Math.round(amount * 100) / 100
        });
      }
      
      debtor.amount -= amount;
      creditor.amount -= amount;
      
      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return suggestions;
  }

  /**
   * Get user's total balance across all groups
   * @param {string} userId - User ID
   * @returns {Promise<{totalOwed: number, totalOwing: number}>}
   */
  static async getUserDashboard(userId) {
    const pool = getPool();
    
    const [rows] = await pool.execute(`
      SELECT 
        SUM(CASE WHEN es.user_id = ? THEN es.owed_amount ELSE 0 END) as total_owed,
        SUM(CASE WHEN e.paid_by = ? THEN es.owed_amount ELSE 0 END) as total_owing
      FROM expenses e
      JOIN expense_splits es ON e.id = es.expense_id
      JOIN group_members gm ON e.group_id = gm.group_id
      WHERE gm.user_id = ? AND gm.is_active = TRUE 
        AND e.deleted_at IS NULL
        AND es.is_settled = FALSE
    `, [userId, userId, userId]);

    const totalOwed = rows[0].total_owed || 0;
    const totalOwing = rows[0].total_owing || 0;
    const netBalance = totalOwed - totalOwing;

    return {
      totalOwed: Math.round(totalOwed * 100) / 100,
      totalOwing: Math.round(totalOwing * 100) / 100,
      netBalance: Math.round(netBalance * 100) / 100
    };
  }
}
