const {
  findOrCreateUser,
  getUser,
  calculateCreditScore,
  calculateRiskBasedInterestRate,
  createLoan,
  checkDailyLoanLimit,
  getFGRPolicy
} = require('../db');
const { structuredLog } = require('../logger');

module.exports = {
  name: 'garryloan',
  async execute(interaction, client) {
    try {
      const userId = interaction.member.user.id;
      const amount = interaction.data.options.find(opt => opt.name === 'amount')?.value;
      const lenderOption = interaction.data.options.find(opt => opt.name === 'lender');
      const lenderId = lenderOption?.value || client.user.id;

      // Validate loan amount
      if (!amount || amount <= 0) {
        return {
          content: '❌ Loan amount must be greater than 0.',
          ephemeral: true,
        };
      }

      if (amount > 10000000000) {
        return {
          content: '❌ Loan amount cannot exceed 10,000,000,000 GC.',
          ephemeral: true,
        };
      }

      // Check loan eligibility 
      const loanLimit = await checkDailyLoanLimit(userId, lenderId);
      if (loanLimit.blocked) {
        let errorMessage;
        if (loanLimit.reason === 'max_loans') {
          errorMessage = "❌ You have reached the maximum of 10 active loans. Pay off some loans before requesting more.";
        } else if (loanLimit.reason === 'daily_limit_per_lender') {
          const lenderName = lenderId === client.user.id ? 'GarryCoin Bot' : `<@${lenderId}>`;
          errorMessage = `❌ You already have a loan from ${lenderName} today. Try again tomorrow or request from a different lender.`;
        }
        return {
          content: errorMessage,
          ephemeral: true,
        };
      }

      // Check if user is trying to loan to themselves
      if (lenderId === userId) {
        return {
          content: '❌ You cannot request a loan from yourself.',
          ephemeral: true,
        };
      }

      // Calculate loan terms and validate eligibility
      await findOrCreateUser(userId);

      // Get base interest rate from FGR or default to 5%
      const getBaseInterestRate = async () => {
        try {
          const policy = await getFGRPolicy('base_interest_rate');
          return policy ? parseFloat(policy.policy_data.rate || 5.0) : 5.0;
        } catch (error) {
          return 5.0;
        }
      };

      const baseInterestRate = await getBaseInterestRate();

      // Calculate risk-based interest rate
      const rateResult = await calculateRiskBasedInterestRate(userId, lenderId, amount, baseInterestRate);
      const adjustedInterestRate = rateResult.rate;
      const creditScore = rateResult.breakdown.creditScore;

      // Check lender eligibility
      const lender = await getUser(lenderId);
      if (!lender) {
        const lenderName = lenderId === client.user.id ? 'GarryCoin Bot' : `<@${lenderId}>`;
        return {
          content: `❌ **Loan Application Denied**\n\n${lenderName} not found in the database.`,
          ephemeral: true,
        };
      }

      const maxLoanAmount = Math.floor(lender.balance * 0.5);
      if (amount > maxLoanAmount) {
        const lenderName = lenderId === client.user.id ? 'GarryCoin Bot' : `<@${lenderId}>`;
        return {
          content: `❌ **Loan Application Denied**\n\n**Credit Score:** ${creditScore}\n**Requested Amount:** ${amount} GC\n**Reason:** Loan amount exceeds 50% of ${lenderName}'s balance\n**Max Available:** ${maxLoanAmount} GC`,
          ephemeral: true,
        };
      }

      // Calculate loan terms with daily compounding interest
      const environment = process.env.NODE_ENV || 'development';
      const dailyInterestRate = adjustedInterestRate / 100; // Convert percentage to decimal
      const loanPeriodDays = environment === 'development' ? (5 / (24 * 60)) : 3; // 5 minutes in dev, 3 days in prod

      // Compound interest formula: A = P(1 + r)^t
      const totalDue = Math.ceil(amount * Math.pow(1 + dailyInterestRate, loanPeriodDays));
      const interestAmount = totalDue - amount;
      const dueDate = new Date();
      const repaymentPeriod = environment === 'development' ? '5 minutes' : '3 days';

      if (environment === 'development') {
        dueDate.setMinutes(dueDate.getMinutes() + 5);
      } else {
        dueDate.setDate(dueDate.getDate() + 3);
      }

      const dueDateString = dueDate.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York'
      });

      const lenderName = lenderId === client.user.id ? 'GarryCoin Bot' : `<@${lenderId}>`;

      // Show loan terms with accept/reject buttons
      const termsMessage = `💰 **Loan Terms Preview**\n\n` +
        `**Principal:** ${amount} GC\n` +
        `**Daily Interest Rate:** ${adjustedInterestRate.toFixed(2)}% (compounding)\n` +
        `**Loan Period:** ${loanPeriodDays.toFixed(4)} days\n` +
        `**Interest Charge:** ${interestAmount} GC\n` +
        `**Total Due:** ${totalDue} GC\n` +
        `**Due Date:** ${dueDateString} EST\n` +
        `**Lender:** ${lenderName}\n` +
        `**Repayment Period:** ${repaymentPeriod}\n\n` +
        `💳 **Your Credit Score:** ${creditScore}\n` +
        `📊 **Risk Factors:**\n` +
        `• FGR Base Rate: ${rateResult.breakdown.fgrBaseRate.toFixed(2)}%\n` +
        `• Your Debt Ratio: ${(parseFloat(rateResult.breakdown.borrowerDebtRatio) * 100).toFixed(1)}%\n` +
        `• Lender Debt Ratio: ${(parseFloat(rateResult.breakdown.lenderDebtRatio) * 100).toFixed(1)}%\n` +
        `• Loan Size: ${(parseFloat(rateResult.breakdown.loanSizePercent) * 100).toFixed(1)}% of lender balance\n\n` +
        `*Interest compounds daily at ${adjustedInterestRate.toFixed(2)}% per day*\n\n` +
        `Do you want to accept this loan?`;

      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`loan_accept_${userId}_${lenderId}_${amount}_${adjustedInterestRate}`)
            .setLabel('✅ Accept Loan')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`loan_reject_${userId}`)
            .setLabel('❌ Reject Loan')
            .setStyle(ButtonStyle.Danger)
        );

      return {
        content: termsMessage,
        components: [row],
        ephemeral: false,
      };

    } catch (error) {
      structuredLog.loan('Error executing garryloan command', {
        userId: interaction?.member?.user?.id || 'unknown',
        error: error.message,
        stack: error.stack
      });

      return {
        content: '❌ An error occurred while processing your loan request. Please try again later.',
        ephemeral: true,
      };
    }
  }
};