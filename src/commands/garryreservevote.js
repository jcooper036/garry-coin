const { castFGRVote, getFGRVotes, recordFGREvent } = require('../db');
const { structuredLog } = require('../logger');

module.exports = {
  name: 'garryreservevote',
  description: 'Vote on Federal GarryCoin Reserve monetary policy',
  ephemeral: false,

  async execute(interaction) {
    const userId = interaction.member.user.id;
    const options = interaction.data.options;
    const policy = options.find(opt => opt.name === 'policy').value;
    const vote = options.find(opt => opt.name === 'vote').value;

    try {
      structuredLog.info('Casting FGR vote', { userId, policy, vote });

      // Cast the vote (upsert)
      await castFGRVote(userId, policy, vote);

      // Get current vote tally
      const votes = await getFGRVotes(policy);
      const tallies = votes.reduce((acc, v) => {
        acc[v.vote_choice] = (acc[v.vote_choice] || 0) + 1;
        return acc;
      }, {});

      // Record the voting event
      await recordFGREvent('vote', `User voted ${vote} on ${policy} policy`, {
        policy,
        vote,
        userId,
        currentTally: tallies
      });

      const policyNames = {
        hawkish: 'Hawkish Rate Stance',
        dovish: 'Dovish Stimulus',
        qt: 'Quantitative Tightening',
        emergency: 'Emergency Accommodation'
      };

      const response = `**Federal GarryCoin Reserve - Voting Recorded**

**Policy:** ${policyNames[policy]}
**Your Vote:** ${vote.charAt(0).toUpperCase() + vote.slice(1)}

**Current Tally:**
Support: ${tallies.yes || 0}
Oppose: ${tallies.no || 0} 
Abstain: ${tallies.abstain || 0}

*The Board of Governors will consider this input in their next monetary policy decision. Market participants should expect elevated volatility in GarryCoin derivative instruments.*`;

      structuredLog.info('FGR vote completed successfully', { userId, policy, vote });
      
      return {
        content: response,
        ephemeral: true
      };

    } catch (error) {
      structuredLog.error('Error in garryreservevote command', error, { userId, policy, vote });
      
      return {
        content: 'The Federal Reserve\'s voting systems are experiencing technical difficulties. Please try again later.',
        ephemeral: true
      };
    }
  }
};