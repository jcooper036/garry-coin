const db = require('../db');

module.exports = {
  name: 'garrywallet',
  description: 'Displays the current contents of a user\'s wallet privately.',
  execute: async (interaction) => {
    const userId = interaction.member.user.id;

    try {
      const result = await db.raw('SELECT balance FROM users WHERE user_id = ?', [userId]);
      if (result.rows.length > 0) {
        const balance = result.rows[0].balance;
        return { content: `You have ${balance} GarryCoin.`, ephemeral: true };
      } else {
        return { content: 'You don\'t have any GarryCoin yet. Your wallet is empty.', ephemeral: true };
      }
    } catch (error) {
      console.error(`Error fetching wallet for user ${userId}:`, error);
      return { content: 'An error occurred while fetching your wallet. Please try again later.', ephemeral: true };
    }
  },
};