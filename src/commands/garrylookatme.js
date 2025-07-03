const { db, findOrCreateUser } = require('../db');

module.exports = {
  name: 'garrylookatme',
  async execute(interaction) {
    const userId = interaction.member.user.id;
    const user = await findOrCreateUser(userId);
    const balance = user ? user.balance : 0;
    const displayName = interaction.member.displayName;

    return {
      content: `${displayName} has ${balance} GarryCoin in their wallet.`,
      ephemeral: false,
    };
  },
};