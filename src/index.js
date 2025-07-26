require('dotenv').config();
const express = require('express');
const { verifyKeyMiddleware } = require('discord-interactions');
const { InteractionType, InteractionResponseType, InteractionResponseFlags } = require('discord-interactions');
const { Client, GatewayIntentBits } = require('discord.js');
const { findOrCreateUser, transfer, updateUserActivity, getUser } = require('./db');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_KEY = process.env.PUBLIC_KEY;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.login(process.env.DISCORD_TOKEN);

const commands = new Map();
const commandsPath = path.join(__dirname, 'commands');

const loadCommands = (dir) => {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      loadCommands(fullPath);
    } else if (file.name.endsWith('.js')) {
      const command = require(fullPath);
      if (command.name && command.execute) {
        commands.set(command.name, command);
      } else {
        console.log(`[WARNING] The command at ${fullPath} is missing a required "name" or "execute" property.`);
      }
    }
  }
};

loadCommands(commandsPath);

app.get('/', (req, res) => {
  res.sendStatus(200);
});

app.post('/interactions', verifyKeyMiddleware(PUBLIC_KEY), async (req, res) => {
  const { type, id, data } = req.body;

  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name, options } = data;
    const { user } = req.body.member;
    const { channel_id, guild_id, channel } = req.body;
    try {
      await updateUserActivity(user.id);
    } catch (error) {
      console.error(`Failed to update activity for ${user.id}:`, error);
    }
    console.log(`Command received: ${name}`);
    console.log(`User: ${user.id} (${user.username}) (${user.global_name})`);
    console.log(`Channel: ${channel_id} (${channel.name}) Guild:${guild_id}`);

    // Ensure user exists in the database
    try {
      await findOrCreateUser(user.id);
    } catch (error) {
      console.error(`Error checking/adding user ${user.id} to database:`, error);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'An internal error occurred. Please try again later.',
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    if (name === 'test') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'Hello from the GarryCoin community',
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    if (commands.has(name)) {
      const command = commands.get(name);
      const response = await command.execute(req.body, client);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: response.content,
          flags: response.ephemeral ? InteractionResponseFlags.EPHEMERAL : 0,
          components: response.components || [],
        },
      });
    }
  }

  if (type === InteractionType.MESSAGE_COMPONENT) {
    const { custom_id } = data;
    const [game, choice, wagerStr, targetId] = custom_id.split('_');
    const wager = parseInt(wagerStr, 10);
    const playerId = req.body.member.user.id;

    // The original interaction contains the ID of the user who initiated the command.
    // We check to make sure the person clicking the button is the one who started the heist.
    if (req.body.message.interaction.user.id !== playerId) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "This isn't your heist! Start your own with `/heist`.",
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    if (game === 'heist') {
      let successChance = 0.5; // Default 50% chance for the bot
      const botId = client.user.id;

      if (targetId !== botId) {
        const targetUser = await getUser(targetId);
        if (targetUser && targetUser.last_active_at) {
          const daysInactive = (new Date() - new Date(targetUser.last_active_at)) / (1000 * 60 * 60 * 24);

          const minChance = 0.33;
          const maxChance = 0.90;
          const minDays = 2;
          const maxDays = 14;

          if (daysInactive <= minDays) {
            successChance = minChance;
          } else if (daysInactive >= maxDays) {
            successChance = maxChance;
          } else {
            const slope = (maxChance - minChance) / (maxDays - minDays);
            successChance = minChance + (slope * (daysInactive - minDays));
          }
        }
      }

      const win = Math.random() < successChance;
      let resultMessage = '';

      if (win) {
        await transfer(targetId, playerId, wager, 'heist_win');
        resultMessage = `Success! <@${playerId}> cut the ${choice} wire and pulled off the heist, stealing ${wager} GarryCoins from <@${targetId}>! (Chance: ${Math.round(successChance * 100)}%)`;
      } else {
        await transfer(playerId, targetId, wager, 'heist_loss');
        resultMessage = `LMAO <@${playerId}> cut the wrong wire and got caught, losing ${wager} GarryCoins to <@${targetId}>`;
      }

      // Disable buttons on the original message
      const originalMessage = req.body.message;
      const disabledComponents = originalMessage.components.map(row => {
        row.components.forEach(component => component.disabled = true);
        return row;
      });

      return res.send({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          content: resultMessage,
          components: disabledComponents,
        },
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
