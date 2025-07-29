const { db, getWavelengthGame, getWavelengthPlayers, updateWavelengthGame, grant } = require('../../../db');

const activeTimers = new Map();

function startWavelengthTimer(gameId, client) {
    if (activeTimers.has(gameId)) {
        clearTimeout(activeTimers.get(gameId));
    }

    const timeout = process.env.NODE_ENV === 'development' ? 15 * 1000 : 10 * 60 * 1000; // 15 seconds in dev, 10 minutes in prod

    const timerId = setTimeout(() => {
        console.log(`[Game ${gameId}] Wavelength game timer expired. Ending game.`);
        endWavelengthGame(gameId, client);
        activeTimers.delete(gameId);
    }, timeout);

    activeTimers.set(gameId, timerId);
}

async function endWavelengthGame(gameId, client, retryCount = 0) {
    if (activeTimers.has(gameId)) {
        clearTimeout(activeTimers.get(gameId));
        activeTimers.delete(gameId);
    }

    try {
        await updateWavelengthGame(gameId, { status: 'finished' });
        const game = await getWavelengthGame(gameId);
        const players = await getWavelengthPlayers(gameId);

        console.log(`[Game ${gameId}] Ending Wavelength game...`);
        console.log(`[Game ${gameId}] Host: ${game.host_user_id}`);
        console.log(`[Game ${gameId}] Target: ${game.target_number}`);
        console.log(`[Game ${gameId}] Word: ${game.host_word}`);
        console.log(`[Game ${gameId}] Players (${players.length}):`, players.map(p => ({ id: p.user_id, guess: p.guess })));


        const correctGuessers = players.filter(p => p.guess === game.target_number);
        const pot = (players.length + 1) * game.wager; // +1 for the host's wager

        let winners = [];
        let winnings = 0;
        let summary;

        if (correctGuessers.length > 0) {
            // If there's at least one winner, the host also wins.
            winners = [...correctGuessers, { user_id: game.host_user_id }];
            winnings = Math.floor(pot / winners.length);

            for (const winner of winners) {
                await grant(winner.user_id, winnings, 'wavelength_win');
            }
            summary = `The game has ended! The target was **${game.target_number}**. The pot was **${pot} GC**.\n\n`;
            summary += `**Winners (each wins ${winnings} GC):**\n`;
            summary += winners.map(p => `<@${p.user_id}>`).join('\n');
        } else {
            // If no one guessed correctly, the house wins the whole pot.
            summary = `The game has ended! The target was **${game.target_number}**. The pot was **${pot} GC**.\n\n`;
            summary += '**No one guessed correctly! The house wins.**';
        }

        summary += '\n\n**All Guesses:**\n';
        summary += players.map(p => `<@${p.user_id}>: ${p.guess}`).join('\n') || 'No players joined.';

        const channel = await client.channels.fetch(game.channel_id);
        const message = await channel.messages.fetch(game.message_id);


        const finalEmbed = {
            color: 0x28a745, // Green
            title: '🌊 Wavelength - Results 🌊',
            description: summary,
            fields: [
                { name: 'Scale', value: `**${game.scale_left}** ↔️ **${game.scale_right}**` },
                { name: 'Host\'s Word', value: `**${game.host_word}**` },
            ],
        };

        await message.edit({ embeds: [finalEmbed], components: [] });
    } catch (error) {
        if (error.message.includes('Connection terminated') && retryCount < 1) {
            console.error(`[Game ${gameId}] Connection terminated. Retrying in 5 seconds...`);
            setTimeout(() => endWavelengthGame(gameId, client, retryCount + 1), 5000);
        } else {
            console.error(`[Game ${gameId}] Error ending Wavelength game:`, error);
        }
    }
}

module.exports = { endWavelengthGame, startWavelengthTimer };