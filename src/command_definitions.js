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
  },
  {
    name: 'heist',
    description: 'Attempt to steal GarryCoins from another user or the bot.',
    options: [
      {
        name: 'amount',
        description: 'The amount of GarryCoins to wager.',
        type: 4, // INTEGER type
        required: true,
      },
      {
        name: 'user',
        description: 'The user to heist from (defaults to the bot).',
        type: 6, // USER type
        required: false,
      },
    ],
  },
  {
    name: 'garryridethebus',
    description: 'Start a game of Ride the Bus.',
    options: [
      {
        name: 'wager',
        description: 'The amount of GarryCoins to wager.',
        type: 4, // INTEGER type
        required: true,
      },
      {
        name: 'boarding_time',
        description: 'The time in seconds for players to join the bus (default: 30).',
        type: 4, // INTEGER type
        required: false,
      },
    ],
  },
  {
    name: 'garrywavelength',
    description: 'Start a game of Wavelength.',
    options: [
      {
        name: 'wager',
        description: 'The amount of GarryCoins to wager.',
        type: 4, // INTEGER type
        required: true,
      },
      {
        name: 'show_player_guesses',
        description: 'Show player guesses to everyone (default: false).',
        type: 5, // BOOLEAN type
        required: false,
      },
    ],
  },
  {
    name: 'garrywavelengthhelp',
    description: 'Explains how to play the Wavelength game.',
  },
  {
    name: 'garryridethebushelp',
    description: 'Explains how to play the Ride the Bus game.',
  },
  {
    name: 'garrygamblingstats',
    description: 'View detailed gambling statistics for yourself or another user.',
    options: [
      {
        name: 'user',
        description: 'The user to view gambling stats for (defaults to yourself).',
        type: 6, // USER type
        required: false,
      },
    ],
  },
  {
    name: 'garrygamblingboard',
    description: 'View gambling leaderboards for the server.',
    options: [
      {
        name: 'type',
        description: 'The type of leaderboard to display.',
        type: 3, // STRING type
        required: false,
        choices: [
          {
            name: 'Profit/Loss',
            value: 'profit'
          },
          {
            name: 'Games Played',
            value: 'volume'
          },
          {
            name: 'Win Rate',
            value: 'winrate'
          }
        ]
      }
    ]
  },
  {
    name: 'garryreservevote',
    description: 'Vote on Federal GarryCoin Reserve monetary policy.',
    options: [
      {
        name: 'policy',
        description: 'Policy to vote on.',
        type: 3, // STRING type
        required: true,
        choices: [
          {
            name: 'Hawkish Rate Stance - Tighten monetary policy',
            value: 'hawkish'
          },
          {
            name: 'Dovish Stimulus - Expand monetary policy',
            value: 'dovish'
          },
          {
            name: 'Quantitative Tightening - Reduce market liquidity',
            value: 'qt'
          },
          {
            name: 'Emergency Accommodation - Crisis response measures',
            value: 'emergency'
          }
        ]
      },
      {
        name: 'vote',
        description: 'Your vote.',
        type: 3, // STRING type
        required: true,
        choices: [
          {
            name: 'Support',
            value: 'yes'
          },
          {
            name: 'Oppose',
            value: 'no'
          },
          {
            name: 'Abstain',
            value: 'abstain'
          }
        ]
      }
    ]
  },
  {
    name: 'garryreservereport',
    description: 'View the Federal GarryCoin Reserve economic analysis report.'
  }
];

module.exports = commands;