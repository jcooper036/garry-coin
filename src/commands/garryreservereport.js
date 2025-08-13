const { SlashCommandBuilder } = require('discord.js');
const { getEconomicMetrics, getFGREvents } = require('../db');
const { llmService } = require('../llm_service');
const { FGRContext } = require('../fgr_context');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('garryreservereport')
    .setDescription('View the Federal GarryCoin Reserve economic analysis report'),

  async execute(interaction) {
    // Defer reply since this might take a moment with LLM generation
    await interaction.deferReply({ ephemeral: false });

    try {
      const context = new FGRContext();
      
      // Get current economic data and context
      const metrics = await getEconomicMetrics();
      const recentEvents = await getFGREvents(3);
      const marketContext = await context.getMarketContext();

      // Build base report with real data
      const baseReport = `**Federal GarryCoin Reserve - Economic Analysis Report**
**Reporting Period:** ${new Date().toLocaleDateString()}

**Market Overview:**
• Total GarryCoin Supply: ${metrics.economicMetrics.totalSupply.toLocaleString()} GC
• Active Market Participants: ${metrics.userMetrics.activeUsers}/${metrics.userMetrics.totalUsers} (${metrics.userMetrics.activityRate.toFixed(1)}% participation rate)
• 24hr Transaction Volume: ${metrics.economicMetrics.recentTransactionVolume} transactions
• Weekly Gambling Volume: ${metrics.economicMetrics.weeklyGamblingVolume.toLocaleString()} GC

**Sectoral Performance:**
• Heist Market: ${metrics.gameMetrics.heist.games} transactions, ${metrics.gameMetrics.heist.winRate.toFixed(1)}% success rate
• RTB Securities: ${metrics.gameMetrics.rtb.games} games, avg wager ${metrics.gameMetrics.rtb.avgWager.toFixed(1)} GC
• Wavelength Derivatives: ${metrics.gameMetrics.wavelength.games} positions, avg exposure ${metrics.gameMetrics.wavelength.avgWager.toFixed(1)} GC

**Recent FGR Actions:**`;

      // Add recent events
      let eventsText = '';
      if (recentEvents.length > 0) {
        eventsText = recentEvents.map(event => 
          `• ${event.event_type.toUpperCase()}: ${event.description.substring(0, 100)}...`
        ).join('\n');
      } else {
        eventsText = '• No recent interventions recorded';
      }

      // Generate contextual economic analysis using LLM
      const contextualPrompt = `You are the Federal GarryCoin Reserve Chairman writing the economic outlook section of your quarterly report.

${context.formatContextForLLM(marketContext)}

Write a 3-4 sentence economic analysis and outlook using serious Federal Reserve terminology and financial jargon, but with completely nonsensical economic reasoning. Reference specific data points from the current market conditions above. Sound authoritative and professional, but make the economic logic completely absurd. Do not include disclaimers.`;

      let economicAnalysis;
      try {
        economicAnalysis = await llmService.generateText(contextualPrompt);
        structuredLog.info('Economic analysis generated via LLM for reserve report');
      } catch (error) {
        structuredLog.error('Failed to generate economic analysis via LLM', error, {
          action: 'reserve_report_generation',
          userId: interaction.user.id,
          fallbackUsed: true
        });
        economicAnalysis = "The GarryCoin Federal Reserve has no comments at this time.";
      }

      const fullReport = `${baseReport}
${eventsText}

**Economic Outlook:**
${economicAnalysis}

**Forward Guidance:**
The FOMC remains data-dependent and will continue monitoring emoji velocity, meme-coin correlations, and cross-sectional gambling beta exposures for signs of monetary transmission mechanism disruption.

*This report contains forward-looking statements subject to GarryCoin market volatility and regulatory capture by Discord moderators.*`;

      await interaction.editReply({
        content: fullReport
      });

    } catch (error) {
      console.error('Error in garryreservereport:', error);
      await interaction.editReply({
        content: 'The Federal Reserve\'s economic modeling systems are experiencing a temporary outage. Please consult your financial advisor or try again later.'
      });
    }
  }
};