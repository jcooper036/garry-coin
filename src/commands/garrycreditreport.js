const { InteractionResponseType } = require('discord-interactions');
const { 
  findOrCreateUser, 
  getUser, 
  calculateCreditScore, 
  getUserLoans,
  getLoanHistory,
  getGamblingStats
} = require('../db');
const { structuredLog } = require('../logger');

// Credit score rating helper
function getCreditRating(score) {
  if (score >= 800) return 'Exceptional';
  if (score >= 740) return 'Very Good';
  if (score >= 670) return 'Good';
  if (score >= 580) return 'Fair';
  if (score >= 300) return 'Poor';
  return 'No Score';
}

// Credit score explanation helper
function getCreditFactorsExplanation(user, gamblingStats, loanHistory) {
  const factors = [];

  // Balance factor
  const balancePoints = Math.min((Math.max(user.balance, 0) / 100) * 10, 100);
  factors.push(`💰 **Balance Factor (40%):** ${balancePoints.toFixed(0)}/100 points`);
  
  if (user.balance <= 0) {
    factors.push(`   ↳ Low/negative balance reduces creditworthiness`);
  } else if (user.balance >= 1000) {
    factors.push(`   ↳ High balance indicates financial stability`);
  }

  // Gambling win rate factor
  const winRate = gamblingStats.overall.winRate || 0;
  const winRatePoints = winRate * 3;
  factors.push(`🎲 **Gambling Performance (30%):** ${winRatePoints.toFixed(0)}/300 points`);
  
  if (gamblingStats.overall.gamesPlayed === 0) {
    factors.push(`   ↳ No gambling history - neutral impact`);
  } else if (winRate >= 60) {
    factors.push(`   ↳ Strong gambling performance shows good judgment`);
  } else if (winRate <= 30) {
    factors.push(`   ↳ Poor gambling performance indicates high risk`);
  }

  // Loan history factor
  let loanHistoryPoints = 100;
  if (loanHistory.totalLoans > 0) {
    const debtEventRate = loanHistory.debtEvents / loanHistory.totalLoans;
    if (debtEventRate === 0) {
      loanHistoryPoints = 150;
      factors.push(`📋 **Loan History (30%):** ${loanHistoryPoints}/150 points`);
      factors.push(`   ↳ Perfect repayment history - premium creditworthiness`);
    } else if (debtEventRate <= 0.2) {
      loanHistoryPoints = 75;
      factors.push(`📋 **Loan History (30%):** ${loanHistoryPoints}/150 points`);
      factors.push(`   ↳ Mostly on-time payments with occasional debt events`);
    } else {
      loanHistoryPoints = 25;
      factors.push(`📋 **Loan History (30%):** ${loanHistoryPoints}/150 points`);
      factors.push(`   ↳ Frequent debt events indicate repayment difficulties`);
    }
  } else {
    factors.push(`📋 **Loan History (30%):** ${loanHistoryPoints}/150 points`);
    factors.push(`   ↳ No loan history - neutral baseline`);
  }

  return factors.join('\\n');
}

module.exports = {
  name: 'garrycreditreport',
  async execute(interaction, client) {
    try {
      // Defer the reply to handle potential processing delays
      await interaction.deferReply({ ephemeral: true });

      const targetUser = interaction.options.getUser('user');
      const targetUserId = targetUser ? targetUser.id : interaction.user.id;
      const isOwnReport = targetUserId === interaction.user.id;

      // Ensure target user exists in database
      await findOrCreateUser(targetUserId);
      const user = await getUser(targetUserId);

      if (!user) {
        return await interaction.editReply({
          content: '❌ User not found in the database.',
        });
      }

      // Calculate/update credit score
      const creditScore = await calculateCreditScore(targetUserId);
      const creditRating = getCreditRating(creditScore);

      // Get loan information
      const activeLoans = await getUserLoans(targetUserId, 'active');
      const loanHistory = await getLoanHistory(targetUserId);
      const gamblingStats = await getGamblingStats(targetUserId);

      // Build credit report
      const reportHeader = `📊 **Credit Report${isOwnReport ? '' : ` for ${targetUser.displayName || targetUser.username}`}**`;
      
      let report = `${reportHeader}\\n\\n`;
      
      // Credit Score Section
      report += `🏦 **CREDIT SCORE**\\n`;
      report += `**Score:** ${creditScore} (${creditRating})\\n`;
      report += `**Range:** 300-850\\n\\n`;

      // Outstanding Loans Section
      report += `💳 **OUTSTANDING LOANS**\\n`;
      if (activeLoans.length === 0) {
        report += `No active loans\\n\\n`;
      } else {
        for (const loan of activeLoans) {
          const interestAmount = Math.floor(loan.amount * (loan.interest_rate / 100));
          const totalDue = loan.amount + interestAmount;
          const dueDate = new Date(loan.due_date);
          const dueDateString = dueDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'America/New_York'
          });
          
          const lenderDisplay = loan.lender_user_id === 'garry_bot' ? 'GarryCoin Bot' : `<@${loan.lender_user_id}>`;
          
          report += `**Loan #${loan.id}** - ${loan.amount} GC @ ${loan.interest_rate}%\\n`;
          report += `   Due: ${dueDateString} EST (${totalDue} GC total)\\n`;
          report += `   Lender: ${lenderDisplay}\\n`;
        }
        report += `\\n`;
      }

      // Loan History Summary
      report += `📈 **LOAN HISTORY SUMMARY**\\n`;
      report += `**Total Loans:** ${loanHistory.totalLoans}\\n`;
      report += `**Paid in Full:** ${loanHistory.paidLoans}\\n`;
      report += `**Defaults:** ${loanHistory.defaultedLoans}\\n`;
      report += `**On-Time Payments:** ${loanHistory.onTimePayments}\\n`;
      report += `**Debt Events:** ${loanHistory.debtEvents}\\n\\n`;

      // Only show detailed breakdown for own report
      if (isOwnReport) {
        report += `🔍 **CREDIT SCORE BREAKDOWN**\\n`;
        report += getCreditFactorsExplanation(user, gamblingStats, loanHistory);
        report += `\\n\\n`;
        
        // Improvement tips
        report += `💡 **TIPS TO IMPROVE CREDIT**\\n`;
        if (user.balance < 100) {
          report += `• Maintain a higher GarryCoin balance\\n`;
        }
        if (gamblingStats.overall.winRate < 50 && gamblingStats.overall.gamesPlayed > 10) {
          report += `• Improve gambling strategy or reduce risky bets\\n`;
        }
        if (loanHistory.debtEvents > 0) {
          report += `• Make timely loan payments to avoid debt events\\n`;
        }
        if (loanHistory.totalLoans === 0) {
          report += `• Consider taking small loans and paying them back on time\\n`;
        }
        report += `• Stay active and maintain positive account standing`;
      }

      structuredLog.loan('Credit report generated', {
        requesterId: interaction.user.id,
        targetUserId,
        creditScore,
        activeLoansCount: activeLoans.length,
        totalLoansHistorical: loanHistory.totalLoans
      });

      return await interaction.editReply({
        content: report,
      });

    } catch (error) {
      structuredLog.loan('Error executing garrycreditreport command', {
        userId: interaction.user.id,
        error: error.message,
        stack: error.stack
      });

      const errorMessage = '❌ An error occurred while generating the credit report. Please try again later.';
      
      if (interaction.deferred) {
        return await interaction.editReply({ content: errorMessage });
      } else {
        return await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }
};