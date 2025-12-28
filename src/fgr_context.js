// DEPRECATED - remove with FGR Events TODO item
const { 
  getEconomicMetrics, 
  getFGREvents,
  db 
} = require('./db');
const { structuredLog } = require('./logger');

/**
 * Federal GarryCoin Reserve context generator
 * Gathers recent, relevant data to feed into LLM prompts
 */
class FGRContext {
  
  /**
   * Get comprehensive context data for LLM prompts
   * @returns {Promise<Object>} Formatted context data
   */
  async getMarketContext() {
    try {
      const [
        metrics,
        recentEvents,
        recentTransactions,
        topGamblers,
        bigWinners,
        bigLosers,
        activeUsers
      ] = await Promise.all([
        this.getBasicMetrics(),
        this.getRecentFGRActivity(),
        this.getRecentTransactionActivity(),
        this.getTopGamblers(),
        this.getRecentBigWins(),
        this.getRecentBigLosses(),
        this.getActiveUserActivity()
      ]);

      return {
        metrics,
        recentEvents,
        recentTransactions,
        topGamblers,
        bigWinners,
        bigLosers,
        activeUsers,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      structuredLog.error('Failed to gather market context', error);
      // Return minimal context on error
      return {
        metrics: { error: 'Unable to fetch metrics' },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Format context data into LLM-friendly text
   * @param {Object} context - Raw context data
   * @returns {string} Formatted context string
   */
  formatContextForLLM(context) {
    if (context.metrics.error) {
      return "Current market data unavailable due to system maintenance.";
    }

    const parts = [];

    // Economic overview
    parts.push(`CURRENT MARKET CONDITIONS:
- Total GarryCoin supply: ${context.metrics.totalSupply.toLocaleString()} GC
- Active market participants: ${context.metrics.activeUsers}/${context.metrics.totalUsers} (${context.metrics.activityRate.toFixed(1)}% participation)
- 24-hour transaction volume: ${context.metrics.dailyVolume} transactions
- Weekly gambling volume: ${context.metrics.gamblingVolume.toLocaleString()} GC`);

    // Recent activity
    if (context.recentTransactions && context.recentTransactions.length > 0) {
      parts.push(`RECENT MARKET ACTIVITY:
- Latest major transactions: ${context.recentTransactions.map(t => `${t.amount} GC ${t.type}`).join(', ')}
- Gaming sector performance: ${context.metrics.heistWinRate.toFixed(1)}% heist success rate, ${context.metrics.rtbGames} RTB games, ${context.metrics.wavelengthGames} Wavelength positions`);
    }

    // High-value players
    if (context.topGamblers && context.topGamblers.length > 0) {
      parts.push(`HIGH-NET-WORTH PARTICIPANTS:
- Top gambling volumes: ${context.topGamblers.map(g => `${g.totalWagered} GC wagered`).slice(0, 3).join(', ')}
- Recent significant wins: ${context.bigWinners.map(w => `${w.amount} GC win`).slice(0, 2).join(', ')}
- Notable losses: ${context.bigLosers.map(l => `${l.amount} GC loss`).slice(0, 2).join(', ')}`);
    }

    // FGR history
    if (context.recentEvents && context.recentEvents.length > 0) {
      parts.push(`RECENT FGR INTERVENTIONS:
- Last actions: ${context.recentEvents.map(e => `${e.event_type.toUpperCase()} (${e.coins_distributed} GC distributed)`).join(', ')}`);
    }

    return parts.join('\n\n');
  }

  // Private helper methods for gathering specific data

  async getBasicMetrics() {
    const metrics = await getEconomicMetrics();
    return {
      totalSupply: metrics.economicMetrics.totalSupply,
      totalUsers: metrics.userMetrics.totalUsers,
      activeUsers: metrics.userMetrics.activeUsers,
      activityRate: metrics.userMetrics.activityRate,
      dailyVolume: metrics.economicMetrics.recentTransactionVolume,
      gamblingVolume: metrics.economicMetrics.weeklyGamblingVolume,
      heistWinRate: metrics.gameMetrics.heist.winRate,
      rtbGames: metrics.gameMetrics.rtb.games,
      wavelengthGames: metrics.gameMetrics.wavelength.games
    };
  }

  async getRecentFGRActivity() {
    return await getFGREvents(3);
  }

  async getRecentTransactionActivity() {
    return await db('transactions')
      .where('created_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
      .where('amount', '>=', 10) // Only significant transactions
      .orderBy('created_at', 'desc')
      .limit(5)
      .select('amount', 'transaction_type as type', 'created_at');
  }

  async getTopGamblers() {
    return await db('transactions')
      .where('created_at', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .whereIn('transaction_type', ['heist_loss', 'rtb_wager', 'wavelength_wager'])
      .groupBy('sending_user_id')
      .select('sending_user_id as user_id')
      .sum('amount as totalWagered')
      .orderBy('totalWagered', 'desc')
      .limit(5);
  }

  async getRecentBigWins() {
    return await db('transactions')
      .where('created_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
      .whereIn('transaction_type', ['heist_win', 'rtb_win_end_of_line', 'wavelength_win'])
      .orWhere('transaction_type', 'like', 'rtb_win_cash_out_%')
      .where('amount', '>=', 20) // Only significant wins
      .orderBy('amount', 'desc')
      .limit(3)
      .select('amount', 'transaction_type', 'receiving_user_id as user_id');
  }

  async getRecentBigLosses() {
    return await db('transactions')
      .where('created_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
      .whereIn('transaction_type', ['heist_loss'])
      .where('amount', '>=', 20) // Only significant losses
      .orderBy('amount', 'desc')
      .limit(3)
      .select('amount', 'transaction_type', 'sending_user_id as user_id');
  }

  async getActiveUserActivity() {
    return await db('users')
      .where('last_active_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
      .count('* as count')
      .first();
  }

  /**
   * Generate a context-aware prompt for specific FGR actions
   * @param {string} actionType - Type of action (qe, buyback, announcement)
   * @param {Object} actionData - Specific data about the action
   * @returns {Promise<string>} Complete prompt with context
   */
  async generateContextualPrompt(actionType, actionData = {}) {
    const context = await this.getMarketContext();
    const marketContext = this.formatContextForLLM(context);

    const basePrompts = {
      qe: `You are the Federal GarryCoin Reserve Chairman announcing emergency quantitative easing. You are distributing ${actionData.amount || 'substantial'} GarryCoins to ${actionData.recipients || 'underperforming'} market participants.`,
      
      buyback: `You are the Federal GarryCoin Reserve Chairman announcing a strategic share buyback program. You are purchasing ${actionData.totalAmount || 'significant volumes of'} GarryCoins from ${actionData.participants || 'high-performing'} participants at premium rates.`,
      
      announcement: `You are the Federal GarryCoin Reserve Chairman making a policy statement about current market conditions and monetary policy stance.`
    };

    const prompt = `${basePrompts[actionType] || basePrompts.announcement}

CURRENT MARKET DATA:
${marketContext}

Write a 2-3 sentence announcement using serious Federal Reserve terminology and financial jargon, but with completely nonsensical economic reasoning. Reference specific data points from the current market conditions. Sound authoritative and professional, but make the economic logic completely absurd. Do not include disclaimers or explanations.`;

    return prompt;
  }
}

module.exports = { FGRContext };
