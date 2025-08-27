const { db, findOrCreateUser } = require('../db');
const { formatApproxGC } = require('../number_formatter');

module.exports = {
  name: 'garrywallet',
  async execute(interaction) {
    const userId = interaction.member.user.id;
    const user = await findOrCreateUser(userId);
    const balance = user ? user.balance : 0;

    return {
      content: `Your wallet balance is ${formatApproxGC(balance)} GarryCoin.`,
      ephemeral: true,
    };
  },
};