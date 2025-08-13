const { 
  getAllActiveLoans, 
  payLoan, 
  createFGRPolicy, 
  getFGRPolicy 
} = require('./db');
const { structuredLog } = require('./logger');

class LoanScheduler {
  constructor(client) {
    this.client = client;
    this.intervalId = null;
  }

  async start() {
    // Initialize base interest rate policy if it doesn't exist
    await this.initializeInterestRatePolicy();

    // Set check interval based on environment
    const environment = process.env.NODE_ENV || 'development';
    const checkInterval = environment === 'development' ? 30 * 1000 : 60 * 60 * 1000; // 30 seconds in dev, 1 hour in prod
    const intervalDescription = environment === 'development' ? '30 seconds' : '1 hour';

    // Start the scheduler
    this.intervalId = setInterval(async () => {
      await this.processLoanPayments();
    }, checkInterval);

    structuredLog.loan('Loan payment scheduler started', {
      environment,
      checkInterval: intervalDescription
    });
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      structuredLog.loan('Loan payment scheduler stopped');
    }
  }

  async initializeInterestRatePolicy() {
    try {
      const existingPolicy = await getFGRPolicy('base_interest_rate');
      if (!existingPolicy) {
        await createFGRPolicy('base_interest_rate', { rate: 5.0 });
        structuredLog.loan('Initialized base interest rate policy', { rate: 5.0 });
      }
    } catch (error) {
      structuredLog.loan('Error initializing interest rate policy', {
        error: error.message
      });
    }
  }

  async processLoanPayments() {
    try {
      const activeLoans = await getAllActiveLoans();
      const now = new Date();
      const dueLoans = activeLoans.filter(loan => new Date(loan.due_date) <= now);

      if (dueLoans.length === 0) {
        return;
      }

      structuredLog.loan('Processing due loan payments', {
        totalActiveLoans: activeLoans.length,
        dueLoans: dueLoans.length
      });

      const paymentResults = [];

      for (const loan of dueLoans) {
        try {
          const paymentResult = await payLoan(loan.id);
          paymentResults.push({
            loanId: loan.id,
            borrowerId: loan.borrower_user_id,
            ...paymentResult
          });

          // Send notification to borrower about loan resolution
          await this.notifyBorrower(loan, paymentResult);

        } catch (error) {
          structuredLog.loan('Error processing individual loan payment', {
            loanId: loan.id,
            borrowerId: loan.borrower_user_id,
            error: error.message
          });
        }
      }

      // Log summary of payment processing
      const successfulPayments = paymentResults.filter(r => r.success);
      const failedPayments = paymentResults.filter(r => !r.success);

      structuredLog.loan('Loan payment batch processed', {
        totalProcessed: paymentResults.length,
        successful: successfulPayments.length,
        failed: failedPayments.length,
        debtEvents: successfulPayments.filter(r => r.went_into_debt).length
      });

    } catch (error) {
      structuredLog.loan('Error in loan payment processing batch', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  async notifyBorrower(loan, paymentResult) {
    try {
      // Try to find the borrower in any guild where the bot is present
      let borrowerUser = null;
      
      for (const guild of this.client.guilds.cache.values()) {
        try {
          const member = await guild.members.fetch(loan.borrower_user_id);
          if (member) {
            borrowerUser = member.user;
            break;
          }
        } catch (err) {
          // User not in this guild, continue checking
          continue;
        }
      }

      if (!borrowerUser) {
        structuredLog.loan('Unable to notify borrower - user not found in any guild', {
          loanId: loan.id,
          borrowerId: loan.borrower_user_id
        });
        return;
      }

      // Try to send a DM to the borrower
      let notificationMessage = '';
      
      if (paymentResult.success) {
        if (paymentResult.status === 'paid') {
          notificationMessage = `✅ **Loan Payment Successful**\n\n`;
          notificationMessage += `Your loan #${loan.id} has been automatically paid in full.\n`;
          notificationMessage += `**Amount Paid:** ${paymentResult.paid_amount} GC\n`;
          
          if (paymentResult.went_into_debt) {
            notificationMessage += `**Note:** Payment put your account into debt. This will affect your credit score.\n`;
          }
          
          notificationMessage += `\nThank you for using GarryCoin lending services!`;
        } else {
          notificationMessage = `⚠️ **Loan Payment Incomplete**\n\n`;
          notificationMessage += `Your loan #${loan.id} payment was processed but you didn't have sufficient funds.\n`;
          notificationMessage += `**Partial Payment:** ${paymentResult.paid_amount} GC\n`;
          notificationMessage += `**Amount Still Owed:** ${paymentResult.total_due - paymentResult.paid_amount} GC\n`;
          notificationMessage += `**Status:** Defaulted\n\n`;
          notificationMessage += `This default will negatively impact your credit score.`;
        }
      } else {
        notificationMessage = `❌ **Loan Payment Failed**\n\n`;
        notificationMessage += `There was an error processing payment for loan #${loan.id}.\n`;
        notificationMessage += `Please contact support if this issue persists.`;
      }

      try {
        await borrowerUser.send(notificationMessage);
        structuredLog.loan('Borrower notification sent via DM', {
          loanId: loan.id,
          borrowerId: loan.borrower_user_id,
          paymentStatus: paymentResult.status
        });
      } catch (dmError) {
        // If DM fails, try to send in a guild channel
        let notificationSent = false;
        
        for (const guild of this.client.guilds.cache.values()) {
          try {
            const member = await guild.members.fetch(loan.borrower_user_id);
            if (member) {
              // Find a suitable channel (general, main, or first text channel)
              const channels = guild.channels.cache.filter(c => 
                c.type === 0 && c.permissionsFor(this.client.user).has(['SendMessages', 'ViewChannel'])
              );
              
              const targetChannel = channels.find(c => 
                c.name.includes('general') || c.name.includes('main')
              ) || channels.first();

              if (targetChannel) {
                await targetChannel.send(`<@${loan.borrower_user_id}> ${notificationMessage}`);
                notificationSent = true;
                
                structuredLog.loan('Borrower notification sent via guild channel', {
                  loanId: loan.id,
                  borrowerId: loan.borrower_user_id,
                  guildId: guild.id,
                  channelId: targetChannel.id
                });
                break;
              }
            }
          } catch (guildError) {
            continue;
          }
        }

        if (!notificationSent) {
          structuredLog.loan('Failed to notify borrower - no accessible channels', {
            loanId: loan.id,
            borrowerId: loan.borrower_user_id
          });
        }
      }

    } catch (error) {
      structuredLog.loan('Error sending borrower notification', {
        loanId: loan.id,
        borrowerId: loan.borrower_user_id,
        error: error.message
      });
    }
  }

  // Manual trigger for testing
  async triggerPaymentCheck() {
    structuredLog.loan('Manual loan payment check triggered');
    await this.processLoanPayments();
  }
}

module.exports = { LoanScheduler };