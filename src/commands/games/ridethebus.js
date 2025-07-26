const { getActiveBusGame, getUser } = require('../../db');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'garryridethebus',
    description: 'Start a game of Ride the Bus.',
    async execute(interaction, client) {
        const wager = interaction.data.options.find(opt => opt.name === 'wager').value;
        const boardingTimeOption = interaction.data.options.find(opt => opt.name === 'boarding_time');
        const boardingTime = boardingTimeOption ? boardingTimeOption.value : 30;
        
        const hostId = interaction.member.user.id;

        if (wager <= 0) {
            return {
                content: 'You must wager a positive amount of GarryCoins.',
                ephemeral: true,
            };
        }
        
        if (boardingTime < 5 || boardingTime > 120) {
            return {
                content: 'Boarding time must be between 5 and 120 seconds.',
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
            content: `<@${hostId}> has hailed the bus for a fare of **${wager} GC**!\n\n**On the bus:**\n<@${hostId}>\n\nClick "Join Bus" to get on! The bus departs in ${boardingTime} seconds.`,
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
