require('dotenv').config();
const express = require('express');
const { verifyKeyMiddleware } = require('discord-interactions');
const { InteractionType, InteractionResponseType, InteractionResponseFlags } = require('discord-interactions');
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { findOrCreateUser, transfer, updateUserActivity, getUser, getActiveBusGame, addPlayerToBusGame, createBusGame, cancelBusGame, grant, getBusGamePlayers, createWavelengthGame, getActiveWavelengthGame, addPlayerToWavelengthGame, getWavelengthPlayers, getWavelengthGame, updateWavelengthPlayer, getGamblingStats, getGamblingLeaderboard, getEconomicMetrics, getFGREvents } = require('./db');
const { startJoinTimer, handlePlayerChoice, buildGameEmbed } = require('./commands/games/ride_the_bus/ridethebus_helpers');
const { endWavelengthGame, startWavelengthTimer } = require('./commands/games/wavelength/wavelength_helpers');
const { structuredLog } = require('./logger');
const connectionWarmer = require('./connection_warmer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;


const PUBLIC_KEY = process.env.PUBLIC_KEY;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.login(process.env.DISCORD_TOKEN);

const commands = new Map();
const commandsPath = path.join(__dirname, 'commands');
const wavelengthScales = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/wavelength_scales.json'), 'utf8'));
structuredLog.game('Wavelength scales loaded', { count: wavelengthScales.length });

// --- Wavelength Scale Validation ---
const createWavelengthPlaceholder = (scale) => `e.g., a word for "${scale.topic}"`;

for (const scale of wavelengthScales) {
  const placeholder = createWavelengthPlaceholder(scale);
  if (placeholder.length > 100) {
    throw new Error(`Wavelength scale placeholder is too long for discord modal creation (${placeholder.length}/100): "${placeholder}" . You need to go shorten these inputs at the source`);
  }
}
structuredLog.game('Wavelength scales validation passed');
// ------------------------------------

const loadCommands = (dir) => {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      loadCommands(fullPath);
    } else if (file.name.endsWith('.js')) {
      const command = require(fullPath);
      if (command.name && command.execute) {
        commands.set(command.name, command);
      } else {
        structuredLog.warn('Command missing required properties', {
          filePath: fullPath,
          category: 'system'
        });
      }
    }
  }
};

loadCommands(commandsPath);

app.get('/', (req, res) => {
  res.sendStatus(200);
});

// Health check endpoint with database connection metrics
app.get('/health', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test database connection
    await require('./db').db.raw('SELECT 1 as health_check');
    
    const dbResponseTime = Date.now() - startTime;
    const poolMetrics = connectionWarmer.getPoolMetrics();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        responseTime: dbResponseTime,
        status: dbResponseTime < 1000 ? 'healthy' : 'slow'
      },
      connectionPool: {
        ...poolMetrics,
        stressed: connectionWarmer.isPoolStressed(),
        utilization: Math.round((poolMetrics.used / poolMetrics.max) * 100)
      }
    };
    
    res.json(health);
  } catch (error) {
    structuredLog.error('Health check failed', { error: error.message });
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      connectionPool: connectionWarmer.getPoolMetrics()
    });
  }
});

