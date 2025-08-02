
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { grant } = require('./db');

// A simple argument parser
const args = process.argv.slice(2);
const command = args[0];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ]
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    let errorOccurred = false;
    try {
        switch (command) {
            case 'say':
                await handleSayCommand();
                break;
            case 'grant':
                await handleGrantCommand({ announce: false });
                break;
            case 'grant-and-announce':
                await handleGrantCommand({ announce: true });
                break;
            // Add other commands here
            default:
                console.error(`Unknown command: ${command}`);
                console.log('Usage: node src/bot_cli.js <command> [options]');
                console.log('Commands: say, grant, grant-and-announce');
                errorOccurred = true; // Set error for unknown command
        }
    } catch (error) {
        console.error('Error executing command:', error);
        errorOccurred = true;
    } finally {
        await client.destroy();
        console.log('Client destroyed. Exiting.');
        process.exit(errorOccurred ? 1 : 0);
    }
});

async function handleSayCommand() {
    const channelIdArg = args.findIndex(arg => arg === '--channel');
    const messageArg = args.findIndex(arg => arg === '--message');

    if (channelIdArg === -1 || messageArg === -1 || !args[channelIdArg + 1]) {
        throw new Error('Usage: node src/bot_cli.js say --channel <channelId> --message "Your message"');
    }

    const channelId = args[channelIdArg + 1];
    const message = args.slice(messageArg + 1).join(' ');

    if (!message) {
        throw new Error('Usage: node src/bot_cli.js say --channel <channelId> --message "Your message"');
    }

    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
        throw new Error(`Could not find a text channel with ID: ${channelId}`);
    }

    await channel.send(message);
    console.log(`Message sent to #${channel.name} in guild ${channel.guild.name}.`);
}

async function handleGrantCommand({ announce }) {
    const userIdArg = args.findIndex(arg => arg === '--user');
    const amountArg = args.findIndex(arg => arg === '--amount');
    const messageArg = args.findIndex(arg => arg === '--message');
    const channelIdArg = announce ? args.findIndex(arg => arg === '--channel') : -1;

    const usage = `Usage: node src/bot_cli.js ${announce ? 'grant-and-announce --channel <channelId>' : 'grant'} --user <userId> --amount <amount> [--message "Your message"]`;

    if (userIdArg === -1 || amountArg === -1 || (announce && channelIdArg === -1) || !args[userIdArg + 1] || !args[amountArg + 1]) {
        throw new Error(usage);
    }

    const userId = args[userIdArg + 1];
    const amount = parseInt(args[amountArg + 1], 10);
    const memo = messageArg !== -1 ? args.slice(messageArg + 1).join(' ') : null;
    const channelId = announce ? args[channelIdArg + 1] : null;


    if (isNaN(amount) || amount <= 0) {
        throw new Error('Amount must be a positive number.');
    }

    // Perform the grant
    await grant(userId, amount, 'cli_grant');
    console.log(`Granted ${amount} GC to user ${userId}.`);

    // Construct the notification message
    let notificationMessage = `GarryCoin Bot sent **${amount} GC** to <@${userId}>.`;
    if (memo) {
        notificationMessage += `\n> memo: ${memo}`;
    }

    // Announce in channel or send DM
    if (announce) {
        if (!channelId) {
            throw new Error('Channel ID is required for grant-and-announce.');
        }
        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
            throw new Error(`Could not find a text channel with ID: ${channelId}`);
        }
        await channel.send(notificationMessage);
        console.log(`Sent grant announcement to #${channel.name}.`);
    } else {
        // Otherwise, send a DM
        try {
            const user = await client.users.fetch(userId);
            await user.send(notificationMessage);
            console.log(`Sent grant notification DM to user ${user.tag}.`);
        } catch (dmError) {
            console.error(`Failed to send DM to user ${userId}. They may have DMs disabled.`, dmError);
        }
    }
}


client.login(process.env.DISCORD_TOKEN);
