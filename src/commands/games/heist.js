

const { findOrCreateUser, getBalance } = require('../../db');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  name: 'heist',
  description: 'Attempt to steal GarryCoins from another user or the bot.',
  ephemeral: false,
  async execute(interaction, client) {
    const options = interaction.data.options;
    const wager = options.find(opt => opt.name === 'amount').value;
    const targetUserOption = options.find(opt => opt.name === 'user');
    const playerId = interaction.member.user.id;

    if (wager <= 0) {
      return {
        content: 'You must wager a positive amount of GarryCoins.',
        ephemeral: true,
      };
    }

    const player = await findOrCreateUser(playerId);
    if (player.balance < wager) {
      return {
        content: `You don\'t have enough GarryCoins for this heist. Your balance is ${player.balance}.`,
        ephemeral: true,
      };
    }

    let targetId;
    let targetName;

    if (targetUserOption) {
      targetId = targetUserOption.value;
      const targetUser = interaction.data.resolved.users[targetId];
      targetName = targetUser.global_name || targetUser.username;
      if (targetId === playerId) {
        return { content: "You can't heist yourself!", ephemeral: true };
      }
    } else {
      targetId = client.user.id;
      targetName = 'the bot';
    }

    const target = await findOrCreateUser(targetId);
    if (target.balance < wager) {
      return {
        content: `${targetName} is too poor for this heist. They only have ${target.balance} GarryCoins.`,
        ephemeral: true,
      };
    }

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`heist_red_${wager}_${targetId}`)
          .setLabel('Cut Red Wire')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`heist_blue_${wager}_${targetId}`)
          .setLabel('Cut Blue Wire')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`heist_green_${wager}_${targetId}`)
          .setLabel('Cut Green Wire')
          .setStyle(ButtonStyle.Success),
      );

    return {
      content: `<@${playerId}> is attempting a heist on ${targetName} for ${wager} GarryCoin!\nChoose a wire to cut. Choose wisely...`,
      components: [row],
    };
  },
};
