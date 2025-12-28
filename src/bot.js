require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { transfer, grant, updateUserActivity, getRandomActiveUser } = require('./db');
const { handleWordleMessage } = require('./wordle_handler');
const { structuredLog } = require('./logger');
// const { FGREvents } = require('./fgr_events'); // DEPRECATED! To be removed with FGREvent Remove TODO item
const { LoanScheduler } = require('./loan_scheduler');
const connectionWarmer = require('./connection_warmer');

const WORDLE_BOT_IDS = (process.env.WORDLE_BOT_IDS || '').split(',');

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
  structuredLog.bot('Bot logged in', { tag: client.user.tag });
  
  // Start connection warming to prevent stale connection timeouts
  connectionWarmer.start();
  
  // DEPRECATED! To be removed with FGREvent Remove TODO item
  // const fgrEvents = new FGREvents(client);
  // fgrEvents.start(); 
  
  // Initialize Loan Payment Scheduler
  const loanScheduler = new LoanScheduler(client);
  loanScheduler.start();
});

client.on('messageReactionAdd', async (reaction, user) => {
  // When a reaction is received, check if the structure is partial
  if (reaction.partial) {
    // If the message this reaction belongs to was removed, the fetching might result in an API error, which should be handled
    try {
      await reaction.fetch();
    } catch (error) {
      structuredLog.error('Failed to fetch reaction message', {
        error: error.message,
        category: 'bot'
      });
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
      structuredLog.transfer('Self-transfer attempt blocked', {
        userId: senderId,
        method: 'emoji'
      });
      // Optionally, send an ephemeral message to the user who reacted
      return;
    }

    structuredLog.transfer('Emoji transfer attempt', {
      amount,
      fromUserId: senderId,
      toUserId: receiverId
    });
    const result = await transfer(senderId, receiverId, amount, 'user_to_user_emoji');

    if (result.success) {
      structuredLog.transfer('Emoji transfer successful', {
        amount,
        fromUserId: senderId,
        toUserId: receiverId
      });
      // Optionally, send a confirmation message in the channel or to the sender
    } else {
      structuredLog.transfer('Emoji transfer failed', {
        amount,
        fromUserId: senderId,
        toUserId: receiverId,
        reason: result.message
      });
      // In a real scenario, you might want to send an ephemeral message to the sender
      // For now, we'll just log it.
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

// Cooldown logic
let lastGrantedTime = 0;
const COOLDOWN_PERIOD = 60 * 1000; // 1 minute

async function processWordleMessage(message) {
  if (!message.content || !message.content.includes('Your group is on a')) {
    return false;
  }

  if (WORDLE_BOT_IDS.includes(message.author.id)) {
    // Legitimate Wordle message
    try {
      await handleWordleMessage(message);
    } catch (error) {
      structuredLog.error('Error handling Wordle message', {
        error: error.message,
        category: 'wordle'
      });
    }
  } else {
    // Illegitimate Wordle message (spoof attempt)
    const senderId = message.author.id;
    const botId = client.user.id;

    // Don't let the bot punish itself if something is misconfigured
    if (senderId === botId) return true;

    structuredLog.wordle('Wordle spoofing attempt detected', {
      userId: senderId
    });

    // Publicly shame the user
    await message.channel.send(`Hey <@${senderId}>, nice try. Only the real Wordle bot can post results. I'm taking 10 GarryCoins for that.`);

    // Penalize the user
    const result = await transfer(senderId, botId, 10, 'attempted_hacking');
    if (result.success) {
      structuredLog.wordle('Spoofing penalty applied', {
        userId: senderId,
        penalty: 10
      });
    } else {
      structuredLog.wordle('Spoofing penalty failed', {
        userId: senderId,
        reason: result.message
      });
      if (result.message === 'insufficient_funds') {
        await message.channel.send(`...but you're too poor, so I'll let it slide. For now.`);
      }
    }
  }
  return true; // Wordle message (legit or spoof) was processed
}

client.on('messageCreate', async message => {
  const isWordle = await processWordleMessage(message);
  if (isWordle) return;

  if (message.author.bot) return; // Ignore other bots

  // Update user's activity timestamp
  try {
    await updateUserActivity(message.author.id);
  } catch (error) {
    structuredLog.error('Failed to update user activity', {
      userId: message.author.id,
      error: error.message,
      category: 'database'
    });
  }

  const now = Date.now();
  if (now - lastGrantedTime < COOLDOWN_PERIOD) {
    return; // Still on cooldown
  }

  try {
    const randomUser = await getRandomActiveUser(14); // Get a random user active in the last 14 days

    if (randomUser) {
      lastGrantedTime = now;
      const result = await grant(randomUser.user_id, 1, 'lottery_grant');
      if (result.success) {
        structuredLog.lottery('Lottery grant successful', {
          userId: randomUser.user_id,
          amount: 1
        });
      } else {
        structuredLog.lottery('Lottery grant failed', {
          userId: randomUser.user_id,
          reason: result.message
        });
      }
    } else {
      structuredLog.lottery('No active users for lottery');
    }
  } catch (error) {
    structuredLog.error('Lottery system error', {
      error: error.message,
      category: 'lottery'
    });
  }
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
  // Ensure the message is fully fetched
  if (newMessage.partial) {
    try {
      await newMessage.fetch();
    } catch (error) {
      structuredLog.error('Failed to fetch partial message on update', {
        error: error.message,
        category: 'bot'
      });
      return;
    }
  }
  await processWordleMessage(newMessage);
});

