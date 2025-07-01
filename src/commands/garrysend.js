const { transfer } = require('../../src/db');

module.exports = {
  name: 'garrysend',
  description: 'Sends GarryCoins to another user.',
  options: [
    {
      name: 'target_user',
      description: 'The user to send GarryCoins to.',
      type: 6, // USER type
      required: true,
    },
    {
      name: 'amount',
      description: 'The amount of GarryCoins to send.',
      type: 4, // INTEGER type
      required: true,
    },
  ],
  execute: async (interaction) => {
    const senderId = interaction.member.user.id;
    const receiverId = interaction.data.options.find(opt => opt.name === 'target_user').value;
    const amount = interaction.data.options.find(opt => opt.name === 'amount').value;
    console.log(`senderId:${senderId},recieverId:${receiverId},amount${amount}`);
    if (senderId === receiverId) {
      return { content: 'You cannot send GarryCoins to yourself.', ephemeral: true };
    }

    const result = await transfer(senderId, receiverId, amount, 'user_to_user_send');

    if (result.success) {
      return { content: `Successfully sent ${amount} GarryCoins to <@${receiverId}>.`, ephemeral: true };
    } else {
      if (result.message === 'insufficient_funds') {
        return { content: 'You do not have enough GarryCoins to make this transfer.', ephemeral: true };
      } else {
        return { content: `Transfer failed: ${result.message}`, ephemeral: true };
      }
    }
  },
};
