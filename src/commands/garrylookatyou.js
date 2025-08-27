const { db, findOrCreateUser } = require('../db');
const { formatApproxGC } = require('../number_formatter');

module.exports = {
  name: 'garrylookatyou',
  async execute(interaction) {
    const targetUserId = interaction.data.options[0].value;
    const user = await findOrCreateUser(targetUserId);
    const balance = user ? user.balance : 0;

    return {
      content: `<@${targetUserId}> has ${formatApproxGC(balance)} GarryCoin in their wallet.`,
      ephemeral: false,
    };
  },
};