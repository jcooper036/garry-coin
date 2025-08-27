const { findOrCreateUser, transfer } = require('../db');
const { formatExactGC } = require('../number_formatter');

module.exports = {
  name: 'garrysend',
  async execute(interaction) {
    const senderId = interaction.member.user.id;
    const receiverId = interaction.data.options[0].value;
    const amount = interaction.data.options[1].value;

    if (senderId === receiverId) {
      return {
        content: 'You cannot send GarryCoin to yourself.',
        ephemeral: true,
      };
    }

    await findOrCreateUser(senderId);
    await findOrCreateUser(receiverId);

    const result = await transfer(senderId, receiverId, amount, 'user_to_user_slash_command');

    if (result.success) {
      return {
        content: `Successfully sent ${formatExactGC(amount)} GarryCoin to <@${receiverId}>.`,
        ephemeral: true,
      };
    } else {
      return {
        content: `Failed to send GarryCoin: ${result.message}`,
        ephemeral: true,
      };
    }
  },
};