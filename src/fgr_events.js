const { 
  getEconomicMetrics, 
  getGamblingLeaderboard, 
  grant, 
  transfer, 
  recordFGREvent,
  getUser,
  db
} = require('./db');
const { llmService } = require('./llm_service');
const { FGRContext } = require('./fgr_context');
const { structuredLog } = require('./logger');

/**
 * Federal GarryCoin Reserve automatic events system
 * Handles QE, buybacks, and policy announcements
 */
class FGREvents {
  constructor(discordClient) {
    this.client = discordClient;
    this.context = new FGRContext();
    this.lastQECheck = Date.now();
    this.lastBuybackCheck = Date.now();
    this.lastAnnouncementCheck = Date.now();
    
    // Timing configuration (in milliseconds)
    this.QE_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // Check every 6 hours
    this.BUYBACK_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // Check daily
    this.ANNOUNCEMENT_INTERVAL = 12 * 60 * 60 * 1000; // Check every 12 hours
    
    // Probability thresholds
    this.QE_PROBABILITY = 0.15; // 15% chance when conditions met
    this.BUYBACK_PROBABILITY = 0.1; // 10% chance per day
    this.ANNOUNCEMENT_PROBABILITY = 0.2; // 20% chance per check
  }

  /**
   * Start the FGR event monitoring system
   */
  start() {
    structuredLog.info('FGR Events system starting');
    
    // Check for events every 30 minutes
    setInterval(() => {
      this.checkForEvents().catch(error => {
        structuredLog.error('FGR Events check failed', error);
      });
    }, 30 * 60 * 1000);

    structuredLog.info('FGR Events system started');
  }

  /**
   * Main event checking loop
   */
  async checkForEvents() {
    const now = Date.now();

    try {
      // Check for Quantitative Easing
      if (now - this.lastQECheck >= this.QE_CHECK_INTERVAL) {
        this.lastQECheck = now;
        await this.checkQuantitativeEasing();
      }

      // Check for Buybacks
      if (now - this.lastBuybackCheck >= this.BUYBACK_CHECK_INTERVAL) {
        this.lastBuybackCheck = now;
        await this.checkBuyback();
      }

      // Check for Policy Announcements
      if (now - this.lastAnnouncementCheck >= this.ANNOUNCEMENT_INTERVAL) {
        this.lastAnnouncementCheck = now;
        await this.checkPolicyAnnouncement();
      }

    } catch (error) {
      structuredLog.error('Error in FGR event checking', error);
    }
  }

  /**
   * Check if Quantitative Easing should be triggered
   * Triggers when gambling volume is low + random chance
   */
  async checkQuantitativeEasing() {
    const metrics = await getEconomicMetrics();
    
    // Trigger conditions: low gambling volume or low activity rate
    const lowGamblingVolume = metrics.economicMetrics.weeklyGamblingVolume < 100;
    const lowActivityRate = metrics.userMetrics.activityRate < 30;
    
    const shouldTrigger = (lowGamblingVolume || lowActivityRate) && Math.random() < this.QE_PROBABILITY;
    
    if (shouldTrigger) {
      await this.executeQuantitativeEasing(metrics);
    }
  }