app.post('/interactions', verifyKeyMiddleware(PUBLIC_KEY), async (req, res) => {
  const fetch = (await import('node-fetch')).default;
  const { type, id, data } = req.body;

  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name, options } = data;
    const { user } = req.body.member;
    const { channel_id, guild_id, channel } = req.body;
    try {
      await updateUserActivity(user.id);
    } catch (error) {
      structuredLog.error('Failed to update user activity', {
        userId: user.id,
        error: error.message,
        category: 'database'
      });
    }
    structuredLog.command('Command received', {
      commandName: name,
      userId: user.id,
      username: user.username,
      globalName: user.global_name,
      channelId: channel_id,
      channelName: channel.name,
      guildId: guild_id
    });

    // Ensure user exists in the database
    try {
      await findOrCreateUser(user.id);
    } catch (error) {
      structuredLog.error('Error checking/adding user to database', {
        userId: user.id,
        error: error.message,
        category: 'database'
      });
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'An internal error occurred. Please try again later.',
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    if (name === 'test') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'Hello from the GarryCoin community',
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    if (commands.has(name)) {
      const command = commands.get(name);
      
      // Smart deferral: Check if pool is stressed and this command doesn't already defer
      const poolStressed = connectionWarmer.isPoolStressed();
      const poolMetrics = connectionWarmer.getPoolMetrics();
      
      if (poolStressed) {
        structuredLog.warn('Pool stress detected, considering deferral', {
          command: name,
          poolMetrics,
          userId: user.id
        });
        
        // For simple commands that don't already use postProcess, defer them
        // Complex commands already have their own deferral logic
        const alreadyDeferred = ['garrymakeitrain', 'garryreservereport', 'garryloan', 'garrycreditreport', 'ridethebus'].includes(name);
        
        if (!alreadyDeferred) {
          structuredLog.info('Auto-deferring command due to pool stress', {
            command: name,
            poolMetrics,
            userId: user.id
          });
          
          // Defer the response
          res.send({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
          
          // Execute command and send response via webhook
          try {
            const response = await command.execute(req.body, client);
            
            await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: response.content,
                flags: response.ephemeral ? InteractionResponseFlags.EPHEMERAL : undefined
              }),
            });
            
            structuredLog.info('Auto-deferred command completed successfully', {
              command: name,
              userId: user.id
            });
          } catch (error) {
            structuredLog.error('Auto-deferred command failed', {
              command: name,
              userId: user.id,
              error: error.message
            });
            
            await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: '❌ Command failed due to database connection issues. Please try again.',
                flags: InteractionResponseFlags.EPHEMERAL
              }),
            });
          }
          return;
        }
      } else {
        structuredLog.database('Pool healthy, executing command normally', {
          command: name,
          poolMetrics,
          userId: user.id
        });
      }
      
      const response = await command.execute(req.body, client);

      // Special post-processing for Ride the Bus game creation
      if (response.postProcess === 'create_bus_game') {
        // Instead of res.send, we manually handle the interaction response
        // to get the message ID for game creation.

        // Acknowledge the interaction to prevent timeout.
        res.send({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });

        const transferResult = await transfer(response.hostId, client.user.id, response.wager, 'rtb_wager');
        if (!transferResult.success) {
          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: "Failed to transfer wager. The bus drove off." }),
          });
          return;
        }

        const messagePayload = {
          embeds: response.embeds,
          components: response.components,
        };

        const messageResponse = await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messagePayload),
        });

        const messageData = await messageResponse.json();

        const game = await createBusGame(response.hostId, channel_id, messageData.id, response.wager);
        startJoinTimer(game.id, client, response.boardingTime);
        return;
      }

      // Special post-processing for Make It Rain command
      if (response.postProcess === 'make_it_rain') {
        // Acknowledge the interaction to prevent timeout
        res.send({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });

        let successCount = 0;
        for (const member of response.members.values()) {
          if (member.user.bot || member.user.id === response.senderId) continue;

          await findOrCreateUser(member.user.id);
          const result = await transfer(response.senderId, member.user.id, 1, 'user_to_user_make_it_rain');
          if (result.success) {
            successCount++;
          }
        }

        await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: `You have made it rain on ${successCount} members of the server!` }),
        });
        return;
      }

      // Special post-processing for Federal GarryCoin Reserve Report
      if (response.postProcess === 'garry_reserve_report') {
        // Acknowledge the interaction to prevent timeout
        res.send({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });

        // Set a timeout for the entire process to prevent hanging
        const processTimeout = setTimeout(async () => {
          try {
            structuredLog.error('FGR report generation timed out after 30 seconds');
            await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: '❌ Federal Reserve report generation timed out. The economic modeling systems are currently under stress. Please try again later.'
              }),
            });
          } catch (error) {
            structuredLog.error('Failed to send timeout message', { error: error.message });
          }
        }, 30000);

        try {
          structuredLog.info('Starting FGR report generation', { userId: response.userId });

          const context = new (require('./fgr_context')).FGRContext();
          structuredLog.info('FGRContext created successfully');

          // Get current economic data and context
          structuredLog.info('Fetching economic metrics');
          const metrics = await getEconomicMetrics();
          structuredLog.info('Economic metrics fetched', { metricsKeys: Object.keys(metrics) });

          // Get current interest rate
          structuredLog.info('Fetching current interest rate');
          let currentInterestRate = 5.0;
          try {
            const policy = await getFGRPolicy('base_interest_rate');
            currentInterestRate = policy ? parseFloat(policy.policy_data.rate || 5.0) : 5.0;
            structuredLog.info('Current interest rate fetched', { rate: currentInterestRate });
          } catch (error) {
            structuredLog.warn('Failed to fetch interest rate, using default', { defaultRate: currentInterestRate });
          }

          structuredLog.info('Fetching recent FGR events');
          const recentEvents = await getFGREvents(3);
          structuredLog.info('Recent events fetched', { eventCount: recentEvents.length });

          structuredLog.info('Getting market context');
          const marketContext = await context.getMarketContext();
          structuredLog.info('Market context received', { contextKeys: Object.keys(marketContext) });

          // Build base report with real data
          structuredLog.info('Building base report');
          const baseReport = `**Federal GarryCoin Reserve - Economic Analysis Report**
**Reporting Period:** ${new Date().toLocaleDateString()}

**Monetary Policy:**
• Current Base Interest Rate: ${currentInterestRate.toFixed(2)}%

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
          structuredLog.info('Processing recent events');
          let eventsText = '';
          if (recentEvents.length > 0) {
            eventsText = recentEvents.map(event =>
              `• ${event.event_type.toUpperCase()}: ${event.description.substring(0, 60)}...`
            ).join('\n');
          } else {
            eventsText = '• No recent interventions recorded';
          }

          // Generate contextual economic analysis using LLM with timeout
          structuredLog.info('Preparing LLM prompt');
          const contextualPrompt = `You are the Federal GarryCoin Reserve Chairman writing a brief economic outlook statement.

${context.formatContextForLLM(marketContext)}

Current base interest rate: ${currentInterestRate.toFixed(2)}%

Write a concise 2-3 sentence economic analysis using Federal Reserve terminology and financial jargon, but with nonsensical economic reasoning. Keep it under 200 characters. Reference specific data points. Sound authoritative but make the logic absurd. No disclaimers.`;

          const { llmService } = require('./llm_service');
          let economicAnalysis;

          // Add timeout to LLM call to prevent hanging
          const llmTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('LLM timeout')), 15000)
          );

          try {
            structuredLog.info('Calling LLM service with timeout');
            economicAnalysis = await Promise.race([
              llmService.generateText(contextualPrompt),
              llmTimeout
            ]);
            structuredLog.info('Economic analysis generated via LLM for reserve report');
          } catch (error) {
            structuredLog.error('Failed to generate economic analysis via LLM', error, {
              action: 'reserve_report_generation',
              userId: response.userId,
              fallbackUsed: true
            });
            economicAnalysis = "The GarryCoin Federal Reserve has no comments at this time.";
          }

          structuredLog.info('Building full report');
          const fullReport = `${baseReport}
${eventsText}

**Economic Outlook:**
${economicAnalysis}

**Forward Guidance:**
The FOMC remains data-dependent and will monitor emoji velocity and cross-sectional gambling beta exposures.

*This report contains forward-looking statements subject to GarryCoin market volatility and regulatory capture by Discord moderators.*`;

          // Check if message is too long for Discord (2000 char limit)
          const finalReport = fullReport.length > 2000
            ? fullReport.substring(0, 1950) + '...\n\n*[Report truncated due to length]*'
            : fullReport;

          structuredLog.info('Final report prepared', {
            originalLength: fullReport.length,
            finalLength: finalReport.length,
            truncated: fullReport.length > 2000
          });

          // Send the final report
          structuredLog.info('Sending final report to Discord');
          const webhookResponse = await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: finalReport }),
          });

          if (!webhookResponse.ok) {
            const errorText = await webhookResponse.text();
            structuredLog.error('Discord webhook failed', {
              status: webhookResponse.status,
              statusText: webhookResponse.statusText,
              errorText: errorText,
              userId: response.userId
            });
            throw new Error(`Discord webhook failed: ${webhookResponse.status} ${webhookResponse.statusText}`);
          }

          structuredLog.info('FGR economic report sent successfully', { userId: response.userId });

          // Clear the timeout since we completed successfully
          clearTimeout(processTimeout);

        } catch (error) {
          // Clear timeout on error as well
          clearTimeout(processTimeout);
          structuredLog.error('Failed to generate FGR economic report', {
            error: error.message,
            stack: error.stack,
            userId: response.userId
          });

          // Send error message
          try {
            await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: 'The Federal Reserve\'s economic modeling systems are experiencing a temporary outage. Please consult your financial advisor or try again later.',
                flags: InteractionResponseFlags.EPHEMERAL
              }),
            });
          } catch (fetchError) {
            structuredLog.error('Failed to send error message to Discord', {
              error: fetchError.message,
              userId: response.userId
            });
          }
        }
        return;
      }


      // Special post-processing for credit reports
      if (response.postProcess === 'generate_credit_report') {
        // Acknowledge the interaction to prevent timeout
        res.send({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });

        try {
          const { requesterId, targetUserId } = response;
          const isOwnReport = targetUserId === requesterId;

          const {
            findOrCreateUser,
            getUser,
            calculateCreditScore,
            calculateDebtToAssetRatio,
            getUserLoans,
            getLoanHistory,
            getGamblingStats
          } = require('./db');

          const getCreditRating = (score) => {
            if (score >= 800) return 'Exceptional';
            if (score >= 740) return 'Very Good';
            if (score >= 670) return 'Good';
            if (score >= 580) return 'Fair';
            if (score >= 300) return 'Poor';
            return 'No Score';
          };

          const getCreditFactorsExplanation = (user, gamblingStats, loanHistory) => {
            const factors = [];
            const balancePoints = Math.min((Math.max(user.balance, 0) / 100) * 10, 100);
            factors.push(`💰 **Balance Factor (40%):** ${balancePoints.toFixed(0)}/100 points`);

            const winRate = gamblingStats.overall.winRate || 0;
            const winRatePoints = winRate * 3;
            factors.push(`🎲 **Gambling Performance (30%):** ${winRatePoints.toFixed(0)}/300 points`);

            let loanHistoryPoints = 100;
            if (loanHistory.totalLoans > 0) {
              const debtEventRate = loanHistory.debtEvents / loanHistory.totalLoans;
              if (debtEventRate === 0) loanHistoryPoints = 150;
              else if (debtEventRate <= 0.2) loanHistoryPoints = 75;
              else loanHistoryPoints = 25;
            }
            factors.push(`📋 **Loan History (30%):** ${loanHistoryPoints}/150 points`);

            return factors.join('\n');
          };

          await findOrCreateUser(targetUserId);
          const user = await getUser(targetUserId);

          if (!user) {
            await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: '❌ User not found in the database.' }),
            });
            return;
          }

          const creditScore = await calculateCreditScore(targetUserId);
          const creditRating = getCreditRating(creditScore);
          const debtRatio = await calculateDebtToAssetRatio(targetUserId);
          const activeLoans = await getUserLoans(targetUserId, 'active');
          const loanHistory = await getLoanHistory(targetUserId);
          const gamblingStats = await getGamblingStats(targetUserId);

          let report = `📊 **Credit Report${isOwnReport ? '' : ` for <@${targetUserId}>`}**\n\n`;
          report += `🏦 **CREDIT SCORE**\n**Score:** ${creditScore} (${creditRating})\n**Range:** 300-850\n\n`;
          report += `📈 **DEBT-TO-ASSET RATIO**\n**Ratio:** ${(debtRatio * 100).toFixed(1)}%\n**Risk Level:** ${debtRatio < 0.3 ? 'Low' : debtRatio < 0.7 ? 'Medium' : 'High'}\n\n`;
          report += `💳 **OUTSTANDING LOANS**\n`;

          if (activeLoans.length === 0) {
            report += `No active loans\n\n`;
          } else {
            for (const loan of activeLoans) {
              const interestAmount = Math.floor(loan.amount * (loan.interest_rate / 100));
              const totalDue = loan.amount + interestAmount;
              const dueDate = new Date(loan.due_date);
              const dueDateString = dueDate.toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York'
              });
              const lenderDisplay = loan.lender_user_id === client.user.id ? 'GarryCoin Bot' : `<@${loan.lender_user_id}>`;

              report += `**Loan #${loan.id}** - ${loan.amount} GC @ ${loan.interest_rate}% daily (compounding)\n   Due: ${dueDateString} EST (${totalDue} GC total)\n   Lender: ${lenderDisplay}\n`;
            }
            report += `\n`;
          }

          report += `📈 **LOAN HISTORY SUMMARY**\n**Total Loans:** ${loanHistory.totalLoans}\n**Paid in Full:** ${loanHistory.paidLoans}\n**Defaults:** ${loanHistory.defaultedLoans}\n**On-Time Payments:** ${loanHistory.onTimePayments}\n**Debt Events:** ${loanHistory.debtEvents}\n\n`;

          if (isOwnReport) {
            report += `🔍 **CREDIT SCORE BREAKDOWN**\n${getCreditFactorsExplanation(user, gamblingStats, loanHistory)}\n\n💡 **TIPS TO IMPROVE CREDIT**\n`;
            if (user.balance < 100) report += `• Maintain a higher GarryCoin balance\n`;
            if (gamblingStats.overall.winRate < 50 && gamblingStats.overall.gamesPlayed > 10) report += `• Improve gambling strategy or reduce risky bets\n`;
            if (loanHistory.debtEvents > 0) report += `• Make timely loan payments to avoid debt events\n`;
            if (loanHistory.totalLoans === 0) report += `• Consider taking small loans and paying them back on time\n`;
            report += `• Stay active and maintain positive account standing`;
          }

          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: report }),
          });

        } catch (error) {
          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '❌ An error occurred while generating the credit report. Please try again later.' }),
          });
        }
        return;
      }

      if (response.type === 'modal') {
        return res.send({
          type: InteractionResponseType.MODAL,
          data: response.modal.toJSON(),
        });
      }


      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: response.content,
          flags: response.ephemeral ? InteractionResponseFlags.EPHEMERAL : 0,
          components: response.components || [],
        },
      });
    }
  }

  if (type === InteractionType.MESSAGE_COMPONENT) {
    const { custom_id } = data;
    const playerId = req.body.member.user.id;

    // --- Loan Button Handling ---
    if (custom_id.startsWith('loan_')) {
      const parts = custom_id.split('_');
      const action = parts[1];
      
      if (action === 'reject') {
        return res.send({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: {
            content: '❌ **Loan Rejected**\n\nYou have declined the loan offer.',
            components: [],
          },
        });
      }
      
      if (action === 'accept') {
        const [_, __, userId, lenderId, amount, interestRate] = parts;
        
        // Verify the user clicking the button is the same as the borrower
        if (playerId !== userId) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: "❌ This loan offer is not for you.",
              flags: InteractionResponseFlags.EPHEMERAL,
            },
          });
        }

        // Process the actual loan
        res.send({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });

        try {
          const {
            findOrCreateUser,
            getUser,
            calculateCreditScore,
            calculateRiskBasedInterestRate,
            createLoan,
            getFGRPolicy
          } = require('./db');

          // Re-validate loan eligibility at acceptance time
          await findOrCreateUser(userId);

          // Check lender still has funds
          const lender = await getUser(lenderId);
          if (!lender) {
            const lenderName = lenderId === client.user.id ? 'GarryCoin Bot' : `<@${lenderId}>`;
            throw new Error(`${lenderName} not found in the database.`);
          }

          const maxLoanAmount = Math.floor(lender.balance * 0.5);
          const requestedAmount = parseInt(amount);
          
          if (requestedAmount > maxLoanAmount) {
            const lenderName = lenderId === client.user.id ? 'GarryCoin Bot' : `<@${lenderId}>`;
            throw new Error(`Loan amount now exceeds 50% of ${lenderName}'s balance. Max available: ${maxLoanAmount} GC`);
          }

          // Recalculate interest rate with current conditions
          const getBaseInterestRate = async () => {
            try {
              const policy = await getFGRPolicy('base_interest_rate');
              return policy ? parseFloat(policy.policy_data.rate || 5.0) : 5.0;
            } catch (error) {
              return 5.0;
            }
          };
          
          const baseInterestRate = await getBaseInterestRate();
          const rateResult = await calculateRiskBasedInterestRate(userId, lenderId, requestedAmount, baseInterestRate);
          const finalInterestRate = rateResult.rate;
          const creditScore = rateResult.breakdown.creditScore;

          // Create the loan
          const loanResult = await createLoan(userId, lenderId, requestedAmount, finalInterestRate);

          if (!loanResult.success) {
            let failMessage = '❌ **Loan Processing Failed**\n\n';
            if (loanResult.message === 'max_active_loans_exceeded') {
              failMessage += 'You have reached the maximum number of active loans (10).\nPlease wait for some loans to be paid off before requesting new ones.';
            } else {
              failMessage += `Error: ${loanResult.message}`;
            }
            throw new Error(failMessage);
          }

          // Calculate final loan details with daily compounding
          const environment = process.env.NODE_ENV || 'development';
          const dailyInterestRate = finalInterestRate / 100; // Convert percentage to decimal
          const loanPeriodDays = environment === 'development' ? (5 / (24 * 60)) : 3; // 5 minutes in dev, 3 days in prod
          
          // Compound interest formula: A = P(1 + r)^t
          const totalDue = Math.floor(requestedAmount * Math.pow(1 + dailyInterestRate, loanPeriodDays));
          const interestAmount = totalDue - requestedAmount;
          const dueDate = new Date(loanResult.loan.due_date);
          const repaymentPeriod = environment === 'development' ? '5 minutes' : '3 days';

          const dueDateString = dueDate.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York'
          });

          const lenderName = lenderId === client.user.id ? 'GarryCoin Bot' : `<@${lenderId}>`;

          const successMessage = `✅ **Loan Approved!**\n\n**Loan ID:** #${loanResult.loan.id}\n**Principal:** ${requestedAmount} GC\n**Daily Interest Rate:** ${finalInterestRate.toFixed(2)}% (compounding)\n**Loan Period:** ${loanPeriodDays.toFixed(4)} days\n**Interest Charge:** ${interestAmount} GC\n**Total Due:** ${totalDue} GC\n**Due Date:** ${dueDateString} EST\n**Lender:** ${lenderName}\n\n💳 **Your Credit Score:** ${creditScore}\n\nThe loan amount has been deposited into your account. Payment will be automatically deducted in ${repaymentPeriod}.`;

          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: successMessage, components: [] }),
          });

        } catch (error) {
          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              content: typeof error.message === 'string' ? error.message : '❌ An error occurred while processing your loan. Please try again later.',
              components: [] 
            }),
          });
        }
        return;
      }
    }

    // --- Loan Repayment Button Handling ---
    if (custom_id.startsWith('repay_')) {
      const parts = custom_id.split('_');
      const action = parts[1];
      
      if (action === 'cancel') {
        return res.send({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: {
            content: '❌ **Loan Repayment Cancelled**\n\nYou have cancelled the loan repayment.',
            components: [],
          },
        });
      }
      
      if (action === 'select') {
        const [_, __, loanId, userId] = parts;
        
        // Verify the user clicking the button is the borrower
        if (playerId !== userId) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: "❌ This loan repayment is not for you.",
              flags: InteractionResponseFlags.EPHEMERAL,
            },
          });
        }

        // Show confirmation for specific loan
        res.send({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });

        try {
          const { getActiveLoan, calculateCurrentAmountDue } = require('./db');
          
          const loan = await getActiveLoan(parseInt(loanId));
          if (!loan || loan.borrower_user_id !== userId) {
            throw new Error('Loan not found or not accessible.');
          }

          const amountDue = calculateCurrentAmountDue(loan);
          const now = new Date();
          const hoursElapsed = (now - new Date(loan.created_at)) / (1000 * 60 * 60);
          const isEarlyRepayment = hoursElapsed < 24;

          let repaymentType = '';
          if (isEarlyRepayment) {
            const dailyInterest = loan.amount * (loan.interest_rate / 100);
            const penalty = Math.ceil(dailyInterest * 0.25);
            repaymentType = `⚡ **Early Repayment** (${hoursElapsed.toFixed(1)}h old)\n📋 Penalty: ${penalty} GC (25% of daily interest)\n`;
          }

          const lenderName = loan.lender_user_id === client.user.id ? 'GarryCoin Bot' : `<@${loan.lender_user_id}>`;

          const confirmationMessage = `💸 **Loan Repayment Confirmation**\n\n` +
            `🏦 **Loan #${loan.id}** from ${lenderName}\n` +
            `💰 Principal: ${loan.amount} GC\n` +
            `📊 Interest Rate: ${loan.interest_rate}%/day\n` +
            `${repaymentType}` +
            `💵 **Total Amount Due: ${amountDue} GC**\n\n` +
            `Are you sure you want to repay this loan?`;

          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`repay_confirm_${loan.id}_${userId}`)
                .setLabel(`💸 Pay ${amountDue} GC`)
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`repay_cancel_${userId}`)
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Secondary)
            );

          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: confirmationMessage,
              components: [row]
            }),
          });
        } catch (error) {
          structuredLog.loan('Error in repay_select handler', {
            userId: playerId,
            loanId: parts[2],
            error: error.message
          });

          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: '❌ An error occurred while processing your repayment request. Please try again later.',
              components: []
            }),
          });
        }
        return;
      }
      
      if (action === 'confirm') {
        const [_, __, loanId, userId] = parts;
        
        // Verify the user clicking the button is the borrower
        if (playerId !== userId) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: "❌ This loan repayment is not for you.",
              flags: InteractionResponseFlags.EPHEMERAL,
            },
          });
        }

        // Process the loan repayment
        res.send({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });

        try {
          const { getActiveLoan, calculateCurrentAmountDue, getUser, transfer } = require('./db');
          
          const loan = await getActiveLoan(parseInt(loanId));
          if (!loan || loan.borrower_user_id !== userId) {
            throw new Error('Loan not found or not accessible.');
          }

          const amountDue = calculateCurrentAmountDue(loan);
          const borrower = await getUser(userId);
          
          if (borrower.balance < amountDue) {
            throw new Error(`Insufficient funds. You need ${amountDue} GC but only have ${borrower.balance} GC.`);
          }

          // Process the repayment
          const { payLoan } = require('./db');
          const paymentResult = await payLoan(parseInt(loanId), amountDue);
          
          if (!paymentResult.success) {
            throw new Error(paymentResult.message || 'Repayment failed.');
          }

          const lenderName = loan.lender_user_id === client.user.id ? 'GarryCoin Bot' : `<@${loan.lender_user_id}>`;
          const now = new Date();
          const hoursElapsed = (now - new Date(loan.created_at)) / (1000 * 60 * 60);
          const isEarlyRepayment = hoursElapsed < 24;
          const repaymentTypeText = isEarlyRepayment ? ' (Early Repayment)' : '';

          const successMessage = `✅ **Loan Repaid Successfully**${repaymentTypeText}\n\n` +
            `🏦 **Loan #${loan.id}** from ${lenderName}\n` +
            `💰 Amount Paid: ${amountDue} GC\n` +
            `📊 Principal: ${loan.amount} GC\n` +
            `⏰ Loan Duration: ${hoursElapsed.toFixed(1)} hours\n\n` +
            `Your loan has been marked as paid and the funds have been transferred to the lender.`;

          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: successMessage,
              components: []
            }),
          });
        } catch (error) {
          structuredLog.loan('Error in repay_confirm handler', {
            userId: playerId,
            loanId: parts[2],
            error: error.message
          });

          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `❌ **Repayment Failed**\n\n${error.message}`,
              components: []
            }),
          });
        }
        return;
      }
    }

    // --- Ride the Bus Button Handling ---
    if (custom_id.startsWith('wl_')) {
      const parts = custom_id.split('_');
      const action = parts[1];

      if (action === 'host') {
        const [_, __, setup, wagerStr, showPlayerGuessesStr, scaleIndexStr, targetNumberStr] = parts;
        const wager = parseInt(wagerStr, 10);
        const showPlayerGuesses = showPlayerGuessesStr === 'true';
        const scaleIndex = parseInt(scaleIndexStr, 10);
        const targetNumber = parseInt(targetNumberStr, 10);
        const scale = wavelengthScales[scaleIndex];

        const modal = new ModalBuilder()
          .setCustomId(`wavelength_setup_${wager}_${showPlayerGuesses}_${scaleIndex}_${targetNumber}`)
          .setTitle('Wavelength - Enter Your Word');

        const hostWordInput = new TextInputBuilder()
          .setCustomId('host_word')
          .setLabel(`Your secret number is ${targetNumber}. What's your word?`)
          .setPlaceholder(createWavelengthPlaceholder(scale))
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const actionRow = new ActionRowBuilder().addComponents(hostWordInput);
        modal.addComponents(actionRow);

        return res.send({
          type: InteractionResponseType.MODAL,
          data: modal.toJSON(),
        });
      }

      const gameId = parts.length > 2 ? parseInt(parts[2], 10) : null;

      if (action === 'join') {
        const game = await getActiveWavelengthGame();
        if (!game) return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "This game is no longer active.", flags: InteractionResponseFlags.EPHEMERAL } });

        if (playerId === game.host_user_id) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: "You are the host of this game and cannot join.",
              flags: InteractionResponseFlags.EPHEMERAL,
            },
          });
        }

        const playerUser = await getUser(playerId);
        if (!playerUser || playerUser.balance < game.wager) {
          return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `You're too poor for this game. You only have ${playerUser?.balance || 0} GC.`, flags: InteractionResponseFlags.EPHEMERAL } });
        }

        const transferResult = await transfer(playerId, client.user.id, game.wager, 'wavelength_wager');
        if (!transferResult.success) {
          return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `Failed to pay fare: ${transferResult.message}`, flags: InteractionResponseFlags.EPHEMERAL } });
        }

        const addResult = await addPlayerToWavelengthGame(game.id, playerId);
        if (!addResult.success && addResult.message === 'already_joined') {
          await grant(playerId, game.wager, 'wavelength_refund_duplicate_join');
          return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "You are already in the game!", flags: InteractionResponseFlags.EPHEMERAL } });
        }

        const players = await getWavelengthPlayers(game.id);
        const originalEmbed = req.body.message.embeds[0];
        originalEmbed.fields[2].value = players.length.toString();
        originalEmbed.fields[3].value = players.map(p => `<@${p.user_id}>`).join('\n') || 'No one yet!';

        const guessButtons1 = new ActionRowBuilder();
        for (let i = -3; i <= 0; i++) {
          guessButtons1.addComponents(
            new ButtonBuilder()
              .setCustomId(`wl_guess_${game.id}_${i}`)
              .setLabel(i.toString())
              .setStyle(ButtonStyle.Primary)
          );
        }

        const guessButtons2 = new ActionRowBuilder();
        for (let i = 1; i <= 3; i++) {
          guessButtons2.addComponents(
            new ButtonBuilder()
              .setCustomId(`wl_guess_${game.id}_${i}`)
              .setLabel(i.toString())
              .setStyle(ButtonStyle.Primary)
          );
        }

        res.send({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });

        await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [originalEmbed] }),
        });

        await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: "You've joined the game! Make your guess:",
            components: [guessButtons1, guessButtons2],
            flags: InteractionResponseFlags.EPHEMERAL
          }),
        });

        return;
      }

      if (action === 'guess') {
        const guess = parseInt(parts[3], 10);
        await updateWavelengthPlayer(gameId, playerId, { guess: guess, player_status: 'guessed' });

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Your guess (${guess}) is locked in.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }

      if (action === 'reveal') {
        const game = await getActiveWavelengthGame();
        if (!game) return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "This game is no longer active.", flags: InteractionResponseFlags.EPHEMERAL } });

        if (game.host_user_id !== playerId) {
          return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "Only the host can reveal the answer.", flags: InteractionResponseFlags.EPHEMERAL } });
        }

        await endWavelengthGame(game.id, client);

        return res.send({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });
      }
    }
    if (custom_id.startsWith('rtb_')) {
      const parts = custom_id.split('_');
      const action = parts[1];

      if (action === 'join' || action === 'cancel') {
        // This logic is for the initial buttons that don't have a gameId.
        const game = await getActiveBusGame();
        if (!game) return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "This game is no longer active.", flags: InteractionResponseFlags.EPHEMERAL } });

        if (action === 'join') {
          const playerUser = await getUser(playerId);
          if (!playerUser || playerUser.balance < game.wager) {
            return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `You're too poor for this bus. You only have ${playerUser?.balance || 0} GC.`, flags: InteractionResponseFlags.EPHEMERAL } });
          }

          const transferResult = await transfer(playerId, client.user.id, game.wager, 'rtb_wager');
          if (!transferResult.success) {
            return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `Failed to pay fare: ${transferResult.message}`, flags: InteractionResponseFlags.EPHEMERAL } });
          }

          const addResult = await addPlayerToBusGame(game.id, playerId);
          if (!addResult.success && addResult.message === 'already_joined') {
            // Refund the user if they somehow clicked join twice
            await grant(playerId, game.wager, 'rtb_refund_duplicate_join');
            return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "You are already on the bus!", flags: InteractionResponseFlags.EPHEMERAL } });
          }

          const gameEmbed = await buildGameEmbed(game.id);

          // Acknowledge interaction, then edit message
          res.send({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });
          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [gameEmbed], components: req.body.message.components }),
          });
          return;
        } else { // cancel
          if (game.host_user_id !== playerId) return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "Only the host can cancel the bus.", flags: InteractionResponseFlags.EPHEMERAL } });

          await cancelBusGame(game.id);
          const players = await getBusGamePlayers(game.id);
          for (const player of players) {
            await transfer(client.user.id, player.user_id, game.wager, 'rtb_refund_cancel');
          }

          const cancelledEmbed = await buildGameEmbed(game.id);

          res.send({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });
          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [cancelledEmbed], components: [] }),
          });
          return;
        }
      } else if (action === 'choice' || action === 'cashout') {
        const gameId = parseInt(parts[2], 10);
        const response = await handlePlayerChoice(req.body, client);
        if (response.update_message) {
          const gameEmbed = await buildGameEmbed(gameId);

          // We can't send an ephemeral and update the message in one go.
          // So we'll update the message, and then send a new ephemeral follow-up.
          res.send({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });

          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [gameEmbed], components: req.body.message.components }),
          });

          // Send the ephemeral follow-up
          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: response.content, flags: 64 }), // 64 for EPHEMERAL
          });

        } else {
          return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { ...response, flags: InteractionResponseFlags.EPHEMERAL } });
        }
        return;
      }
    }
    if (custom_id.startsWith('heist_')) {
      const [game, choice, wagerStr, targetId] = custom_id.split('_');
      const wager = parseInt(wagerStr, 10);

      // The original interaction contains the ID of the user who initiated the command.
      // We check to make sure the person clicking the button is the one who started the heist.
      if (req.body.message.interaction.user.id !== playerId) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "This isn't your heist! Start your own with `/heist`.",
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
      if (game === 'heist') {
        // --- Heist Success Formula Constants ---
        const HEIST_BASE_CHANCE = 0.50;
        const HEIST_MAX_CHANCE = 0.95;
        const HEIST_MIN_CHANCE = 0.20;
        const HEIST_ACTIVITY_MAX_PENALTY = 0.05; // Max penalty for activity (e.g., 0.15 for 15%)
        const HEIST_ACTIVITY_MAX_DAYS = 3;     // Days until activity penalty is zero
        const HEIST_WEALTH_MODIFIER_SCALE = 0.45; // Scales the wealth bonus/penalty

        const thief = await getUser(playerId);
        const target = await getUser(targetId);

        if (!thief) {
          return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "Could not find your user data.", flags: InteractionResponseFlags.EPHEMERAL } });
        }
        if (!target) {
          return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "Could not find your target's user data.", flags: InteractionResponseFlags.EPHEMERAL } });
        }

        const thiefBalance = thief.balance;
        const targetBalance = target.balance;

        // 1. Calculate Activity Adjustment
        let activityAdjustment = 0;
        const botId = client.user.id;
        if (targetId !== botId && target.last_active_at) {
          const daysInactive = (new Date() - new Date(target.last_active_at)) / (1000 * 60 * 60 * 24);
          if (daysInactive < HEIST_ACTIVITY_MAX_DAYS) {
            const penalty = HEIST_ACTIVITY_MAX_PENALTY * ((HEIST_ACTIVITY_MAX_DAYS - daysInactive) / HEIST_ACTIVITY_MAX_DAYS);
            activityAdjustment = -penalty;
          }
        }

        // 2. Calculate Wealth Adjustment
        let wealthRatio = 1;
        if (targetBalance === 0) {
          wealthRatio = (thiefBalance > 0) ? Infinity : 1;
        } else {
          wealthRatio = thiefBalance / targetBalance;
        }
        // Use Math.max to prevent log10 from returning -Infinity if wealthRatio is 0
        const wealthAdjustment = -HEIST_WEALTH_MODIFIER_SCALE * Math.log10(Math.max(Number.MIN_VALUE, wealthRatio));

        // 3. Calculate Final Success Chance
        let finalSuccessChance = HEIST_BASE_CHANCE + activityAdjustment + wealthAdjustment;

        // Clamp the final chance
        finalSuccessChance = Math.max(HEIST_MIN_CHANCE, Math.min(HEIST_MAX_CHANCE, finalSuccessChance));

        structuredLog.heist('Heist calculation', {
          playerId,
          targetId,
          wager,
          balances: { thief: thiefBalance, target: targetBalance },
          adjustments: {
            activity: parseFloat(activityAdjustment.toFixed(4)),
            wealth: parseFloat(wealthAdjustment.toFixed(4))
          },
          finalChance: parseFloat(finalSuccessChance.toFixed(4))
        });

        const win = Math.random() < finalSuccessChance;
        let resultMessage = '';
        const formatPercent = (n) => `${(n * 100).toFixed(1)}%`;

        const explanation = `\n\n**Calculation:**\n` +
          `> ${formatPercent(HEIST_BASE_CHANCE)} (Base Chance)\n` +
          `> ${formatPercent(activityAdjustment)} (Target Activity)\n` +
          `> ${formatPercent(wealthAdjustment)} (Wealth Ratio)\n` +
          `> **Total: ${formatPercent(finalSuccessChance)} Chance**`;

        if (win) {
          await transfer(targetId, playerId, wager, 'heist_win');
          resultMessage = `Success! <@${playerId}> pulled off the heist, stealing ${wager} GarryCoins from <@${targetId}>!` + explanation;
        } else {
          await transfer(playerId, targetId, wager, 'heist_loss');
          resultMessage = `LMAO <@${playerId}> got caught and failed the heist, losing ${wager} GarryCoins to <@${targetId}>.` + explanation;
        }

        // Disable buttons on the original message
        const originalMessage = req.body.message;
        const disabledComponents = originalMessage.components.map(row => {
          row.components.forEach(component => component.disabled = true);
          return row;
        });

        return res.send({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: {
            content: resultMessage,
            components: disabledComponents,
          },
        });
      }
    }
  }

  if (type === InteractionType.MODAL_SUBMIT) {
    const { custom_id, components } = data;
    const { user } = req.body.member;
    const { channel_id } = req.body;

    if (custom_id.startsWith('wavelength_setup')) {
      structuredLog.game('Modal submit received', {
        customId: custom_id,
        components: JSON.stringify(components)
      });
      const [_, __, wagerStr, showPlayerGuessesStr, scaleIndexStr, targetNumberStr] = custom_id.split('_');
      const wager = parseInt(wagerStr, 10);
      const showPlayerGuesses = showPlayerGuessesStr === 'true';
      const scaleIndex = parseInt(scaleIndexStr, 10);
      const targetNumber = parseInt(targetNumberStr, 10);

      const hostWord = components[0].components[0].value;
      const scale = wavelengthScales[scaleIndex];

      structuredLog.game('Creating Wavelength game', {
        hostId: user.id,
        wager,
        showPlayerGuesses,
        scale: `${scale.scale_left} <-> ${scale.scale_right}`,
        targetNumber,
        hostWord
      });

      res.send({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });

      const transferResult = await transfer(user.id, client.user.id, wager, 'wavelength_wager');
      if (!transferResult.success) {
        await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: "Failed to transfer wager. The game could not be started." }),
        });
        return;
      }

      const initialEmbed = {
        color: 0x0099ff,
        title: '🌊 Wavelength 🌊',
        description: `A new game has been started by <@${user.id}>!\n**Wager:** ${wager} GC`,
        fields: [
          { name: 'Scale', value: `**(-3) ${scale.scale_left}** ↔️ **${scale.scale_right} (3)**` },
          { name: 'Host\'s Word', value: `**${hostWord}**` },
          { name: 'Players Joined', value: '1', inline: true },
          { name: 'Players', value: 'No one yet!', inline: true }
        ],
        footer: { text: 'Game will end in 10 minutes.' }
      };

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('wl_join')
            .setLabel('Join Game')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('wl_reveal')
            .setLabel('Reveal Answer')
            .setStyle(ButtonStyle.Danger),
        );

      const messageResponse = await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [initialEmbed], components: [row] }),
      });
      const messageData = await messageResponse.json();

      const game = await createWavelengthGame(user.id, channel_id, messageData.id, wager, scale.scale_left, scale.scale_right, targetNumber, hostWord, showPlayerGuesses);

      startWavelengthTimer(game.id, client);

      return;
    }
  }
}
);

app.listen(PORT, () => {
  structuredLog.info('Server started', { port: PORT, category: 'system' });
  
  // Start connection warming to prevent stale connection timeouts
  connectionWarmer.start();
});
