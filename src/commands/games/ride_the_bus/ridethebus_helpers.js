const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db, getBusGame, getBusGamePlayers, getBusGamePlayer, updateBusGame, updateBusGamePlayer, grant, transfer, transferThenGrant, transferThenGrantCapped } = require('../../../db');

const JOIN_PERIOD_SECONDS = 5;
const ROUND_TIMER_SECONDS = 15;
const activeTimers = new Map();

const Payouts = {
    1: 1,
    2: 2,
    3: 4,
    4: 100, // End of the line
};


const Phases = {
    joining: { next: 'color', duration: JOIN_PERIOD_SECONDS * 1000 },
    color: { next: 'higher_lower', name: 'Red or Black' },
    higher_lower: { next: 'inside_outside', name: 'Higher or Lower' },
    inside_outside: { next: 'suit', name: 'Inside or Outside' },
    suit: { next: null, name: 'Pick a Suit' },
};

const Suits = { hearts: '♥️', diamonds: '♦️', clubs: '♣️', spades: '♠️' };
const Ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function drawCard(deck, sequence = []) {
    let card, cardIndex, isDuplicate;
    do {
        cardIndex = Math.floor(Math.random() * deck.length);
        card = deck[cardIndex];
        isDuplicate = sequence.some(c => c.rank === card.rank && c.suit === card.suit);
    } while (isDuplicate);

    return deck.splice(cardIndex, 1)[0];
}

function createDeck() {
    const deck = [];
    for (const suit in Suits) {
        for (const rank of Ranks) {
            deck.push({ suit, rank, value: Ranks.indexOf(rank) });
        }
    }
    return deck;
}

async function startJoinTimer(gameId, client, boardingTime) {
    const duration = (boardingTime || 30) * 1000;
    console.log(`[Game ${gameId}] Starting join timer for ${boardingTime} seconds.`);
    setTimeout(async () => {
        const game = await getBusGame(gameId);
        // If the game was cancelled, do nothing.
        if (game.status !== 'waiting_for_players') return;

        const players = await getBusGamePlayers(gameId);
        if (players.length < 1) {
            // This case should ideally not be reachable, as the host is always a player.
            // But as a safeguard, we cancel if there are no players for some reason.
            console.log(`Game ${gameId} cancelled due to lack of players.`);
            await updateBusGame(game.id, { status: 'cancelled' });

            // Attempt to refund the host if they exist on the game object
            if (game.host_user_id) {
                await grant(game.host_user_id, game.wager, 'rtb_refund_no_players');
            }

            const channel = await client.channels.fetch(game.channel_id);
            const message = await channel.messages.fetch(game.message_id);
            await message.edit({
                content: `The bus to nowhere has been cancelled due to an error. The host has been refunded their **${game.wager} GC** fare.`,
                components: [],
            });
        } else {
            // Start the first phase
            await startNextPhase(game.id, 'color', client);
        }
    }, duration);
}

async function startNextPhase(gameId, phase, client) {
    console.log(`[Game ${gameId}] Starting phase: ${phase}`);
    const game = await getBusGame(gameId);
    if (!game) {
        console.error(`[Game ${gameId}] Could not find game to start next phase.`);
        return;
    }
    // This function NO LONGER draws a card. It only sets up the state for the next choice.
    await updateBusGame(gameId, {
        status: 'active',
        current_phase: phase,
    });

    const channel = await client.channels.fetch(game.channel_id);
    const message = await channel.messages.fetch(game.message_id);

    const gameEmbed = await buildGameEmbed(gameId);
    const messageComponents = buildGameButtons(phase, gameId);

    await message.edit({
        embeds: [gameEmbed],
        components: messageComponents,
    });

    startPhaseTimer(gameId, client);
}

function startPhaseTimer(gameId, client) {
    // Clear any existing timer for this game to be safe
    if (activeTimers.has(gameId)) {
        clearTimeout(activeTimers.get(gameId));
    }

    const timerId = setTimeout(() => {
        console.log(`[Game ${gameId}] Round timer expired. Processing results.`);
        processRoundResults(gameId, client);
        activeTimers.delete(gameId);
    }, ROUND_TIMER_SECONDS * 1000);

    activeTimers.set(gameId, timerId);
}

