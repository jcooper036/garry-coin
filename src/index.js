require('dotenv').config();
const express = require('express');
const { verifyKeyMiddleware } = require('discord-interactions');
const { InteractionType, InteractionResponseType, InteractionResponseFlags } = require('discord-interactions');
const { Client, GatewayIntentBits } = require('discord.js');
const { findOrCreateUser, transfer, updateUserActivity, getUser, getActiveBusGame, addPlayerToBusGame, createBusGame, cancelBusGame, grant, getBusGamePlayers } = require('./db');
const { startJoinTimer, handlePlayerChoice, handleHostAction, buildGameMessage } = require('./commands/games/ride_the_bus/ridethebus_helpers');
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
  const fetch = (await import('node-fetch')).default;
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

      // Special post-processing for Ride the Bus game creation
      if (response.postProcess === 'create_bus_game') {
        // Instead of res.send, we manually handle the interaction response
        // to get the message ID for game creation.

        // Acknowledge the interaction to prevent timeout.
        res.send({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });

        const transferResult = await transfer(response.hostId, client.user.id, response.wager, 'rtb_wager');
        if (!transferResult.success) {
          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: "Failed to transfer wager. The bus drove off." }),
          });
          return;
        }

        const messagePayload = {
          content: response.content,
          components: response.components,
        };

        const messageResponse = await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messagePayload),
        });

        const messageData = await messageResponse.json();

        const game = await createBusGame(response.hostId, channel_id, messageData.id, response.wager);
        startJoinTimer(game.id, client);
        return;
      }


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
    const playerId = req.body.member.user.id;

    // --- Ride the Bus Button Handling ---
    if (custom_id.startsWith('rtb_')) {
      const [_, action, ...params] = custom_id.split('_');
      const gameIdStr = params[params.length - 1];
      const gameId = parseInt(gameIdStr, 10);

      if (action === 'join') {
        const game = await getActiveBusGame();
        if (!game) return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "This game is no longer active.", flags: InteractionResponseFlags.EPHEMERAL } });

        const playerUser = await getUser(playerId);
        if (!playerUser || playerUser.balance < game.wager) {
          return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `You're too poor for this bus. You only have ${playerUser?.balance || 0} GC.`, flags: InteractionResponseFlags.EPHEMERAL } });
        }

        const transferResult = await transfer(playerId, client.user.id, game.wager, 'rtb_wager');
        if (!transferResult.success) {
          return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `Failed to pay fare: ${transferResult.message}`, flags: InteractionResponseFlags.EPHEMERAL } });
        }

        const addResult = await addPlayerToBusGame(game.id, playerId);
        if (!addResult.success && addResult.message === 'already_joined') {
          // Refund the user if they somehow clicked join twice
          await grant(playerId, game.wager, 'rtb_refund_duplicate_join');
          return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "You are already on the bus!", flags: InteractionResponseFlags.EPHEMERAL } });
        }

        const messageContent = await buildGameMessage(game.id);

        // Acknowledge interaction, then edit message
        res.send({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });
        await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: messageContent, components: req.body.message.components }),
        });

        return;
      } else if (action === 'cancel') {
        const game = await getActiveBusGame();
        if (game.host_user_id !== playerId) return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "Only the host can cancel the bus.", flags: InteractionResponseFlags.EPHEMERAL } });

        await cancelBusGame(game.id);
        const players = await getBusGamePlayers(game.id);
        for (const player of players) {
          await grant(player.user_id, game.wager, 'rtb_refund_cancel');
        }

        res.send({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });
        await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: `The bus was cancelled by the host. All fares have been refunded.`, components: [] }),
        });
        return;
      } else if (action === 'choice' || action === 'cash_out') {
        const response = await handlePlayerChoice(req.body, client);
        if (response.update_message) {
          const messageContent = await buildGameMessage(gameId);

          // We can't send an ephemeral and update the message in one go.
          // So we'll update the message, and then send a new ephemeral follow-up.
          res.send({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });

          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: messageContent, components: req.body.message.components }),
          });

          // Send the ephemeral follow-up
          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: response.content, flags: 64 }), // 64 for EPHEMERAL
          });

        } else {
          return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { ...response, flags: InteractionResponseFlags.EPHEMERAL } });
        }
        return;
      } else if (action === 'reveal') {
        const response = await handleHostAction(req.body, client);
        if (response) {
          return res.send(response);
        }
        // if no response, it means the interaction was deferred and is being handled.
      }
    }


    // --- Heist Button Handling ---
    const [game, choice, wagerStr, targetId] = custom_id.split('_');
    const wager = parseInt(wagerStr, 10);

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
