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

    // Fetch existing commands
    const existingCommands = await rest.get(Routes.applicationCommands(APP_ID));
    console.log(`Found ${existingCommands.length} existing commands.`);

    // Find ALL Entry Point commands
    const entryPointCommands = existingCommands.filter(cmd =>
      cmd.integration_types || cmd.contexts
    );

    if (entryPointCommands.length > 0) {
      console.log(`Found ${entryPointCommands.length} Entry Point command(s):`);
      entryPointCommands.forEach(cmd => {
        console.log(`  - ${cmd.name} (id: ${cmd.id})`);
      });
    }

    // Log all command names to see what we have
    console.log('All existing commands:', existingCommands.map(cmd => cmd.name).join(', '));

    // Find commands that exist in Discord but not in our definitions
    const ourCommandNames = commands.map(cmd => cmd.name);
    const missingCommands = existingCommands.filter(cmd =>
      !ourCommandNames.includes(cmd.name)
    );

    if (missingCommands.length > 0) {
      console.log(`Preserving ${missingCommands.length} Discord-managed command(s):`);
      missingCommands.forEach(cmd => console.log(`  - ${cmd.name}`));
    }

    // Combine our commands with Discord-managed ones
    const allCommands = [...commands, ...missingCommands];

    // Register all commands
    await rest.put(
      Routes.applicationCommands(APP_ID),
      { body: allCommands },
    );

    console.log('Successfully reloaded application (/) commands.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to register commands:');
    console.error(error);
    process.exit(1);
  }
})();