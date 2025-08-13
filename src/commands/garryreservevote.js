const { SlashCommandBuilder } = require('discord.js');
const { castFGRVote, getFGRVotes, recordFGREvent } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('garryreservevote')
    .setDescription('Vote on Federal GarryCoin Reserve monetary policy')
    .addStringOption(option =>
      option.setName('policy')
        .setDescription('Policy to vote on')
        .setRequired(true)
        .addChoices(
          { name: 'Hawkish Rate Stance - Tighten monetary policy', value: 'hawkish' },
          { name: 'Dovish Stimulus - Expand monetary policy', value: 'dovish' },
          { name: 'Quantitative Tightening - Reduce market liquidity', value: 'qt' },
          { name: 'Emergency Accommodation - Crisis response measures', value: 'emergency' }
        ))
    .addStringOption(option =>
      option.setName('vote')
        .setDescription('Your vote')
        .setRequired(true)
        .addChoices(
          { name: 'Support', value: 'yes' },
          { name: 'Oppose', value: 'no' },
          { name: 'Abstain', value: 'abstain' }
        )),

  async execute(interaction) {
    const userId = interaction.user.id;
    const policy = interaction.options.getString('policy');
    const vote = interaction.options.getString('vote');

    try {
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

      await interaction.reply({
        content: response,
        ephemeral: false
      });

    } catch (error) {
      console.error('Error in garryreservevote:', error);
      await interaction.reply({
        content: 'The Federal Reserve\'s voting systems are experiencing technical difficulties. Please try again later.',
        ephemeral: true
      });
    }
  }
};