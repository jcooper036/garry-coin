const { SlashCommandBuilder } = require('discord.js');
const { getEconomicMetrics, getFGREvents } = require('../db');
const { llmService } = require('../llm_service');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('garryreservereport')
    .setDescription('View the Federal GarryCoin Reserve economic analysis report'),

  async execute(interaction) {
    // Defer reply since this might take a moment with LLM generation
    await interaction.deferReply({ ephemeral: false });

    try {
      // Get current economic data
      const metrics = await getEconomicMetrics();
      const recentEvents = await getFGREvents(3);

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

      // Prepare data for LLM context
      const dataContext = {
        totalSupply: metrics.economicMetrics.totalSupply,
        activeUsers: metrics.userMetrics.activeUsers,
        activityRate: metrics.userMetrics.activityRate,
        gamblingVolume: metrics.economicMetrics.weeklyGamblingVolume,
        heistWinRate: metrics.gameMetrics.heist.winRate,
        rtbGames: metrics.gameMetrics.rtb.games,
        wavelengthGames: metrics.gameMetrics.wavelength.games
      };

      // Generate economic analysis using LLM
      const analysisPrompt = `You are the Federal GarryCoin Reserve Chairman. Write a 3-4 sentence economic analysis/outlook using serious financial terminology but with completely nonsensical reasoning. Use this data: ${metrics.userMetrics.activityRate.toFixed(1)}% user activity rate, ${metrics.gameMetrics.heist.winRate.toFixed(1)}% heist success rate, ${metrics.economicMetrics.weeklyGamblingVolume} GC weekly gambling volume, ${metrics.userMetrics.activeUsers} active users. Sound authoritative but absurd. No disclaimers.`;

      const fallbackAnalyses = [
        `Based on cross-sectional volatility analysis, the ${metrics.userMetrics.activityRate.toFixed(1)}% participation rate indicates elevated systematic risk premiums in the meme-coin derivatives market. The ${metrics.gameMetrics.heist.winRate.toFixed(1)}% heist success rate suggests underlying liquidity stress, requiring immediate quantitative easing measures. Market microstructure analysis reveals significant alpha decay in the wavelength futures complex.`,
        
        `Current market conditions exhibit classic signs of beta-adjusted momentum reversal, with the ${metrics.economicMetrics.weeklyGamblingVolume} GC gambling volume indicating excessive leverage in retail gambling portfolios. The Federal Reserve maintains its accommodative stance while monitoring cross-currency emoji transfer flows for signs of systematic risk spillover effects.`,
        
        `Technical indicators suggest we're approaching a critical inflection point in the GarryCoin yield curve, with ${metrics.userMetrics.activeUsers} active participants creating dangerous concentrations of risk-parity exposure. The Board recommends immediate implementation of counter-cyclical capital buffers to prevent cascading failures in the heist-to-RTB arbitrage complex.`
      ];

      let economicAnalysis;
      try {
        economicAnalysis = await llmService.generateWithFallbacks(analysisPrompt, fallbackAnalyses);
      } catch (error) {
        console.error('LLM generation failed, using fallback:', error);
        economicAnalysis = fallbackAnalyses[Math.floor(Math.random() * fallbackAnalyses.length)];
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