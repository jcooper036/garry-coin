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
    name: 'garrylookatyou',
    description: "Displays the current contents of a mentioned user's wallet publicly.",
    options: [
      {
        name: 'user',
        description: 'The user to view the wallet of.',
        type: 6, // USER type
        required: true,
      },
    ],
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
    description: 'Shows the last 10 transactions of a specific user.',
    options: [
      {
        name: 'user',
        description: 'The user to view the transaction history of.',
        type: 6, // USER type
        required: true,
      },
    ],
  },
  {
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
  },
  {
    name: 'garrybotrequest',
    description: 'Submit a bug report or feature request.',
    options: [
      {
        name: 'type',
        description: 'The type of request.',
        type: 3, // STRING type
        required: true,
        choices: [
          {
            name: 'Bug Report',
            value: 'bug'
          },
          {
            name: 'Feature Request',
            value: 'feature-request'
          }
        ]
      },
      {
        name: 'description',
        description: 'A detailed description of the bug or feature.',
        type: 3, // STRING type
        required: true
      }
    ]
  }
];

module.exports = commands;