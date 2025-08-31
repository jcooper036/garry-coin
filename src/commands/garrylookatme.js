const { db, findOrCreateUser } = require('../db');
const { formatApproxGC } = require('../number_formatter');

module.exports = {
  name: 'garrylookatme',
  async execute(interaction) {
    const userId = interaction.member.user.id;
    const user = await findOrCreateUser(userId);
    const balance = user ? user.balance : 0;

    return {
      content: `<@${userId}> has ${formatApproxGC(balance)} GarryCoin in their wallet.`,
      ephemeral: false,
    };
  },
};