async function checkAndProcessRound(gameId, client) {
    const onBusPlayers = await db('bus_game_players').where({ game_id: gameId, player_status: 'on_bus' });
    const allChosen = onBusPlayers.every(p => p.current_choice !== null);

    if (onBusPlayers.length > 0 && allChosen) {
        console.log(`[Game ${gameId}] All players have made a choice. Processing results immediately.`);
        if (activeTimers.has(gameId)) {
            clearTimeout(activeTimers.get(gameId));
            activeTimers.delete(gameId);
        }
        await processRoundResults(gameId, client);
    }
}

async function buildGameEmbed(gameId) {
    const game = await getBusGame(gameId);
    const players = await getBusGamePlayers(gameId);

    const onBus = players.filter(p => p.player_status === 'on_bus');
    const cashedOut = players.filter(p => p.player_status === 'cashed_out');
    const dead = players.filter(p => p.player_status === 'dead_in_road');

    const onBusList = onBus.map(p => `<@${p.user_id}>`).join('\n') || 'None';
    const cashedOutList = cashedOut.map(p => `<@${p.user_id}> (${p.stops_rode} stop${p.stops_rode !== 1 ? 's' : ''})`).join('\n') || 'None';
    const deadList = dead.map(p => `<@${p.user_id}>`).join('\n') || 'None';

    const cardSequence = game.current_cards.map(c => `\`${c.rank}${Suits[c.suit]}\``).join(' ');

    let color = 0x0099ff; // Blue for active
    let title = "🚌 Ride the Bus";
    let description = `**Phase:** ${Phases[game.current_phase].name}\n**Sequence:** ${cardSequence}`;

    if (game.status === 'waiting_for_players') {
        color = 0xffc107; // Yellow for waiting
        description = `The bus is now boarding! Click "Join Bus" to get on.`;
    } else if (game.status === 'finished') {
        color = 0x28a745; // Green for success
        title = "✅ Bus Ride Finished";
    } else if (game.status === 'cancelled') {
        color = 0xdc3545; // Red for cancelled
        title = "❌ Bus Cancelled";
        description = "This bus ride was cancelled.";
    } else if (game.status === 'abandoned') {
        color = 0x6c757d; // Gray for abandoned
        title = "🚫 Bus Abandoned";
        description = "This bus ride was abandoned due to technical issues.";
    }


    return {
        color: color,
        title: title,
        description: description,
        fields: [
            { name: `🧑‍🤝‍🧑 On the Bus (${onBus.length})`, value: onBusList, inline: true },
            { name: `💰 Cashed Out (${cashedOut.length})`, value: cashedOutList, inline: true },
            { name: `💀 Dead in the Road (${dead.length})`, value: deadList, inline: true }
        ],
        footer: { text: `Game ID: ${game.id} | Wager: ${game.wager} GC` }
    };
}

function buildGameButtons(phase, gameId) {
    const rows = [];
    let row = new ActionRowBuilder();

    if (phase === 'color') {
        row.addComponents(
            new ButtonBuilder().setCustomId(`rtb_choice_${gameId}_red`).setLabel('Red').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`rtb_choice_${gameId}_black`).setLabel('Black').setStyle(ButtonStyle.Secondary)
        );
    } else if (phase === 'higher_lower') {
        row.addComponents(
            new ButtonBuilder().setCustomId(`rtb_choice_${gameId}_higher`).setLabel('Higher').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`rtb_choice_${gameId}_lower`).setLabel('Lower').setStyle(ButtonStyle.Danger)
        );
    } else if (phase === 'inside_outside') {
        row.addComponents(
            new ButtonBuilder().setCustomId(`rtb_choice_${gameId}_inside`).setLabel('Inside').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`rtb_choice_${gameId}_outside`).setLabel('Outside').setStyle(ButtonStyle.Secondary)
        );
    } else if (phase === 'suit') {
        row.addComponents(
            new ButtonBuilder().setCustomId(`rtb_choice_${gameId}_hearts`).setLabel('♥️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`rtb_choice_${gameId}_diamonds`).setLabel('♦️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`rtb_choice_${gameId}_clubs`).setLabel('♣️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`rtb_choice_${gameId}_spades`).setLabel('♠️').setStyle(ButtonStyle.Success)
        );
    }
    rows.push(row);

    // Add control buttons
    const controlRow = new ActionRowBuilder();
    if (phase !== 'color') { // Can't cash out on the first round
        controlRow.addComponents(
            new ButtonBuilder().setCustomId(`rtb_cashout_${gameId}`).setLabel('This is my stop').setStyle(ButtonStyle.Primary)
        );
    }

    // Only add the control row if it has components
    if (controlRow.components.length > 0) {
        rows.push(controlRow);
    }


    return rows;
}

