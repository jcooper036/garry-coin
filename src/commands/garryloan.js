const { InteractionResponseType } = require('discord-interactions');
const { 
  findOrCreateUser, 
  getUser, 
  calculateCreditScore, 
  createLoan, 
  checkDailyLoanLimit,
  getFGRPolicy
} = require('../db');
const { structuredLog } = require('../logger');

// Get current base interest rate from FGR or default to 5%
async function getBaseInterestRate() {
  try {
    const policy = await getFGRPolicy('base_interest_rate');
    return policy ? parseFloat(policy.policy_data.rate || 5.0) : 5.0;
  } catch (error) {
    structuredLog.loan('Error fetching base interest rate, using default', { error: error.message });
    return 5.0;
  }
}

// Adjust interest rate based on credit score
function adjustInterestRateForCredit(baseRate, creditScore) {
  if (creditScore >= 750) {
    return Math.max(0, baseRate - 1); // Excellent credit: -1%
  } else if (creditScore >= 650) {
    return baseRate; // Good credit: base rate
  } else if (creditScore >= 550) {
    return baseRate + 1; // Fair credit: +1%
  } else {
    return baseRate + 2; // Poor credit: +2%
  }
}

// Bot loan decision algorithm
function calculateBotLoanDecision(creditScore, amount, botBalance) {
  // Always approve small loans
  if (amount <= 10) {
    return { approved: true, reason: 'small_loan_auto_approved' };
  }

  // Never approve loans > 50% of bot wealth
  if (amount > botBalance * 0.5) {
    return { approved: false, reason: 'exceeds_bot_capacity' };
  }

  // Risk calculation based on credit score and loan size relative to bot wealth
  const creditScoreNormalized = (creditScore - 300) / 550; // 0-1 scale
  const loanSizeRatio = amount / botBalance;
  
  // Higher credit score = lower risk, smaller loan ratio = lower risk
  const riskScore = creditScoreNormalized * (1 - loanSizeRatio);
  const approvalThreshold = 0.3; // Minimum 30% approval chance
  
  const finalApprovalChance = Math.max(approvalThreshold, riskScore);
  const approved = Math.random() < finalApprovalChance;

  return {
    approved,
    reason: approved ? 'risk_assessment_approved' : 'risk_assessment_denied',
    riskScore,
    approvalChance: finalApprovalChance
  };
}

