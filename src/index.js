require('dotenv').config();
const express = require('express');
const { verifyKeyMiddleware } = require('discord-interactions');
const { InteractionType, InteractionResponseType, InteractionResponseFlags } = require('discord-interactions');
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { findOrCreateUser, transfer, updateUserActivity, getUser, getActiveBusGame, addPlayerToBusGame, createBusGame, cancelBusGame, grant, getBusGamePlayers, createWavelengthGame, getActiveWavelengthGame, addPlayerToWavelengthGame, getWavelengthPlayers, getWavelengthGame, updateWavelengthPlayer } = require('./db');
const { startJoinTimer, handlePlayerChoice, buildGameEmbed } = require('./commands/games/ride_the_bus/ridethebus_helpers');
const { endWavelengthGame, startWavelengthTimer } = require('./commands/games/wavelength/wavelength_helpers');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;


const PUBLIC_KEY = process.env.PUBLIC_KEY;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.login(process.env.DISCORD_TOKEN);

const commands = new Map();
const commandsPath = path.join(__dirname, 'commands');
const wavelengthScales = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/wavelength_scales.json'), 'utf8'));
console.log(`[index.js] Loaded ${wavelengthScales.length} wavelength scales.`);

// --- Wavelength Scale Validation ---
const createWavelengthPlaceholder = (scale) => `e.g., a word for "${scale.topic}"`;

