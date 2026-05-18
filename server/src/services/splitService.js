// /server/src/services/splitService.js

/**
 * Split expense among users based on split type
 */
export class SplitService {
  /**
   * Calculate splits for equal division
   * @param {number} totalAmount - Total expense amount
   * @param {Array} participants - Array of user IDs
   * @returns {Array} Array of {userId, amount} objects
   */
  static calculateEqual(totalAmount, participants) {
    const count = participants.length;
    const baseAmount = Math.floor((totalAmount / count) * 100) / 100;
    const remainder = Math.round((totalAmount - baseAmount * count) * 100);
    
    return participants.map((userId, index) => ({
      userId,
      owedAmount: index < remainder ? baseAmount + 0.01 : baseAmount
    }));
  }

  /**
   * Calculate splits for exact amounts
   * @param {number} totalAmount - Total expense amount
   * @param {Array} splits - Array of {userId, amount} objects
   * @returns {Array|null} Validated splits or null if invalid
   */
  static calculateExact(totalAmount, splits) {
    const sum = splits.reduce((acc, s) => acc + parseFloat(s.amount), 0);
    
    // Allow small floating point differences
    if (Math.abs(sum - totalAmount) > 0.01) {
      return null;
    }
    
    return splits.map(s => ({
      userId: s.userId,
      owedAmount: parseFloat(s.amount)
    }));
  }

  /**
   * Calculate splits based on percentages
   * @param {number} totalAmount - Total expense amount
   * @param {Array} splits - Array of {userId, percentage} objects
   * @returns {Array|null} Validated splits or null if invalid
   */
  static calculatePercentage(totalAmount, splits) {
    const sum = splits.reduce((acc, s) => acc + parseFloat(s.percentage), 0);
    
    if (Math.abs(sum - 100) > 0.01) {
      return null;
    }
    
    return splits.map(s => ({
      userId: s.userId,
      owedAmount: Math.round((totalAmount * parseFloat(s.percentage) / 100) * 100) / 100
    }));
  }

  /**
   * Calculate splits based on shares
   * @param {number} totalAmount - Total expense amount
   * @param {Array} splits - Array of {userId, shares} objects
   * @returns {Array} Array of {userId, amount} objects
   */
  static calculateShares(totalAmount, splits) {
    const totalShares = splits.reduce((acc, s) => acc + parseInt(s.shares), 0);
    
    if (totalShares === 0) {
      return [];
    }
    
    const baseAmount = Math.floor((totalAmount / totalShares) * 100) / 100;
    let remainder = Math.round((totalAmount - baseAmount * totalShares) * 100);
    
    return splits.map((s, index) => {
      const shareCount = parseInt(s.shares);
      let amount = baseAmount * shareCount;
      
      // Distribute remainder across first users
      while (remainder > 0 && shareCount > 0) {
        amount += 0.01;
        remainder--;
      }
      
      return {
        userId: s.userId,
        owedAmount: Math.round(amount * 100) / 100
      };
    });
  }

  /**
   * Main method to calculate splits based on type
   * @param {string} splitType - Type of split: equal, exact, percentage, shares
   * @param {number} totalAmount - Total expense amount
   * @param {Array} participants - Participant data based on split type
   * @returns {Array} Array of {userId, owedAmount} objects
   * @throws {Error} If split calculation fails
   */
  static calculate(splitType, totalAmount, participants) {
    switch (splitType) {
      case 'equal':
        return this.calculateEqual(totalAmount, participants);
      case 'exact':
        const exactResult = this.calculateExact(totalAmount, participants);
        if (!exactResult) {
          throw new Error('Sum of exact amounts must equal total');
        }
        return exactResult;
      case 'percentage':
        const percentageResult = this.calculatePercentage(totalAmount, participants);
        if (!percentageResult) {
          throw new Error('Sum of percentages must equal 100');
        }
        return percentageResult;
      case 'shares':
        return this.calculateShares(totalAmount, participants);
      default:
        throw new Error('Invalid split type');
    }
  }
}
