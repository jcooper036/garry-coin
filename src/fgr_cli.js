#!/usr/bin/env node

const { FGREvents } = require('./fgr_events');
const { getEconomicMetrics, recordFGREvent } = require('./db');
const { llmService } = require('./llm_service');

/**
 * Federal GarryCoin Reserve CLI for testing and manual operations
 */
class FGRCLI {
  constructor() {
    // Mock Discord client for CLI usage
    this.mockClient = {
      guilds: {
        cache: new Map() // Empty for CLI testing
      }
    };

    this.fgrEvents = new FGREvents(this.mockClient);
  }

  async run() {
    const command = process.argv[2];
    const args = process.argv.slice(3);

    console.log('🏛️  Federal GarryCoin Reserve CLI\n');

    try {
      switch (command) {
        case 'quantitative-easing':
        case 'qe':
          await this.testQuantitativeEasing();
          break;

        case 'buyback':
          await this.testBuyback();
          break;

        case 'announcement':
          await this.testAnnouncement();
          break;

        case 'metrics':
          await this.showMetrics();
          break;

        case 'test-llm':
          await this.testLLM();
          break;

        case 'test-all':
          await this.runAllTests();
          break;

        default:
          this.showHelp();
      }
    } catch (error) {
      console.error('❌ CLI Error:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }

  async testQuantitativeEasing() {
    console.log('📈 Testing Quantitative Easing...\n');

    // Override broadcast to just log instead of sending to Discord
    const originalBroadcast = this.fgrEvents.broadcastAnnouncement;
    this.fgrEvents.broadcastAnnouncement = async (message) => {
      console.log('📢 QE Announcement:');
      console.log('='.repeat(50));
      console.log(message);
      console.log('='.repeat(50) + '\n');
    };

    await this.fgrEvents.triggerQE();

    // Restore original method
    this.fgrEvents.broadcastAnnouncement = originalBroadcast;

    console.log('✅ Quantitative Easing test completed');
  }

  async testBuyback() {
    console.log('💰 Testing Strategic Buyback...\n');

    const originalBroadcast = this.fgrEvents.broadcastAnnouncement;
    this.fgrEvents.broadcastAnnouncement = async (message) => {
      console.log('📢 Buyback Announcement:');
      console.log('='.repeat(50));
      console.log(message);
      console.log('='.repeat(50) + '\n');
    };

    await this.fgrEvents.triggerBuyback();

    this.fgrEvents.broadcastAnnouncement = originalBroadcast;

    console.log('✅ Strategic Buyback test completed');
  }

  async testAnnouncement() {
    console.log('📝 Testing Policy Announcement...\n');

    const originalBroadcast = this.fgrEvents.broadcastAnnouncement;
    this.fgrEvents.broadcastAnnouncement = async (message) => {
      console.log('📢 Policy Announcement:');
      console.log('='.repeat(50));
      console.log(message);
      console.log('='.repeat(50) + '\n');
    };

    await this.fgrEvents.triggerAnnouncement();

    this.fgrEvents.broadcastAnnouncement = originalBroadcast;

    console.log('✅ Policy Announcement test completed');
  }

  async showMetrics() {
    console.log('📊 Current Economic Metrics...\n');

    const metrics = await getEconomicMetrics();

    console.log('User Metrics:');
    console.log(`  Total Users: ${metrics.userMetrics.totalUsers}`);
    console.log(`  Active Users: ${metrics.userMetrics.activeUsers}`);
    console.log(`  Activity Rate: ${metrics.userMetrics.activityRate.toFixed(1)}%\n`);

    console.log('Economic Metrics:');
    console.log(`  Total Supply: ${metrics.economicMetrics.totalSupply.toLocaleString()} GC`);
    console.log(`  24hr Transactions: ${metrics.economicMetrics.recentTransactionVolume}`);
    console.log(`  Weekly Gambling Volume: ${metrics.economicMetrics.weeklyGamblingVolume.toLocaleString()} GC\n`);

    console.log('Game Metrics:');
    console.log(`  Heist: ${metrics.gameMetrics.heist.games} games, ${metrics.gameMetrics.heist.winRate.toFixed(1)}% win rate`);
    console.log(`  RTB: ${metrics.gameMetrics.rtb.games} games, ${metrics.gameMetrics.rtb.avgWager.toFixed(1)} GC avg wager`);
    console.log(`  Wavelength: ${metrics.gameMetrics.wavelength.games} games, ${metrics.gameMetrics.wavelength.avgWager.toFixed(1)} GC avg wager\n`);
  }

  async testLLM() {
    console.log('🤖 Testing LLM Integration...\n');

    // Detailed availability check
    const { available, checks } = await llmService.checkAvailability();

    console.log('Diagnostics:');
    console.log(`  API Key Set: ${checks.apiKeySet ? '✅' : '❌'}`);
    console.log(`  API Key Valid: ${checks.apiKeyValid ? '✅' : '❌'}`);
    console.log(`  Can Initialize: ${checks.canInitialize ? '✅' : '❌'}`);
    console.log(`  Can Call API: ${checks.canCallAPI ? '✅' : '❌'}`);

    if (checks.error) {
      console.log(`  Error: ${checks.error}`);
    }

    console.log(`\nOverall Status: ${available ? '✅ Available' : '❌ Not Available'}\n`);

    if (!available) {
      console.log('⚠️  Get an API key from: https://aistudio.google.com/app/apikey');
      console.log('⚠️  Skipping LLM generation test\n');
      return;
    }

    // Test direct generation (no fallbacks in CLI)
    const testPrompt = 'You are the GarryCoin Federal Reserve Chairman. Explain in 1 sentence why GarryCoin interest rates must remain elevated due to an uptick in gambling rates. Use nonsensical economic jargon and logic.';

    console.log('Testing LLM generation...');
    console.log(`Prompt: "${testPrompt}"\n`);

    try {
      const result = await llmService.generateText(testPrompt);
      console.log('✅ LLM Response:');
      console.log(`"${result}"\n`);
    } catch (error) {
      console.log('❌ LLM Generation failed:', error.message);
      throw error; // Let it error out in CLI
    }
  }

  async runAllTests() {
    console.log('🚀 Running all FGR tests...\n');

    await this.showMetrics();
    console.log('---\n');

    await this.testLLM();
    console.log('---\n');

    await this.testAnnouncement();
    console.log('---\n');

    await this.testQuantitativeEasing();
    console.log('---\n');

    await this.testBuyback();

    console.log('🎉 All tests completed!');
  }

  showHelp() {
    console.log(`Usage: node src/fgr_cli.js <command>

Commands:
  quantitative-easing, qe  Test QE event generation
  buyback                  Test strategic buyback event
  announcement             Test policy announcement
  metrics                  Show current economic metrics
  test-llm                 Test LLM integration
  test-all                 Run all tests

Examples:
  node src/fgr_cli.js qe
  node src/fgr_cli.js metrics
  node src/fgr_cli.js test-all

Environment:
  Make sure you have GEMINI_API_KEY set for LLM testing:
  export GEMINI_API_KEY=your_api_key_here
  Get an API key from: https://aistudio.google.com/app/apikey
`);
  }
}

// Run CLI if called directly
if (require.main === module) {
  const cli = new FGRCLI();
  cli.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { FGRCLI };