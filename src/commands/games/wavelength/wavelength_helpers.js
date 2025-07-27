const { db, getWavelengthGame, getWavelengthPlayers, updateWavelengthGame, grant } = require('../../../db');

const activeTimers = new Map();

function startWavelengthTimer(gameId, client) {
    if (activeTimers.has(gameId)) {
        clearTimeout(activeTimers.get(gameId));
    }

    const timerId = setTimeout(() => {
        console.log(`[Game ${gameId}] Wavelength game timer expired. Ending game.`);
        endWavelengthGame(gameId, client);
        activeTimers.delete(gameId);
    }, 10 * 60 * 1000); // 10 minutes

    activeTimers.set(gameId, timerId);
}

async function endWavelengthGame(gameId, client) {
    if (activeTimers.has(gameId)) {
        clearTimeout(activeTimers.get(gameId));
        activeTimers.delete(gameId);
    }

    console.log(`[Game ${gameId}] Ending Wavelength game...`);
    await updateWavelengthGame(gameId, { status: 'finished' });
    const game = await getWavelengthGame(gameId);
    const players = await getWavelengthPlayers(gameId);

    const winners = players.filter(p => p.guess === game.target_number);
    const winnerIds = winners.map(p => p.user_id);
    if (!winnerIds.includes(game.host_user_id)) {
        winners.push({ user_id: game.host_user_id }); // Add host to winners if they are not already there
    }

    const pot = (players.length) * game.wager;
    const winnings = winners.length > 0 ? Math.floor(pot / winners.length) : 0;

    for (const winner of winners) {
        await grant(winner.user_id, winnings, 'wavelength_win');
    }

    let summary = `The game has ended! The target was **${game.target_number}**.\n\n`;
    summary += `**Winners (each win ${winnings} GC):**\n`;
    summary += winners.map(p => `<@${p.user_id}>`).join('\n') || 'None';
    summary += '\n\n**All Guesses:**\n';
    summary += players.map(p => `<@${p.user_id}>: ${p.guess}`).join('\n');

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
}

module.exports = { endWavelengthGame, startWavelengthTimer };