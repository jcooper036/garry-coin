const commands = require('../command_definitions');

module.exports = {
  name: 'garryhelp',
  async execute(interaction) {
    const helpMessage = commands.map(command => {
      let options = '';
      if (command.options) {
        options = command.options.map(option => `[${option.name}]`).join(' ');
      }
      return `**/${command.name}** ${options} - ${command.description}`;
    }).join('\n');

    return {
      content: helpMessage,
      ephemeral: true,
    };
  },
};