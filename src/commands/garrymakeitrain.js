const { db, findOrCreateUser, transfer } = require('../db');
const { formatExactGC, formatApproxGC } = require('../number_formatter');

function getWeatherMessage(amount, userId, memberCount) {
  const totalCoins = amount * memberCount;
  let weather, emoji, intensity;

  if (amount === 1) {
    weather = 'summoned a light drizzle';
    emoji = '🌦️';
    intensity = 'gentle';
  } else if (amount < 10) {
    weather = 'called down a steady rainfall';
    emoji = '🌧️';
    intensity = 'refreshing';
  } else if (amount < 100) {
    weather = 'unleashed a fierce storm';
    emoji = '⛈️';
    intensity = 'powerful';
  } else if (amount < 1000) {
    weather = 'summoned the monsoon';
    emoji = '🌊';
    intensity = 'overwhelming';
  } else if (amount < 10000) {
    weather = 'triggered a biblical flood';
    emoji = '🌊💫';
    intensity = 'legendary';
  } else if (amount < 100000) {
    weather = 'opened the gates of the heavens';
    emoji = '☄️💥';
    intensity = 'divine';
  } else {
    weather = 'shattered reality with cosmic precipitation';
    emoji = '🌌⚡';
    intensity = 'apocalyptic';
  }

  return {
    announcement: `**${emoji} ${intensity.toUpperCase()} WEATHER EVENT ${emoji}**\n\n<@${userId}> ${weather}! Everyone gets **${formatExactGC(amount)} GC**!\n\n*Total distributed: ${formatExactGC(totalCoins)} GC to ${memberCount} members*`,
    emoji,
    intensity
  };
}

module.exports = {
  name: 'garrymakeitrain',
  async execute(interaction, client) {
    const senderId = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const amount = interaction.data.options?.find(opt => opt.name === 'amount')?.value || 1;
    
    const guild = await client.guilds.fetch(guildId);
    const members = await guild.members.fetch();
    const sender = await findOrCreateUser(senderId);
    
    // Filter out bots and the sender
    const eligibleMembers = members.filter(member => !member.user.bot && member.user.id !== senderId);
    const totalCost = amount * eligibleMembers.size;

    if (!sender || sender.balance < totalCost) {
      return {
        content: `You need **${formatExactGC(totalCost)} GC** to make it rain **${formatExactGC(amount)} GC** on **${eligibleMembers.size}** server members. You only have **${formatApproxGC(sender?.balance || 0)} GC**.`,
        ephemeral: true,
      };
    }

    // Return special flag to trigger deferred processing
    return {
      postProcess: 'make_it_rain',
      senderId,
      amount,
      members: eligibleMembers,
      weatherMessage: getWeatherMessage(amount, senderId, eligibleMembers.size),
      ephemeral: false,
    };
  },
};