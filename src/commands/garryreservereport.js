const { getEconomicMetrics, getFGREvents } = require('../db');
const { llmService } = require('../llm_service');
const { FGRContext } = require('../fgr_context');
const { structuredLog } = require('../logger');

module.exports = {
  name: 'garryreservereport',
  description: 'View the Federal GarryCoin Reserve economic analysis report',
  ephemeral: false,

  async execute(interaction) {
    // Return postProcess flag to trigger deferred processing in index.js
    return {
      postProcess: 'garry_reserve_report',
      userId: interaction.member.user.id,
      ephemeral: false
    };
  }
};