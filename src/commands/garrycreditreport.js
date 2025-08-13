const { 
  findOrCreateUser, 
  getUser, 
  calculateCreditScore, 
  getUserLoans,
  getLoanHistory,
  getGamblingStats
} = require('../db');
const { structuredLog } = require('../logger');

module.exports = {
  name: 'garrycreditreport',
  async execute(interaction, client) {
    try {
      const userId = interaction.member.user.id;
      const targetOption = interaction.data.options?.find(opt => opt.name === 'user');
      const targetUserId = targetOption?.value || userId;

      // For complex credit report processing, use postProcess pattern
      return {
        postProcess: 'generate_credit_report',
        requesterId: userId,
        targetUserId,
        ephemeral: true,
      };

    } catch (error) {
      structuredLog.loan('Error executing garrycreditreport command', {
        userId: interaction?.member?.user?.id || 'unknown',
        error: error.message,
        stack: error.stack
      });

      return {
        content: '❌ An error occurred while generating the credit report. Please try again later.',
        ephemeral: true,
      };
    }
  }
};