async function handlePlayerChoice(interaction, client) {
    const parts = interaction.data.custom_id.split('_');
    const action = parts[1]; // e.g., 'choice' or 'cashout'
    const gameId = parseInt(parts[2], 10);
    const userId = interaction.member.user.id;

    const game = await getBusGame(gameId);
    const player = await getBusGamePlayer(gameId, userId);

    if (!game || game.status !== 'active') {
        return { content: "This game is no longer active.", ephemeral: true };
    }
    if (!player || player.player_status !== 'on_bus') {
        return { content: "You are not on the bus!", ephemeral: true };
    }

    if (action === 'choice') {
        const choice = parts[3]; // e.g., 'red', 'higher'
        await updateBusGamePlayer(gameId, userId, { current_choice: choice });
        console.log(`[Game ${gameId}] Player ${userId} chose: ${choice}`);

        // Check if all players have made their choice to proceed the game
        checkAndProcessRound(gameId, client);

        return { content: `Your choice (${choice}) is locked in.`, ephemeral: true };
    }

    if (action === 'cashout') {
        let stops = 0;
        if (game.current_phase === 'higher_lower') stops = 1;
        else if (game.current_phase === 'inside_outside') stops = 2;
        else if (game.current_phase === 'suit') stops = 3;

        await updateBusGamePlayer(gameId, userId, { player_status: 'cashed_out', stops_rode: stops });
        console.log(`[Game ${gameId}] Player ${userId} cashed out with ${stops} stop(s).`);

        // Also check if the game should proceed now that this player has cashed out
        checkAndProcessRound(gameId, client);

        return { content: `You have cashed out after ${stops} stop(s).`, ephemeral: true, update_message: true };
    }
}


async function processRoundResults(gameId, client) {
    // Ensure the timer is cleared so it doesn't run twice
    if (activeTimers.has(gameId)) {
        clearTimeout(activeTimers.get(gameId));
        activeTimers.delete(gameId);
    }

    console.log(`[Game ${gameId}] Processing round results...`);
    const game = await getBusGame(gameId);
    // If game is not active (e.g., already finished or cancelled), do nothing.
    if (game.status !== 'active') {
        console.log(`[Game ${gameId}] Aborting processing, game is no longer active.`);
        return;
    }
    const players = await getBusGamePlayers(gameId);
    const onBusPlayers = players.filter(p => p.player_status === 'on_bus');


    const deck = createDeck();
    const outcomeCard = drawCard(deck, game.current_cards);
    console.log(`[Game ${gameId}] Revealed card: ${outcomeCard.rank} of ${outcomeCard.suit}`);

    for (const player of onBusPlayers) {
        let correct = false;
        const choice = player.current_choice;
        const prevCard = game.current_cards[game.current_cards.length - 1];
        const prevCard2 = game.current_cards.length > 1 ? game.current_cards[game.current_cards.length - 2] : null;

        switch (game.current_phase) {
            case 'color':
                const color = (outcomeCard.suit === 'hearts' || outcomeCard.suit === 'diamonds') ? 'red' : 'black';
                correct = choice === color;
                break;
            case 'higher_lower':
                if (prevCard) {
                    correct = (choice === 'higher' && outcomeCard.value > prevCard.value) ||
                        (choice === 'lower' && outcomeCard.value < prevCard.value);
                }
                break;
            case 'inside_outside':
                if (prevCard && prevCard2) {
                    const min = Math.min(prevCard.value, prevCard2.value);
                    const max = Math.max(prevCard.value, prevCard2.value);
                    const isInside = outcomeCard.value > min && outcomeCard.value < max;
                    // we define both boundaries here because ties are loses
                    const isOutside = outcomeCard.value > max && outcomeCard.value < min;
                    correct = (choice === 'inside' && isInside) ||
                        (choice === 'outside' && isOutside);
                }
                break;
            case 'suit':
                correct = choice === outcomeCard.suit;
                break;
        }

        if (correct) {
            console.log(`[Game ${gameId}] Player ${player.user_id} was CORRECT.`);
            await updateBusGamePlayer(gameId, player.user_id, { stops_rode: player.stops_rode + 1, current_choice: null });
        } else {
            console.log(`[Game ${gameId}] Player ${player.user_id} was INCORRECT or did not choose.`);
            await updateBusGamePlayer(gameId, player.user_id, { player_status: 'dead_in_road', current_choice: null });
        }
    }

    // Add the revealed card to the sequence
    const allCards = [...game.current_cards, outcomeCard];
    await updateBusGame(gameId, { current_cards: JSON.stringify(allCards) });

    const nextPhase = Phases[game.current_phase].next;
    const stillOnBus = await db('bus_game_players').where({ game_id: gameId, player_status: 'on_bus' });

    if (!nextPhase || stillOnBus.length === 0) {
        await endGame(gameId, client);
    } else {
        await startNextPhase(gameId, nextPhase, client);
    }
}