  /**
   * Execute Quantitative Easing event
   */
  async executeQuantitativeEasing(metrics) {
    try {
      // Target "undervalued" players (negative net profit)
      const undervaluedPlayers = await getGamblingLeaderboard('profit');
      const targets = undervaluedPlayers
        .filter(player => player.net_profit < 0)
        .slice(0, 5); // Top 5 losers

      if (targets.length === 0) {
        structuredLog.info('No undervalued players found for QE');
        return;
      }

      // Calculate QE amount (between 10-50 GC per player)
      const baseAmount = 25;
      const variance = Math.floor(Math.random() * 25) - 12; // ±12
      const qeAmount = Math.max(10, baseAmount + variance);

      let announcement;
      try {
        const contextualPrompt = await this.context.generateContextualPrompt('qe', {
          amount: qeAmount,
          recipients: targets.length
        });
        announcement = await llmService.generateText(contextualPrompt);
        structuredLog.info('QE announcement generated via LLM', { 
          recipientCount: targets.length, 
          amount: qeAmount 
        });
      } catch (error) {
        structuredLog.error('Failed to generate QE announcement via LLM', error, {
          action: 'quantitative_easing',
          recipientCount: targets.length,
          amount: qeAmount,
          fallbackUsed: true
        });
        announcement = "The GarryCoin Federal Reserve has no comments at this time.";
      }

      // Execute the grants
      let totalDistributed = 0;
      const recipients = [];

      await db.transaction(async trx => {
        for (const target of targets) {
          await grant(target.user_id, qeAmount, 'fgr_quantitative_easing', trx);
          totalDistributed += qeAmount;
          recipients.push(target.user_id);
        }
      });

      // Record the event
      await recordFGREvent('qe', announcement, {
        recipients,
        amountPerRecipient: qeAmount,
        triggerMetrics: metrics
      }, totalDistributed, targets.length);

      // Post announcement to all channels where bot is active
      await this.broadcastAnnouncement(`**🏛️ FEDERAL GARRYCOIN RESERVE - EMERGENCY MONETARY ACTION**

${announcement}

**QE Details:**
• Recipients: ${targets.length} market participants
• Amount: ${qeAmount} GC per recipient  
• Total Liquidity Injection: ${totalDistributed} GC
• Authorization: Emergency Powers Act §4.20.69

*This action is effective immediately. Market participants should expect continued accommodation until risk-adjusted momentum indicators stabilize.*`);

      structuredLog.info('QE event executed', {
        recipients: targets.length,
        totalAmount: totalDistributed,
        amountPer: qeAmount
      });

    } catch (error) {
      structuredLog.error('QE execution failed', error);
    }
  }

  /**
   * Check if buyback should be triggered
   */
  async checkBuyback() {
    const shouldTrigger = Math.random() < this.BUYBACK_PROBABILITY;
    
    if (shouldTrigger) {
      await this.executeBuyback();
    }
  }

  /**
   * Execute strategic buyback event
   */
  async executeBuyback() {
    try {
      // Target profitable players for "share repurchase"
      const profitablePlayers = await getGamblingLeaderboard('profit');
      const targets = profitablePlayers
        .filter(player => player.net_profit > 50) // Must have 50+ GC profit
        .slice(0, 3); // Top 3 profitable players

      if (targets.length === 0) {
        structuredLog.info('No profitable players found for buyback');
        return;
      }

      // Calculate buyback amounts (105-120% of some arbitrary calculation)
      const buybackData = [];
      let totalBought = 0;

      for (const target of targets) {
        const user = await getUser(target.user_id);
        if (!user || user.balance < 20) continue; // Need minimum balance

        // Calculate "fair value" (completely arbitrary)
        const fairValue = Math.floor(target.net_profit * 0.15) + Math.floor(Math.random() * 20) + 10;
        const premium = 1.05 + (Math.random() * 0.15); // 105-120% premium
        const buybackAmount = Math.floor(fairValue * premium);
        
        // Don't buy more than they have
        const actualAmount = Math.min(buybackAmount, user.balance);
        
        if (actualAmount >= 10) {
          buybackData.push({
            userId: target.user_id,
            amount: actualAmount,
            fairValue,
            premium: ((actualAmount / fairValue - 1) * 100).toFixed(1)
          });
          totalBought += actualAmount;
        }
      }

      if (buybackData.length === 0) {
        structuredLog.info('No viable buyback targets found');
        return;
      }

      let announcement;
      try {
        const contextualPrompt = await this.context.generateContextualPrompt('buyback', {
          totalAmount: totalBought,
          participants: buybackData.length
        });
        announcement = await llmService.generateText(contextualPrompt);
        structuredLog.info('Buyback announcement generated via LLM', { 
          participantCount: buybackData.length, 
          totalAmount: totalBought 
        });
      } catch (error) {
        structuredLog.error('Failed to generate buyback announcement via LLM', error, {
          action: 'strategic_buyback',
          participantCount: buybackData.length,
          totalAmount: totalBought,
          fallbackUsed: true
        });
        announcement = "The GarryCoin Federal Reserve has no comments at this time.";
      }

      // Execute the buybacks
      await db.transaction(async trx => {
        for (const buyback of buybackData) {
          await transfer(buyback.userId, 'federal_reserve', buyback.amount, 'fgr_strategic_buyback', trx);
        }
      });

      // Record the event
      await recordFGREvent('buyback', announcement, {
        buybacks: buybackData,
        totalAmount: totalBought
      }, totalBought, buybackData.length);

      // Format buyback details
      const buybackDetails = buybackData.map(b => 
        `• <@${b.userId}>: ${b.amount} GC (${b.premium}% premium)`
      ).join('\n');

      // Post announcement
      await this.broadcastAnnouncement(`**🏛️ FEDERAL GARRYCOIN RESERVE - STRATEGIC BUYBACK PROGRAM**

${announcement}

**Repurchase Details:**
${buybackDetails}

**Total Program Size:** ${totalBought} GC
**Average Premium:** ${(buybackData.reduce((sum, b) => sum + parseFloat(b.premium), 0) / buybackData.length).toFixed(1)}%

*This transaction strengthens the Federal Reserve's capital position while providing liquidity to institutional-quality market participants.*`);

      structuredLog.info('Buyback event executed', {
        participants: buybackData.length,
        totalAmount: totalBought
      });

    } catch (error) {
      structuredLog.error('Buyback execution failed', error);
    }
  }

