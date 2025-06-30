module.exports = {
  name: 'garrymakeitrain',
  description: 'Gives one GarryCoin to every other member of the server.',
  execute: () => {
    return { content: 'This command will distribute GarryCoins to other server members.', ephemeral: false };
  },
};