async function endGame(gameId, client) {
    // Ensure the timer is cleared
    if (activeTimers.has(gameId)) {
        clearTimeout(activeTimers.get(gameId));
        activeTimers.delete(gameId);
    }

    console.log(`[Game ${gameId}] Ending game...`);

    await db.transaction(async trx => {
        await updateBusGame(gameId, { status: 'finished' });
        const game = await getBusGame(gameId);
        const players = await getBusGamePlayers(gameId);

        let summary = `The bus ride has ended! Here are the results:\n\n`;
        summary += `**Final Sequence:** ${game.current_cards.map(c => `[${c.rank}${Suits[c.suit]}]`).join(' ')}\n\n`;

        const endOfLine = players.filter(p => p.player_status === 'on_bus');
        const cashedOut = players.filter(p => p.player_status === 'cashed_out');
        const dead = players.filter(p => p.player_status === 'dead_in_road');

        console.log(`[Game ${gameId}] Final tallies - End of Line: ${endOfLine.length}, Cashed Out: ${cashedOut.length}, Dead: ${dead.length}`);

        if (endOfLine.length > 0) {
            summary += `**🏁 End of the Line (${endOfLine.length}):**\n`;
            for (const player of endOfLine) {
                const winnings = game.wager * Payouts[4];
                console.log(`[Game ${gameId}] Granting ${winnings} GC to user ${player.user_id} for reaching the end.`);
                const result = await transferThenGrantCapped(client.user.id, player.user_id, winnings, 'rtb_win_end_of_line');
                const actualWinnings = result.actualAmount || winnings;
                summary += `<@${player.user_id}> made it all the way and wins **${actualWinnings} GC**!\n`;
            }
            summary += '\n';
        }

        if (cashedOut.length > 0) {
            for (const player of cashedOut) {
                const winnings = game.wager * Payouts[player.stops_rode];
                console.log(`[Game ${gameId}] Transfer/granting ${winnings} GC to user ${player.user_id} for cashing out after ${player.stops_rode} stop(s).`);
                const result = await transferThenGrantCapped(client.user.id, player.user_id, winnings, `rtb_win_cash_out_${player.stops_rode}`);
                const actualWinnings = result.actualAmount || winnings;
                summary += `<@${player.user_id}> got off with **${actualWinnings} GC**.\n`;
            }
            summary += '\n';
        }

        if (dead.length > 0) {
            for (const player of dead) {
                console.log(`[Game ${gameId}] User ${player.user_id} lost their ${game.wager} GC wager.`);
            }
        }

        console.log(`[Game ${gameId}] Sending final message.`);
        const channel = await client.channels.fetch(game.channel_id);
        const message = await channel.messages.fetch(game.message_id);

        const finalEmbed = await buildGameEmbed(gameId);
        finalEmbed.description = summary;

        await message.edit({ embeds: [finalEmbed], components: [] });
        console.log(`[Game ${gameId}] Final message sent.`);
    });
}


module.exports = {
    startJoinTimer,
    handlePlayerChoice,
    buildGameEmbed,
};
