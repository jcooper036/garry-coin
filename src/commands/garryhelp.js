const commands = require('../command_definitions');

module.exports = {
  name: 'garryhelp',
  async execute(interaction) {
    const preamble = `GarryCoin is a project that adds Garry-based currency to a discord server. No need to do anything extra, you're on the Garry train now.\nEvery message to the channel sends a random member a GarryCoin.\nEveryone can use :1GarryCoin:, :5GarryCoin:, and :10GarryCoin: emojis to send users GarryCoin on their posts.`;

    const commandDescriptions = commands.map(command => {
      let options = '';
      if (command.options) {
        options = command.options.map(option => `[${option.name}]`).join(' ');
      }
      return `**/${command.name}** ${options} - ${command.description}`;
    }).join('\n');
    const helpMessageHeader = `GarryCoin has some bot commands for interaction as well:`
    const helpMessage = `${preamble}\n\n${helpMessageHeader}${commandDescriptions}`;

    return {
      content: helpMessage,
      ephemeral: true,
    };
  },
};