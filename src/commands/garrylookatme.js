module.exports = {
  name: 'garrylookatme',
  description: 'Displays the current contents of a user\'s wallet publicly.',
  execute: () => {
    return { content: 'This command will display your current GarryCoin balance publicly.', ephemeral: false };
  },
};