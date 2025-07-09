require('dotenv').config();
const express = require('express');
const { verifyKeyMiddleware } = require('discord-interactions');
const { InteractionType, InteractionResponseType, InteractionResponseFlags } = require('discord-interactions');
const { Client, GatewayIntentBits } = require('discord.js');
const { findOrCreateUser, transfer, updateUserActivity } = require('./db');
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
    const [game, choice, playerId, wagerStr] = custom_id.split('_');
    const wager = parseInt(wagerStr, 10);
    const clickerId = req.body.member.user.id;
    console.log(game, wager)
    if (clickerId !== playerId) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "This isn't your heist! Start your own with `/heist`.",
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    if (game === 'garryheist') {
      const wires = ['red', 'blue', 'green'];
      const winningWire = wires[Math.floor(Math.random() * wires.length)];
      const botId = process.env.APP_ID;
      let resultMessage = '';

      if (choice === winningWire) {
        const payout = wager * 2;
        await transfer(botId, playerId, payout, 'heist_win');
        resultMessage = `Success! <@${playerId}> cut the ${choice} wire and cracked the vault, stealing ${payout} GarryCoins!`
      } else {
        await transfer(playerId, botId, wager, 'heist_loss');
        resultMessage = `LMAO <@${playerId}> cut the wrong wire. The correct wire was ${winningWire}. They lost ${wager} GarryCoins.`
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