for (const scale of wavelengthScales) {
  const placeholder = createWavelengthPlaceholder(scale);
  if (placeholder.length > 100) {
    throw new Error(`Wavelength scale placeholder is too long for discord modal creation (${placeholder.length}/100): "${placeholder}" . You need to go shorten these inputs at the source`);
  }
}
console.log('[index.js] All wavelength scales passed validation.');
// ------------------------------------

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
          embeds: response.embeds,
          components: response.components,
        };

        const messageResponse = await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messagePayload),
        });

        const messageData = await messageResponse.json();

        const game = await createBusGame(response.hostId, channel_id, messageData.id, response.wager);
        startJoinTimer(game.id, client, response.boardingTime);
        return;
      }

      if (response.type === 'modal') {
        return res.send({
          type: InteractionResponseType.MODAL,
          data: response.modal.toJSON(),
        });
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
    if (custom_id.startsWith('wl_')) {
      const parts = custom_id.split('_');
      const action = parts[1];

      if (action === 'host') {
        const [_, __, setup, wagerStr, showPlayerGuessesStr, scaleIndexStr, targetNumberStr] = parts;
        const wager = parseInt(wagerStr, 10);
        const showPlayerGuesses = showPlayerGuessesStr === 'true';
        const scaleIndex = parseInt(scaleIndexStr, 10);
        const targetNumber = parseInt(targetNumberStr, 10);
        const scale = wavelengthScales[scaleIndex];

        const modal = new ModalBuilder()
          .setCustomId(`wavelength_setup_${wager}_${showPlayerGuesses}_${scaleIndex}_${targetNumber}`)
          .setTitle('Wavelength - Enter Your Word');

        const hostWordInput = new TextInputBuilder()
          .setCustomId('host_word')
          .setLabel(`Your secret number is ${targetNumber}. What's your word?`)
          .setPlaceholder(createWavelengthPlaceholder(scale))
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const actionRow = new ActionRowBuilder().addComponents(hostWordInput);
        modal.addComponents(actionRow);

        return res.send({
          type: InteractionResponseType.MODAL,
          data: modal.toJSON(),
        });
      }

      const gameId = parts.length > 2 ? parseInt(parts[2], 10) : null;

      if (action === 'join') {
        const game = await getActiveWavelengthGame();
        if (!game) return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "This game is no longer active.", flags: InteractionResponseFlags.EPHEMERAL } });

        if (playerId === game.host_user_id) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: "You are the host of this game and cannot join.",
              flags: InteractionResponseFlags.EPHEMERAL,
            },
          });
        }

        const playerUser = await getUser(playerId);
        if (!playerUser || playerUser.balance < game.wager) {
          return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `You're too poor for this game. You only have ${playerUser?.balance || 0} GC.`, flags: InteractionResponseFlags.EPHEMERAL } });
        }

        const transferResult = await transfer(playerId, client.user.id, game.wager, 'wavelength_wager');
        if (!transferResult.success) {
          return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `Failed to pay fare: ${transferResult.message}`, flags: InteractionResponseFlags.EPHEMERAL } });
        }

        const addResult = await addPlayerToWavelengthGame(game.id, playerId);
        if (!addResult.success && addResult.message === 'already_joined') {
          await grant(playerId, game.wager, 'wavelength_refund_duplicate_join');
          return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "You are already in the game!", flags: InteractionResponseFlags.EPHEMERAL } });
        }

        const players = await getWavelengthPlayers(game.id);
        const originalEmbed = req.body.message.embeds[0];
        originalEmbed.fields[2].value = players.length.toString();
        originalEmbed.fields[3].value = players.map(p => `<@${p.user_id}>`).join('\n') || 'No one yet!';

        const guessButtons1 = new ActionRowBuilder();
        for (let i = -3; i <= 0; i++) {
          guessButtons1.addComponents(
            new ButtonBuilder()
              .setCustomId(`wl_guess_${game.id}_${i}`)
              .setLabel(i.toString())
              .setStyle(ButtonStyle.Primary)
          );
        }

        const guessButtons2 = new ActionRowBuilder();
        for (let i = 1; i <= 3; i++) {
          guessButtons2.addComponents(
            new ButtonBuilder()
              .setCustomId(`wl_guess_${game.id}_${i}`)
              .setLabel(i.toString())
              .setStyle(ButtonStyle.Primary)
          );
        }

        res.send({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });

        await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [originalEmbed] }),
        });

        await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: "You've joined the game! Make your guess:",
            components: [guessButtons1, guessButtons2],
            flags: InteractionResponseFlags.EPHEMERAL
          }),
        });

        return;
      }

      if (action === 'guess') {
        const guess = parseInt(parts[3], 10);
        await updateWavelengthPlayer(gameId, playerId, { guess: guess, player_status: 'guessed' });

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Your guess (${guess}) is locked in.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }

      if (action === 'reveal') {
        const game = await getActiveWavelengthGame();
        if (!game) return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "This game is no longer active.", flags: InteractionResponseFlags.EPHEMERAL } });

        if (game.host_user_id !== playerId) {
          return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "Only the host can reveal the answer.", flags: InteractionResponseFlags.EPHEMERAL } });
        }

        await endWavelengthGame(game.id, client);

        return res.send({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });
      }
    }
    if (custom_id.startsWith('rtb_')) {
      const parts = custom_id.split('_');
      const action = parts[1];

      if (action === 'join' || action === 'cancel') {
        // This logic is for the initial buttons that don't have a gameId.
        const game = await getActiveBusGame();
        if (!game) return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "This game is no longer active.", flags: InteractionResponseFlags.EPHEMERAL } });

        if (action === 'join') {
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

          const gameEmbed = await buildGameEmbed(game.id);

          // Acknowledge interaction, then edit message
          res.send({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });
          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [gameEmbed], components: req.body.message.components }),
          });
          return;
        } else { // cancel
          if (game.host_user_id !== playerId) return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "Only the host can cancel the bus.", flags: InteractionResponseFlags.EPHEMERAL } });

          await cancelBusGame(game.id);
          const players = await getBusGamePlayers(game.id);
          for (const player of players) {
            await grant(player.user_id, game.wager, 'rtb_refund_cancel');
          }

          const cancelledEmbed = await buildGameEmbed(game.id);

          res.send({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });
          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [cancelledEmbed], components: [] }),
          });
          return;
        }
      } else if (action === 'choice' || action === 'cashout') {
        const gameId = parseInt(parts[2], 10);
        const response = await handlePlayerChoice(req.body, client);
        if (response.update_message) {
          const gameEmbed = await buildGameEmbed(gameId);

          // We can't send an ephemeral and update the message in one go.
          // So we'll update the message, and then send a new ephemeral follow-up.
          res.send({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });

          await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [gameEmbed], components: req.body.message.components }),
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
      }
    }
    if (custom_id.startsWith('heist_')) {
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
        // --- Heist Success Formula Constants ---
        const HEIST_BASE_CHANCE = 0.50;
        const HEIST_MAX_CHANCE = 0.95;
        const HEIST_MIN_CHANCE = 0.20;
        const HEIST_ACTIVITY_MAX_PENALTY = 0.5; // Max penalty for activity (e.g., 0.15 for 15%)
        const HEIST_ACTIVITY_MAX_DAYS = 3;     // Days until activity penalty is zero
        const HEIST_WEALTH_MODIFIER_SCALE = 0.45; // Scales the wealth bonus/penalty

        const thief = await getUser(playerId);
        const target = await getUser(targetId);

        if (!thief) {
          return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "Could not find your user data.", flags: InteractionResponseFlags.EPHEMERAL } });
        }
        if (!target) {
          return res.send({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "Could not find your target's user data.", flags: InteractionResponseFlags.EPHEMERAL } });
        }

        const thiefBalance = thief.balance;
        const targetBalance = target.balance;

        // 1. Calculate Activity Adjustment
        let activityAdjustment = 0;
        const botId = client.user.id;
        if (targetId !== botId && target.last_active_at) {
          const daysInactive = (new Date() - new Date(target.last_active_at)) / (1000 * 60 * 60 * 24);
          if (daysInactive < HEIST_ACTIVITY_MAX_DAYS) {
            const penalty = HEIST_ACTIVITY_MAX_PENALTY * ((HEIST_ACTIVITY_MAX_DAYS - daysInactive) / HEIST_ACTIVITY_MAX_DAYS);
            activityAdjustment = -penalty;
          }
        }

        // 2. Calculate Wealth Adjustment
        let wealthRatio = 1;
        if (targetBalance === 0) {
          wealthRatio = (thiefBalance > 0) ? Infinity : 1;
        } else {
          wealthRatio = thiefBalance / targetBalance;
        }
        // Use Math.max to prevent log10 from returning -Infinity if wealthRatio is 0
        const wealthAdjustment = -HEIST_WEALTH_MODIFIER_SCALE * Math.log10(Math.max(Number.MIN_VALUE, wealthRatio));

        // 3. Calculate Final Success Chance
        let finalSuccessChance = HEIST_BASE_CHANCE + activityAdjustment + wealthAdjustment;

        // Clamp the final chance
        finalSuccessChance = Math.max(HEIST_MIN_CHANCE, Math.min(HEIST_MAX_CHANCE, finalSuccessChance));

        console.log(`[Heist Calculation] by ${playerId} on ${targetId} for ${wager}GC:\n` +
          `  - Balances: Thief=${thiefBalance}, Target=${targetBalance}\n` +
          `  - Adjustments: Activity=${activityAdjustment.toFixed(4)}, Wealth=${wealthAdjustment.toFixed(4)}\n` +
          `  - Final Chance: ${finalSuccessChance.toFixed(4)}`);

        const win = Math.random() < finalSuccessChance;
        let resultMessage = '';
        const formatPercent = (n) => `${(n * 100).toFixed(1)}%`;

        const explanation = `\n\n**Calculation:**\n` +
          `> ${formatPercent(HEIST_BASE_CHANCE)} (Base Chance)\n` +
          `> ${formatPercent(activityAdjustment)} (Target Activity)\n` +
          `> ${formatPercent(wealthAdjustment)} (Wealth Ratio)\n` +
          `> **Total: ${formatPercent(finalSuccessChance)} Chance**`;

        if (win) {
          await transfer(targetId, playerId, wager, 'heist_win');
          resultMessage = `Success! <@${playerId}> pulled off the heist, stealing ${wager} GarryCoins from <@${targetId}>!` + explanation;
        } else {
          await transfer(playerId, targetId, wager, 'heist_loss');
          resultMessage = `LMAO <@${playerId}> got caught and failed the heist, losing ${wager} GarryCoins to <@${targetId}>.` + explanation;
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
  }

  if (type === InteractionType.MODAL_SUBMIT) {
    const { custom_id, components } = data;
    const { user } = req.body.member;
    const { channel_id } = req.body;

    if (custom_id.startsWith('wavelength_setup')) {
      console.log('Modal Submit - custom_id:', custom_id);
      console.log('Modal Submit - components:', JSON.stringify(components));
      const [_, __, wagerStr, showPlayerGuessesStr, scaleIndexStr, targetNumberStr] = custom_id.split('_');
      const wager = parseInt(wagerStr, 10);
      const showPlayerGuesses = showPlayerGuessesStr === 'true';
      const scaleIndex = parseInt(scaleIndexStr, 10);
      const targetNumber = parseInt(targetNumberStr, 10);

      const hostWord = components[0].components[0].value;
      const scale = wavelengthScales[scaleIndex];

      console.log(`[Wavelength Modal Submit] Creating game with:
        - Host: ${user.id}
        - Wager: ${wager}
        - Show Guesses: ${showPlayerGuesses}
        - Scale: ${scale.scale_left} <-> ${scale.scale_right}
        - Target Number: ${targetNumber}
        - Host Word: ${hostWord}`);

      res.send({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });

      const transferResult = await transfer(user.id, client.user.id, wager, 'wavelength_wager');
      if (!transferResult.success) {
        await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: "Failed to transfer wager. The game could not be started." }),
        });
        return;
      }

      const initialEmbed = {
        color: 0x0099ff,
        title: '🌊 Wavelength 🌊',
        description: `A new game has been started by <@${user.id}>!\n**Wager:** ${wager} GC`,
        fields: [
          { name: 'Scale', value: `**(-3) ${scale.scale_left}** ↔️ **${scale.scale_right} (3)**` },
          { name: 'Host\'s Word', value: `**${hostWord}**` },
          { name: 'Players Joined', value: '1', inline: true },
          { name: 'Players', value: 'No one yet!', inline: true }
        ],
        footer: { text: 'Game will end in 10 minutes.' }
      };

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('wl_join')
            .setLabel('Join Game')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('wl_reveal')
            .setLabel('Reveal Answer')
            .setStyle(ButtonStyle.Danger),
        );

      const messageResponse = await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [initialEmbed], components: [row] }),
      });
      const messageData = await messageResponse.json();

      const game = await createWavelengthGame(user.id, channel_id, messageData.id, wager, scale.scale_left, scale.scale_right, targetNumber, hostWord, showPlayerGuesses);

      startWavelengthTimer(game.id, client);

      return;
    }
  }
}
);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
