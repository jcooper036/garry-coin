const allCommands = require('../command_definitions.js');

module.exports = {
  name: 'garryhelp',
  description: 'Gives the user the commands they can use.',
  execute: () => {
    let helpMessage = 'Here are the available GarryCoin commands:\n\n';
    allCommands.forEach(command => {
      helpMessage += `**/${command.name}**: ${command.description}\n`;
    });
    return { content: helpMessage, ephemeral: true };
  },
};