const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db, getBusGame, getBusGamePlayers, updateBusGame, updateBusGamePlayer, grant, transfer } = require('../../../db');

const JOIN_PERIOD_SECONDS = 5;
const Payouts = {
    1: 1,
    2: 2,
    3: 4,
    4: 9, // End of the line
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

function drawCard(deck) {
    const cardIndex = Math.floor(Math.random() * deck.length);
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

async function startJoinTimer(gameId, client) {
    console.log(`Starting join timer for game ${gameId}`);
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
    }, Phases.joining.duration);
}

async function startNextPhase(gameId, phase, client) {
    console.log(`Starting phase ${phase} for game ${gameId}`);
    const game = await getBusGame(gameId);
    const players = await getBusGamePlayers(gameId);

    const deck = createDeck();
    const newCards = [];
    if (phase === 'color') newCards.push(drawCard(deck));
    if (phase === 'higher_lower') newCards.push(drawCard(deck));
    if (phase === 'inside_outside') newCards.push(drawCard(deck));
    if (phase === 'suit') newCards.push(drawCard(deck));

    const allCards = [...game.current_cards, ...newCards];

    await updateBusGame(gameId, {
        status: 'active',
        current_phase: phase,
        current_cards: JSON.stringify(allCards)
    });

    const channel = await client.channels.fetch(game.channel_id);
    const message = await channel.messages.fetch(game.message_id);

    const messageContent = await buildGameMessage(gameId);
    const messageComponents = buildGameButtons(phase, gameId);

    await message.edit({
        content: messageContent,
        components: messageComponents,
    });
}

async function buildGameMessage(gameId) {
    const game = await getBusGame(gameId);
    const players = await getBusGamePlayers(gameId);

    const cardSequence = game.current_cards.map(c => `[${c.rank}${Suits[c.suit]}]`).join(' ');

    const onBus = players.filter(p => p.player_status === 'on_bus');
    const cashedOut = players.filter(p => p.player_status === 'cashed_out');
    const dead = players.filter(p => p.player_status === 'dead_in_road');

    let message = `**Sequence:** ${cardSequence}\n\n`;
    message += `**Phase:** ${Phases[game.current_phase].name}\n\n`;
    message += `**On the bus (${onBus.length}):**\n${onBus.map(p => `<@${p.user_id}>`).join('\n') || 'None'}\n\n`;
    message += `**Made it to their stop (${cashedOut.length}):**\n${cashedOut.map(p => `<@${p.user_id}> (${p.stops_rode} stop${p.stops_rode > 1 ? 's' : ''})`).join('\n') || 'None'}\n\n`;
    message += `**Dead in the road (${dead.length}):**\n${dead.map(p => `<@${p.user_id}>`).join('\n') || 'None'}\n`;

    return message;
}

function buildGameButtons(phase, gameId) {
    const rows = [];
    let row = new ActionRowBuilder();

    if (phase === 'color') {
        row.addComponents(
            new ButtonBuilder().setCustomId(`rtb_choice_red_${gameId}`).setLabel('Red').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`rtb_choice_black_${gameId}`).setLabel('Black').setStyle(ButtonStyle.Secondary)
        );
    } else if (phase === 'higher_lower') {
        row.addComponents(
            new ButtonBuilder().setCustomId(`rtb_choice_higher_${gameId}`).setLabel('Higher').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`rtb_choice_lower_${gameId}`).setLabel('Lower').setStyle(ButtonStyle.Danger)
        );
    } else if (phase === 'inside_outside') {
        row.addComponents(
            new ButtonBuilder().setCustomId(`rtb_choice_inside_${gameId}`).setLabel('Inside').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`rtb_choice_outside_${gameId}`).setLabel('Outside').setStyle(ButtonStyle.Secondary)
        );
    } else if (phase === 'suit') {
        row.addComponents(
            new ButtonBuilder().setCustomId(`rtb_choice_hearts_${gameId}`).setLabel('♥️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`rtb_choice_diamonds_${gameId}`).setLabel('♦️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`rtb_choice_clubs_${gameId}`).setLabel('♣️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`rtb_choice_spades_${gameId}`).setLabel('♠️').setStyle(ButtonStyle.Success)
        );
    }
    rows.push(row);

    // Add control buttons
    const controlRow = new ActionRowBuilder();
    if (phase !== 'color') { // Can't cash out on the first round
        controlRow.addComponents(
            new ButtonBuilder().setCustomId(`rtb_cash_out_${gameId}`).setLabel('This is my stop').setStyle(ButtonStyle.Primary)
        );
    }
    controlRow.addComponents(
        new ButtonBuilder().setCustomId(`rtb_reveal_${gameId}`).setLabel('Reveal Next Card (Host Only)').setStyle(ButtonStyle.Success)
    );
    rows.push(controlRow);


    return rows;
}

