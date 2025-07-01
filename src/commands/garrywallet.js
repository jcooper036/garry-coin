const { db, findOrCreateUser } = require('../db');

module.exports = {
  name: 'garrywallet',
  description: 'Displays the current contents of a user\'s wallet privately.',
  execute: async (interaction) => {
    const userId = interaction.member.user.id;

    try {
      const user = await findOrCreateUser(userId);
      return { content: `You have ${user.balance} GarryCoin.`, ephemeral: true };
    } catch (error) {
      console.error(`Error fetching wallet for user ${userId}:`, error);
      return { content: 'An error occurred while fetching your wallet. Please try again later.', ephemeral: true };
    }
  },
};