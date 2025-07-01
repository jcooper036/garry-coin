require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { transfer, grant } = require('./db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const GARRYCOIN_EMOJIS = {
  '1garrycoin': 1,
  '5garrycoin': 5,
  '10garrycoin': 10,
};

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageReactionAdd', async (reaction, user) => {
  // When a reaction is received, check if the structure is partial
  if (reaction.partial) {
    // If the message this reaction belongs to was removed, the fetching might result in an API error, which should be handled
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Something went wrong when fetching the message: ', error);
      // Return as `reaction.message.author` may be undefined/null
      return;
    }
  }

  const emojiName = reaction.emoji.name.toLowerCase();
  const amount = GARRYCOIN_EMOJIS[emojiName];

  // Only process if it's a GarryCoin emoji and the reaction is not from the bot itself
  if (amount && user.id !== client.user.id) {
    const senderId = user.id;
    const receiverId = reaction.message.author.id;

    // Prevent self-transfer
    if (senderId === receiverId) {
      console.log(`User ${senderId} tried to send GarryCoin to themselves via emoji.`);
      // Optionally, send an ephemeral message to the user who reacted
      return;
    }

    console.log(`Attempting to transfer ${amount} from ${senderId} to ${receiverId} via emoji.`);
    const result = await transfer(senderId, receiverId, amount, 'user_to_user_emoji');

    if (result.success) {
      console.log(`Successfully transferred ${amount} GarryCoin from ${senderId} to ${receiverId}.`);
      // Optionally, send a confirmation message in the channel or to the sender
    } else {
      console.log(`Failed to transfer ${amount} GarryCoin from ${senderId} to ${receiverId}: ${result.message}`);
      // In a real scenario, you might want to send an ephemeral message to the sender
      // For now, we'll just log it.
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

// Cooldown logic
let lastGrantedTime = 0;
const COOLDOWN_PERIOD = 60 * 1000; // 1 minute

client.on('messageCreate', async message => {
  if (message.author.bot) {
    console.log("No granting for bot")
    return;
  };

  const now = Date.now();
  if (now - lastGrantedTime < COOLDOWN_PERIOD) {
    console.log("Coin granting on cooldown")
    return;
  }

  try {
    const guild = message.guild;
    if (!guild) return;

    const members = await guild.members.fetch();
    const randomMember = members.random();

    if (randomMember) {
      lastGrantedTime = now;
      const result = await grant(randomMember.id, 1, 'lottery_grant');
      if (result.success) {
        console.log(`Successfully granted 1 GarryCoin to ${randomMember.user.tag}.`);
      } else {
        console.error(`Failed to grant GarryCoin to ${randomMember.user.tag}: ${result.message}`);
      }
    }
  } catch (error) {
    console.error('Error granting random GarryCoin:', error);
  }
});

