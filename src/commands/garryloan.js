const { 
  findOrCreateUser, 
  getUser, 
  calculateCreditScore, 
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
      const lenderId = lenderOption?.value || 'garry_bot';

      // Validate loan amount
      if (!amount || amount <= 0) {
        return {
          content: '❌ Loan amount must be greater than 0.',
          ephemeral: true,
        };
      }

      if (amount > 10000) {
        return {
          content: '❌ Loan amount cannot exceed 10,000 GC.',
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
          const lenderName = lenderId === 'garry_bot' ? 'GarryCoin Bot' : `<@${lenderId}>`;
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

      // For complex loan processing, use postProcess pattern
      return {
        postProcess: 'process_loan',
        userId,
        amount,
        lenderId,
        ephemeral: true,
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