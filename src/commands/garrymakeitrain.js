const { db, findOrCreateUser, transfer } = require('../db');

module.exports = {
  name: 'garrymakeitrain',
  async execute(interaction, client) {
    const senderId = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const guild = await client.guilds.fetch(guildId);
    const members = await guild.members.fetch();
    const sender = await findOrCreateUser(senderId);

    if (!sender || sender.balance < members.size - 1) {
      return {
        content: 'You do not have enough GarryCoin to make it rain on everyone in the server.',
        ephemeral: true,
      };
    }

    // Return special flag to trigger deferred processing
    return {
      postProcess: 'make_it_rain',
      senderId,
      members,
      ephemeral: false,
    };
  },
};