module.exports = {
  name: 'garryloan',
  async execute(interaction, client) {
    try {
      // Defer the reply to handle potential processing delays
      await interaction.deferReply({ ephemeral: true });

      const userId = interaction.user.id;
      const amount = interaction.options.getInteger('amount');
      const lenderUser = interaction.options.getUser('lender');
      const lenderId = lenderUser ? lenderUser.id : 'garry_bot';

      // Validate loan amount
      if (amount <= 0) {
        return await interaction.editReply({
          content: '❌ Loan amount must be greater than 0.',
        });
      }

      if (amount > 10000) {
        return await interaction.editReply({
          content: '❌ Loan amount cannot exceed 10,000 GC.',
        });
      }

      // Check daily loan limit
      const hasReachedDailyLimit = await checkDailyLoanLimit(userId);
      if (hasReachedDailyLimit) {
        return await interaction.editReply({
          content: "❌ You've already requested a loan today. Try again tomorrow.",
        });
      }

      // Ensure borrower exists in database
      await findOrCreateUser(userId);

      // Check if user is trying to loan to themselves
      if (lenderId === userId) {
        return await interaction.editReply({
          content: '❌ You cannot request a loan from yourself.',
        });
      }

      // Calculate borrower's credit score
      const creditScore = await calculateCreditScore(userId);
      const baseInterestRate = await getBaseInterestRate();
      const adjustedInterestRate = adjustInterestRateForCredit(baseInterestRate, creditScore);

      let loanApproved = false;
      let approvalReason = '';

      if (lenderId === 'garry_bot') {
        // Bot loan request
        const botUser = await getUser(client.user.id);
        const botBalance = botUser ? botUser.balance : 1000; // Default fallback

        const decision = calculateBotLoanDecision(creditScore, amount, botBalance);
        loanApproved = decision.approved;
        approvalReason = decision.reason;

        structuredLog.loan('Bot loan decision', {
          userId,
          amount,
          creditScore,
          botBalance,
          decision: decision.approved ? 'approved' : 'denied',
          reason: decision.reason,
          riskScore: decision.riskScore,
          approvalChance: decision.approvalChance
        });

        if (!loanApproved) {
          let denialMessage = '❌ **Loan Application Denied**\\n\\n';
          denialMessage += `**Credit Score:** ${creditScore}\\n`;
          denialMessage += `**Requested Amount:** ${amount} GC\\n`;
          
          if (decision.reason === 'exceeds_bot_capacity') {
            denialMessage += `**Reason:** Loan amount exceeds 50% of bot reserves\\n`;
            denialMessage += `**Max Available:** ${Math.floor(botBalance * 0.5)} GC`;
          } else {
            denialMessage += `**Reason:** Risk assessment indicates high default probability\\n`;
            denialMessage += `**Recommendation:** Build credit through gambling wins or maintain higher balance`;
          }

          return await interaction.editReply({
            content: denialMessage,
          });
        }
      } else {
        // User-to-user loan request (always approve if lender has funds)
        const lender = await getUser(lenderId);
        if (!lender || lender.balance < amount) {
          return await interaction.editReply({
            content: `❌ <@${lenderId}> doesn't have enough GarryCoins to fulfill this loan.`,
          });
        }
        loanApproved = true;
        approvalReason = 'user_loan_sufficient_funds';
      }

      // Create the loan
      const loanResult = await createLoan(userId, lenderId, amount, adjustedInterestRate);
      
      if (!loanResult.success) {
        let errorMessage = '❌ **Loan Request Failed**\\n\\n';
        
        if (loanResult.message === 'max_active_loans_exceeded') {
          errorMessage += 'You have reached the maximum number of active loans (10).\\n';
          errorMessage += 'Please wait for some loans to be paid off before requesting new ones.';
        } else {
          errorMessage += `Error: ${loanResult.message}`;
        }

        return await interaction.editReply({
          content: errorMessage,
        });
      }

      // Calculate loan details for display
      const interestAmount = Math.floor(amount * (adjustedInterestRate / 100));
      const totalDue = amount + interestAmount;
      const dueDate = new Date(loanResult.loan.due_date);
      const dueDateString = dueDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York'
      });

      // Success message
      let successMessage = '✅ **Loan Approved!**\\n\\n';
      successMessage += `**Loan ID:** #${loanResult.loan.id}\\n`;
      successMessage += `**Principal:** ${amount} GC\\n`;
      successMessage += `**Interest Rate:** ${adjustedInterestRate.toFixed(2)}%\\n`;
      successMessage += `**Interest Charge:** ${interestAmount} GC\\n`;
      successMessage += `**Total Due:** ${totalDue} GC\\n`;
      successMessage += `**Due Date:** ${dueDateString} EST\\n`;
      successMessage += `**Lender:** ${lenderId === 'garry_bot' ? 'GarryCoin Bot' : `<@${lenderId}>`}\\n\\n`;
      successMessage += `💳 **Your Credit Score:** ${creditScore}\\n\\n`;
      successMessage += `The loan amount has been deposited into your account. Payment will be automatically deducted in 3 days.`;

      return await interaction.editReply({
        content: successMessage,
      });

    } catch (error) {
      structuredLog.loan('Error executing garryloan command', {
        userId: interaction.user.id,
        error: error.message,
        stack: error.stack
      });

      const errorMessage = '❌ An error occurred while processing your loan request. Please try again later.';
      
      if (interaction.deferred) {
        return await interaction.editReply({ content: errorMessage });
      } else {
        return await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }
};