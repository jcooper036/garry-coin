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

    let successCount = 0;
    for (const member of members.values()) {
      if (member.user.bot || member.user.id === senderId) continue;

      await findOrCreateUser(member.user.id);
      const result = await transfer(senderId, member.user.id, 1, 'user_to_user_make_it_rain');
      if (result.success) {
        successCount++;
      }
    }

    return {
      content: `You have made it rain on ${successCount} members of the server!`,
      ephemeral: false,
    };
  },
};