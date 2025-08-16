const { 
  findOrCreateUser, 
  getUserLoans,
  calculateCurrentAmountDue
} = require('../db');
const { structuredLog } = require('../logger');

module.exports = {
  name: 'garryrepayloan',
  async execute(interaction, client) {
    try {
      const userId = interaction.member.user.id;
      const loanIdOption = interaction.data.options?.find(opt => opt.name === 'loan_id');
      const targetLoanId = loanIdOption?.value;

      await findOrCreateUser(userId);

      // Get user's active loans
      const activeLoans = await getUserLoans(userId, 'active');
      
      if (activeLoans.length === 0) {
        return {
          content: '💰 You have no active loans to repay.',
          ephemeral: true,
        };
      }

      // If specific loan ID provided, handle direct repayment
      if (targetLoanId) {
        const loan = activeLoans.find(l => l.id === parseInt(targetLoanId));
        if (!loan) {
          return {
            content: `❌ Loan #${targetLoanId} not found or not active.`,
            ephemeral: true,
          };
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

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        
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

        return {
          content: confirmationMessage,
          components: [row],
          ephemeral: true,
        };
      }

      // Show loan selection interface
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      
      let selectionMessage = `💰 **Your Active Loans**\n\n`;
      const rows = [];
      
      for (let i = 0; i < activeLoans.length; i++) {
        const loan = activeLoans[i];
        const amountDue = calculateCurrentAmountDue(loan);
        const now = new Date();
        const hoursElapsed = (now - new Date(loan.created_at)) / (1000 * 60 * 60);
        const isEarlyRepayment = hoursElapsed < 24;
        
        const lenderName = loan.lender_user_id === client.user.id ? 'GarryCoin Bot' : `<@${loan.lender_user_id}>`;
        const earlyLabel = isEarlyRepayment ? ` ⚡ ${hoursElapsed.toFixed(1)}h old` : '';
        
        selectionMessage += `🏦 **Loan #${loan.id}** from ${lenderName}${earlyLabel}\n`;
        selectionMessage += `├ Principal: ${loan.amount} GC | Interest: ${loan.interest_rate}%/day\n`;
        selectionMessage += `├ Amount Due: ${amountDue} GC\n`;
        selectionMessage += `└ Created: ${new Date(loan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}\n\n`;

        // Create button (5 buttons per row max)
        if (i % 5 === 0) {
          rows.push(new ActionRowBuilder());
        }
        
        const currentRow = rows[rows.length - 1];
        currentRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`repay_select_${loan.id}_${userId}`)
            .setLabel(`💸 Repay #${loan.id}`)
            .setStyle(ButtonStyle.Primary)
        );
      }

      return {
        content: selectionMessage,
        components: rows,
        ephemeral: true,
      };

    } catch (error) {
      structuredLog.loan('Error executing garryrepayloan command', {
        userId: interaction?.member?.user?.id || 'unknown',
        error: error.message,
        stack: error.stack
      });

      return {
        content: '❌ An error occurred while processing your repayment request. Please try again later.',
        ephemeral: true,
      };
    }
  }
};