async function handlePlayerChoice(interaction, client) {
    const [_, action, choice, gameIdStr] = interaction.data.custom_id.split('_');
    const gameId = parseInt(gameIdStr, 10);
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
        await updateBusGamePlayer(gameId, userId, { current_choice: choice });
        return { content: `Your choice (${choice}) is locked in.`, ephemeral: true };
    }

    if (action === 'cash_out') {
        const stops = game.current_phase === 'higher_lower' ? 1 : (game.current_phase === 'inside_outside' ? 2 : 3);
        await updateBusGamePlayer(gameId, userId, { player_status: 'cashed_out', stops_rode: stops });
        
        return { content: `You have cashed out after ${stops} stop(s).`, ephemeral: true, update_message: true };
    }
}

async function handleHostAction(interaction, client) {
    const [_, action, gameIdStr] = interaction.data.custom_id.split('_');
    const gameId = parseInt(gameIdStr, 10);
    const userId = interaction.member.user.id;

    const game = await getBusGame(gameId);
    if (!game || game.host_user_id !== userId) {
        return { content: "Only the host can do that.", ephemeral: true };
    }

    if (action === 'reveal') {
        await processRoundResults(gameId, client);
        // Acknowledge the interaction immediately
        return { type: 6 }; // DEFERRED_UPDATE_MESSAGE
    }
}


async function processRoundResults(gameId, client) {
    const game = await getBusGame(gameId);
    const players = await getBusGamePlayers(gameId);
    const onBusPlayers = players.filter(p => p.player_status === 'on_bus');

    const deck = createDeck();
    const outcomeCard = drawCard(deck);
    const allCards = [...game.current_cards, outcomeCard];
    
    for (const player of onBusPlayers) {
        let correct = false;
        const prevCard = game.current_cards[game.current_cards.length - 1];
        const prevCard2 = game.current_cards[game.current_cards.length - 2];

        switch (game.current_phase) {
            case 'color':
                const color = (outcomeCard.suit === 'hearts' || outcomeCard.suit === 'diamonds') ? 'red' : 'black';
                correct = player.current_choice === color;
                break;
            case 'higher_lower':
                correct = (player.current_choice === 'higher' && outcomeCard.value > prevCard.value) ||
                          (player.current_choice === 'lower' && outcomeCard.value < prevCard.value);
                break;
            case 'inside_outside':
                const min = Math.min(prevCard.value, prevCard2.value);
                const max = Math.max(prevCard.value, prevCard2.value);
                const isInside = outcomeCard.value > min && outcomeCard.value < max;
                correct = (player.current_choice === 'inside' && isInside) ||
                          (player.current_choice === 'outside' && !isInside);
                break;
            case 'suit':
                correct = player.current_choice === outcomeCard.suit;
                break;
        }

        if (correct) {
            await updateBusGamePlayer(gameId, player.user_id, { stops_rode: player.stops_rode + 1, current_choice: null });
        } else {
            await updateBusGamePlayer(gameId, player.user_id, { player_status: 'dead_in_road', current_choice: null });
        }
    }

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
    console.log(`Ending game ${gameId}`);
    await updateBusGame(gameId, { status: 'finished' });
    const game = await getBusGame(gameId);
    const players = await getBusGamePlayers(gameId);

    let summary = `The bus ride has ended! Here are the results:\n\n`;
    summary += `**Final Sequence:** ${game.current_cards.map(c => `[${c.rank}${Suits[c.suit]}]`).join(' ')}\n\n`;

    const endOfLine = players.filter(p => p.player_status === 'on_bus');
    const cashedOut = players.filter(p => p.player_status === 'cashed_out');
    const dead = players.filter(p => p.player_status === 'dead_in_road');

    if (endOfLine.length > 0) {
        summary += `**End of the Line (${endOfLine.length}):**\n`;
        for (const player of endOfLine) {
            const winnings = game.wager * Payouts[4];
            await grant(player.user_id, winnings, 'rtb_win_end_of_line');
            summary += `<@${player.user_id}> made it all the way and wins **${winnings} GC**!\n`;
        }
        summary += '\n';
    }

    if (cashedOut.length > 0) {
        summary += `**Made it to their stop (${cashedOut.length}):**\n`;
        for (const player of cashedOut) {
            const winnings = game.wager * Payouts[player.stops_rode];
            await grant(player.user_id, winnings, `rtb_win_cash_out_${player.stops_rode}`);
            summary += `<@${player.user_id}> got off with **${winnings} GC**.\n`;
        }
        summary += '\n';
    }
    
    if (dead.length > 0) {
        summary += `**Dead in the road (${dead.length}):**\n`;
        for (const player of dead) {
            // Wager was already taken at the start, so no transaction needed.
            summary += `<@${player.user_id}> lost their **${game.wager} GC** fare.\n`;
        }
    }

    const channel = await client.channels.fetch(game.channel_id);
    const message = await channel.messages.fetch(game.message_id);
    await message.edit({ content: summary, components: [] });
}


module.exports = {
    startJoinTimer,
    handlePlayerChoice,
    handleHostAction,
    buildGameMessage,
};
