const { getActiveBusGame, getUser } = require('../../db');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatExactGC } = require('../../number_formatter');

module.exports = {
    name: 'garryridethebus',
    description: 'Start a game of Ride the Bus.',
    async execute(interaction, client) {
        const wager = interaction.data.options.find(opt => opt.name === 'wager').value;
        const boardingTimeOption = interaction.data.options.find(opt => opt.name === 'boarding_time');
        const boardingTime = boardingTimeOption ? boardingTimeOption.value : 10;

        const hostId = interaction.member.user.id;

        if (wager <= 0) {
            return {
                content: 'You must wager a positive amount of GarryCoins.',
                ephemeral: true,
            };
        }

        if (boardingTime < 5 || boardingTime > 60) {
            return {
                content: 'Boarding time must be between 5 and 60 seconds.',
                ephemeral: true,
            };
        }

        const activeGame = await getActiveBusGame();
        if (activeGame) {
            return {
                content: 'A Ride the Bus game is already in progress. Please wait for the next one!',
                ephemeral: true,
            };
        }

        const hostUser = await getUser(hostId);
        if (!hostUser || hostUser.balance < wager) {
            return {
                content: `You're too poor for this bus. You only have ${hostUser?.balance || 0} GC.`,
                ephemeral: true,
            };
        }

        const initialEmbed = {
            color: 0xffc107, // Yellow
            title: '🚌 Ride the Bus - Boarding Now!',
            description: `<@${hostId}> has hailed the bus for a fare of **${formatExactGC(wager)} GC**!\n\nThe bus departs in **${boardingTime} seconds**.`,
            fields: [
                { name: '🧑‍🤝‍🧑 On the Bus', value: `<@${hostId}>`, inline: false }
            ],
            footer: { text: `Wager: ${formatExactGC(wager)} GC` }
        };

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('rtb_join')
                    .setLabel('Join Bus')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('rtb_cancel')
                    .setLabel('Cancel Bus')
                    .setStyle(ButtonStyle.Danger),
            );

        const initialMessage = {
            content: '',
            embeds: [initialEmbed],
            components: [row],
            ephemeral: false,
            postProcess: 'create_bus_game', // Signal to index.js
            wager: wager,
            hostId: hostId,
            boardingTime: boardingTime,
        };

        return initialMessage;
    },
};
