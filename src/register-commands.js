require('dotenv').config();
const { REST, Routes } = require('discord.js');
const commands = require('./command_definitions.js');

// --- Start of Environment Variable Check ---
console.log('Checking for required environment variables...');

const { APP_ID, DISCORD_TOKEN } = process.env;

if (!APP_ID) {
  console.error('Error: APP_ID environment variable is not set.');
  process.exit(1);
}

if (!DISCORD_TOKEN) {
  console.error('Error: DISCORD_TOKEN environment variable is not set.');
  process.exit(1);
}

console.log(`APP_ID: ${APP_ID}`);
console.log('DISCORD_TOKEN: [set]'); // Avoid logging the actual token
console.log('Environment variables check passed.');
// --- End of Environment Variable Check ---

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    console.log(`Registering ${commands.length} commands...`);

    // Register commands with timeout
    const putTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Discord API timeout after 30s')), 30000)
    );

    await Promise.race([
      rest.put(Routes.applicationCommands(APP_ID), { body: commands }),
      putTimeout
    ]);

    console.log('Successfully reloaded application (/) commands.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to register commands:');
    console.error(error);
    process.exit(1);
  }
})();