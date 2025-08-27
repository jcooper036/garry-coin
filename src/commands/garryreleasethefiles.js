const {
  findOrCreateUser,
  transfer,
  createReleaseFilesCase,
  getDailyInvestigationLimit
} = require('../db');
const { llmService } = require('../llm_service');
const { structuredLog } = require('../logger');
const { releaseFilesInvestigator } = require('../release_files_investigator');
const { formatExactGC, formatApproxGC } = require('../number_formatter');

module.exports = {
  name: 'garryreleasethefiles',
  async execute(interaction) {
    const userId = interaction.member.user.id;
    
    // Extract options properly
    const options = interaction.data.options || [];
    const investigationTargetOption = options.find(opt => opt.name === 'investigation_target');
    const grievanceOption = options.find(opt => opt.name === 'grievance');
    const bribeOption = options.find(opt => opt.name === 'bribe');
    
    const investigationTarget = investigationTargetOption ? investigationTargetOption.value : null;
    const grievance = grievanceOption ? grievanceOption.value : null;
    const bribeAmount = bribeOption ? bribeOption.value : 0;

    if (!grievance || !investigationTarget) {
      return {
        content: '🚫 **ERROR:** You must provide both a grievance and an investigation target!',
        ephemeral: true
      };
    }

    try {
      // Check daily limit (like loans)
      const dailyCheck = await getDailyInvestigationLimit(userId);
      if (dailyCheck.blocked) {
        return {
          content: `🚫 **INVESTIGATION DENIED!** You've already filed a case today. Federal resources are limited, citizen.`,
          ephemeral: true
        };
      }

      // Handle bribe if provided
      if (bribeAmount > 0) {
        const user = await findOrCreateUser(userId);
        if (user.balance < bribeAmount) {
          return {
            content: `💰 **INSUFFICIENT BRIBE FUNDS!** You need ${formatExactGC(bribeAmount)} GC but only have ${formatApproxGC(user.balance)} GC. The investigation cannot be... influenced.`,
            ephemeral: true
          };
        }

        // Deduct bribe from user
        await transfer(userId, 'release_files_fund', bribeAmount, 'release_files_bribe');
        structuredLog.security('Release Files bribe paid', {
          userId,
          amount: bribeAmount,
          grievance: grievance.substring(0, 100)
        });
      }

      // Determine bias direction (bribe influences odds)
      const biasRoll = Math.random();
      const biasDirection = (bribeAmount > 0 && biasRoll < 0.75) || (bribeAmount === 0 && biasRoll < 0.5) ? 'for' : 'against';

      // Create the case in database
      const investigationCase = await createReleaseFilesCase(userId, investigationTarget, grievance, biasDirection, bribeAmount);

      structuredLog.security('Release Files case opened', {
        caseId: investigationCase.id,
        userId,
        investigationTarget,
        biasDirection,
        bribeAmount,
        grievance: grievance.substring(0, 100)
      });

      // Return special response for async processing
      return {
        postProcess: 'release_files_investigation',
        caseId: investigationCase.id,
        userId: userId,
        investigationTarget: investigationTarget,
        bribeAmount: bribeAmount,
        content: bribeAmount > 0
          ? `🔥 **BREAKING: FEDERAL INVESTIGATION LAUNCHED!** 🔥\n\n**Case #${investigationCase.id}** has been opened regarding: "${grievance}"\n\n*[CLASSIFIED NOTE: Bribe of ${bribeAmount} GC received and... noted]*\n\n**INVESTIGATION IN PROGRESS...**\n\nStand by for explosive findings.`
          : `🔥 **BREAKING: FEDERAL INVESTIGATION LAUNCHED!** 🔥\n\n**Case #${investigationCase.id}** has been opened regarding: "${grievance}"\n\n**INVESTIGATION IN PROGRESS...**\n\nStand by for findings.`
      };

    } catch (error) {
      structuredLog.error('Release Files command error', error, { userId, grievance: grievance?.substring(0, 100) });
      
      return {
        content: '🚫 **SYSTEM ERROR:** Federal databases are temporarily corrupted. Try again later.',
        ephemeral: true
      };
    }
  }
};