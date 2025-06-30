module.exports = {
  name: 'garrywallet',
  description: 'Displays the current contents of a user\'s wallet privately.',
  execute: () => {
    return { content: 'This command will display your current GarryCoin balance privately.', ephemeral: true };
  },
};