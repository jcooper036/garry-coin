const { db, findOrCreateUser } = require('../db');

module.exports = {
  name: 'garrylookatyou',
  async execute(interaction) {
    const targetUserId = interaction.data.options[0].value;
    const targetUser = interaction.data.resolved.users[targetUserId];
    const user = await findOrCreateUser(targetUserId);
    const balance = user ? user.balance : 0;

    return {
      content: `${targetUser.username} has ${balance} GarryCoin in their wallet.`,
      ephemeral: false,
    };
  },
};