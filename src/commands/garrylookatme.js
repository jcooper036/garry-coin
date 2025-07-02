const { db, findOrCreateUser } = require('../db');

module.exports = {
  name: 'garrylookatme',
  async execute(interaction) {
    const userId = interaction.member.user.id;
    const user = await findOrCreateUser(userId);
    const balance = user ? user.balance : 0;

    return {
      content: `Your wallet balance is ${balance} GarryCoin.`,
      ephemeral: false,
    };
  },
};