module.exports = {
  name: 'garrysend',
  description: 'Sends X GarryCoins to the target user publicly.',
  execute: () => {
    return { content: 'This command will send GarryCoins to another user.', ephemeral: false };
  },
};