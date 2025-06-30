const commands = [
  {
    name: 'test',
    description: 'Should return "Hello from the GarryCoin community"'
  },
  {
    name: 'garryhelp',
    description: 'Gives the user the commands they can use.'
  },
  {
    name: 'garrywallet',
    description: 'Displays the current contents of a user\'s wallet privately.'
  },
  {
    name: 'garrylookatme',
    description: 'Displays the current contents of a user\'s wallet publicly.'
  },
  {
    name: 'garrymakeitrain',
    description: 'Gives one GarryCoin to every other member of the server.'
  },
  {
    name: 'garryhistory',
    description: 'Shows the last 10 transactions from the user.'
  },
  {
    name: 'garryreceipt',
    description: 'Shows the last 10 transactions of a specific user.'
  },
  {
    name: 'garrysend',
    description: 'Sends X GarryCoins to the target user publicly.'
  },
];

module.exports = commands;