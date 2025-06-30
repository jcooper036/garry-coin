module.exports = {
  name: 'garrywallet',
  description: 'Displays the current contents of a user\'s wallet privately.',
  execute: (interaction) => {
    // TODO: Implement database logic to fetch user balance
    const balance = 100; // Placeholder
    return { content: `You have ${balance} GarryCoin.`, ephemeral: true };
  },
};