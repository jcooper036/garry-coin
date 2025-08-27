const { getActiveWavelengthGame, getUser } = require('../../db');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatApproxGC } = require('../../number_formatter');
const fs = require('fs');
const path = require('path');

const wavelengthScales = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'assets/wavelength_scales.json'), 'utf8'));
console.log(`[wavelength.js] Loaded ${wavelengthScales.length} wavelength scales.`);

module.exports = {
    name: 'garrywavelength',
    description: 'Start a game of Wavelength.',
    async execute(interaction, client) {
        const wager = interaction.data.options.find(opt => opt.name === 'wager').value;
        const showPlayerGuessesOption = interaction.data.options.find(opt => opt.name === 'show_player_guesses');
        const showPlayerGuesses = showPlayerGuessesOption ? showPlayerGuessesOption.value : false;

        const hostId = interaction.member.user.id;

        if (wager < 2) {
            return {
                content: 'The minimum wager is 2 GarryCoins.',
                ephemeral: true,
            };
        }

        const activeGame = await getActiveWavelengthGame();
        if (activeGame) {
            return {
                content: 'A Wavelength game is already in progress. Please wait for the next one!',
                ephemeral: true,
            };
        }

        const hostUser = await getUser(hostId);
        if (!hostUser || hostUser.balance < wager) {
            return {
                content: `You're too poor for this game. You only have ${formatApproxGC(hostUser?.balance || 0)} GC.`,
                ephemeral: true,
            };
        }

        const scale = wavelengthScales[Math.floor(Math.random() * wavelengthScales.length)];
        const targetNumber = Math.floor(Math.random() * 7) - 3;

        const content = `
**Your Wavelength Setup**
** 3:** ${scale.scale_right}
**-3:** ${scale.scale_left}
**Your Secret Number:** ${targetNumber}

Please come up with a word or phrase that fits the number **${targetNumber}** on this scale. Click the button below when you're ready to enter it.
`;

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`wl_host_setup_${wager}_${showPlayerGuesses}_${wavelengthScales.indexOf(scale)}_${targetNumber}`)
                    .setLabel('Enter Your Word')
                    .setStyle(ButtonStyle.Primary),
            );

        return {
            content: content,
            components: [row],
            ephemeral: true,
        };
    },
};