  /**
   * Check if policy announcement should be made
   */
  async checkPolicyAnnouncement() {
    const shouldTrigger = Math.random() < this.ANNOUNCEMENT_PROBABILITY;
    
    if (shouldTrigger) {
      await this.makePolicyAnnouncement();
    }
  }

  /**
   * Make a random policy announcement with no actual effect
   */
  async makePolicyAnnouncement() {
    try {
      // Random economic "topics" to discuss
      const topics = [
        'yield curve inversions in the meme-coin sector',
        'cross-currency emoji transfer flows',
        'systematic risk in the degenerate gambling complex',
        'volatility spillover effects from Discord server dynamics',
        'liquidity stress in the heist arbitrage market',
        'beta-adjusted momentum signals in RTB derivatives',
        'counter-cyclical capital buffer adequacy',
        'monetary transmission mechanism disruption'
      ];

      const randomTopic = topics[Math.floor(Math.random() * topics.length)];

      let announcement;
      try {
        const contextualPrompt = await this.context.generateContextualPrompt('announcement', {
          topic: randomTopic
        });
        announcement = await llmService.generateText(contextualPrompt);
        structuredLog.info('Policy announcement generated via LLM', { 
          topic: randomTopic 
        });
      } catch (error) {
        structuredLog.error('Failed to generate policy announcement via LLM', error, {
          action: 'policy_announcement',
          topic: randomTopic,
          fallbackUsed: true
        });
        announcement = "The GarryCoin Federal Reserve has no comments at this time.";
      }

      // Record the event
      await recordFGREvent('announcement', announcement, {
        topic: randomTopic,
        metrics
      });

      // Post announcement
      await this.broadcastAnnouncement(`**🏛️ FEDERAL GARRYCOIN RESERVE - POLICY STATEMENT**

${announcement}

*The Federal Reserve will continue to assess incoming data and adjust the stance of monetary policy as appropriate to foster maximum employment and price stability.*`);

      structuredLog.info('Policy announcement made', { topic: randomTopic });

    } catch (error) {
      structuredLog.error('Policy announcement failed', error);
    }
  }

  /**
   * Broadcast announcement to all servers
   */
  async broadcastAnnouncement(message) {
    try {
      const guilds = this.client.guilds.cache;
      
      for (const [guildId, guild] of guilds) {
        try {
          // Find a general channel to post in
          const channel = guild.channels.cache.find(ch => 
            ch.type === 0 && // Text channel
            (ch.name.includes('general') || ch.name.includes('main') || ch.name.includes('chat')) &&
            ch.permissionsFor(guild.members.me).has(['SendMessages', 'ViewChannel'])
          );

          if (channel) {
            await channel.send(message);
            structuredLog.info('FGR announcement sent', { 
              guildId, 
              channelId: channel.id 
            });
          }
        } catch (error) {
          structuredLog.warn('Failed to send FGR announcement to guild', { 
            guildId, 
            error: error.message 
          });
        }
      }
    } catch (error) {
      structuredLog.error('Failed to broadcast FGR announcement', error);
    }
  }

  /**
   * Manual trigger methods for testing
   */
  async triggerQE() {
    const metrics = await getEconomicMetrics();
    await this.executeQuantitativeEasing(metrics);
  }

  async triggerBuyback() {
    await this.executeBuyback();
  }

  async triggerAnnouncement() {
    await this.makePolicyAnnouncement();
  }
}

module.exports = { FGREvents };