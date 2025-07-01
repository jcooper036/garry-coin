const { findOrCreateUser } = require('../db');

module.exports = {
  name: 'garrylookatme',
  description: 'Displays the current contents of a user\'s wallet publicly.',
  execute: async (interaction) => {
    const userId = interaction.member.user.id;

    try {
      const user = await findOrCreateUser(userId);
      return { content: `<@${userId}> has ${user.balance} GarryCoin.`, ephemeral: false };
    } catch (error) {
      console.error(`Error fetching wallet for user ${userId}:`, error);
      return { content: 'An error occurred while fetching your wallet. Please try again later.', ephemeral: true };
    }
  },
};