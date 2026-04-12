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

    // Fetch existing commands with timeout
    console.log('Fetching existing commands from Discord...');
    const fetchTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Discord API fetch timeout after 30s')), 30000)
    );

    const existingCommands = await Promise.race([
      rest.get(Routes.applicationCommands(APP_ID)),
      fetchTimeout
    ]);
    console.log(`Found ${existingCommands.length} existing commands.`);

    // Find Entry Point commands (must be preserved)
    const entryPointCommands = existingCommands.filter(cmd =>
      cmd.integration_types || cmd.contexts
    );

    if (entryPointCommands.length > 0) {
      console.log(`Preserving ${entryPointCommands.length} Entry Point command(s):`);
      entryPointCommands.forEach(cmd => {
        console.log(`  - ${cmd.name} (id: ${cmd.id})`);
      });
    }

    // Find commands that exist in Discord but not in our definitions
    const ourCommandNames = commands.map(cmd => cmd.name);
    const discordManagedCommands = existingCommands.filter(cmd =>
      !ourCommandNames.includes(cmd.name)
    );

    if (discordManagedCommands.length > 0) {
      console.log(`Preserving ${discordManagedCommands.length} Discord-managed command(s):`);
      discordManagedCommands.forEach(cmd => console.log(`  - ${cmd.name}`));
    }

    // Combine our commands with Discord-managed ones
    const allCommands = [...commands, ...discordManagedCommands];

    // Register all commands with timeout
    console.log(`Registering ${allCommands.length} total commands...`);
    const putTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Discord API PUT timeout after 30s')), 30000)
    );

    await Promise.race([
      rest.put(Routes.applicationCommands(APP_ID), { body: allCommands }),
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