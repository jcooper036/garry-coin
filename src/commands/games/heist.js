

const { findOrCreateUser } = require('../../db');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  name: 'garryheist',
  description: 'Attempt to steal GarryCoins from the bot in a game of chance.',
  async execute(interaction, client) {
    const wager = interaction.data.options.find(opt => opt.name === 'amount').value;
    const playerId = interaction.member.user.id;
    const botId = process.env.APP_ID;

    if (wager <= 0) {
      return {
        content: 'You must wager a positive amount of GarryCoins.',
        ephemeral: true,
      };
    }

    const player = await findOrCreateUser(playerId);
    const bot = await findOrCreateUser(botId);

    if (player.balance < wager) {
      return {
        content: `You don't have enough GarryCoins to make that wager. Your balance is ${player.balance}.`,
        ephemeral: true,
      };
    }

    const payout = wager * 2;
    if (bot.balance < payout) {
      return {
        content: `The vault is too empty for a heist of this size. The bot only has ${bot.balance} coins. Try a smaller amount.`,
        ephemeral: true,
      };
    }

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`garryheist_red_${playerId}_${wager}`)
          .setLabel('Cut Red Wire')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`garryheist_blue_${playerId}_${wager}`)
          .setLabel('Cut Blue Wire')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`garryheist_green_${playerId}_${wager}`)
          .setLabel('Cut Green Wire')
          .setStyle(ButtonStyle.Success),
      );

    return {
      content: `<@${playerId}> is attempting to steal from GarryCoinBot, wagering ${wager} GC
Cut the right wire, get the prize.`,
      components: [row],
      ephemeral: false,
    };
  },
};
