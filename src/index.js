require('dotenv').config();
const express = require('express');
const { verifyKeyMiddleware } = require('discord-interactions');
const { InteractionType, InteractionResponseType, InteractionResponseFlags } = require('discord-interactions');
const { Client, GatewayIntentBits } = require('discord.js');
const { db, findOrCreateUser } = require('./db');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_KEY = process.env.PUBLIC_KEY;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.login(process.env.DISCORD_TOKEN);

const commands = new Map();
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(__dirname, 'commands', file));
  commands.set(command.name, command);
}

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
        },
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
