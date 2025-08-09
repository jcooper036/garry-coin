# personas
- You are a coder and architect that knows all languages and frameworks. You are a 10,000x developer who is sharp, to the point, and sees the bigger picture and how that relates to the task at hand
- Your human handler feeds you ideas. They are a developer that knows the languages you work in, but might not know all features. Only include lengthy explinations if they ask for them.

# project details
- Always read @README.md, index.js, package.json, docker-compose.yml, db.js, command_definitions.js, and bot.js. These are the most important high level parts of this codebase and you should always have context of them.
- Always run `find . -name "node_modules" -prune -o -name ".git" -prune -o -print` to get a sense of the project structure. 
- Always read @DESIGN.md for technical guidance.
- Keep these documents up to date for major project decisions and technical decisions.
- Always read MEMORY.md, which is a summary of previous things we have worked on.
- If asked to dump your memory, condense the memory of the current coversation and add the summary to MEMORY.md, with the section header as the date and time, following the example there.

# sacred - do not alter these files unless explicitly instructed to do so (you may read them though)
- docker-compose.yml

# saving session info
If asked, you should modify this file (CLAUDE.md) under the `# Memory`. Use the examples there to summarize what you have worked on in a way that will be helpful for future developers. Always append to this file, never delete. Adjust the length of your entry based on the amount of complexity / back and forth with the user. If you needed to be corrected or helped, be sure to focus on what was eventually said such that you were able to figure out the path forward.

# planning
Planning should be done as a synthesis with the user. To prevent you or the user from cheating
- write your pans to `docs/ai_plan`, with a markdown doc that has the feature or issue name.
- then ask the user to describe their plan. ask the user their level of familiarity with the subject on a scale of 1-5 (1 know nothing, 2 novice, 3 some working familiarity, 4 decent experience, 5 expert)
- consider the similarities and differences between the two plans. Neither of you is assumed to be more correct. You are considered to be a 4 on the scale that you asked the user to provide, and weigh your answers accordingly
The point of this approach is to come to synthesis between you and the user.


# Project hygene
- Use TODO.md to track issues and features. This is to help you and your human handler.
- If, at any point, you detect a discrepency between requests from the user or documentation in the project and what you are planning to do, add an issue to TODO.md to reconcile that difference.
- Only work on issues or features in TODO.md if explicitly instructed to do so. Otherwise, follow the instructions of your handler
- if you are corrected by your handler, add that correction to the # correections seciont of this file (CLAUDE.md) so that you don't make the same mistake in the future format as:
```markdown
## Topic
### What I did wrong
### what to do instead
```
# corrections
## TODO.md Format
### What I did wrong
I changed the format of the TODO.md file, specifically the sections and instructions.
### what to do instead
Only add or remove issues/features from TODO.md. Do not modify the existing instructions or sections.

## Assiming docker is not running
### What I did wrong
Made assumptions about the cause of an error (e.g., Docker not running) without sufficient evidence.
### What to do instead
Always verify assumptions with concrete evidence (e.g., by checking logs, file contents, or running commands) before making statements or taking action. Use `docker ps` to check on the running containers. Remember that we are using nodemon, so we are getting hot reloading of containers after changes to /src.

## Confidently wrong about code existence
### What I did wrong
When troubleshooting, stated that a line of code was present in a file without verifying its existence.
### What to do instead
When troubleshooting, before stating that a specific line of code or file content exists, use `read_file` or `read_many_files` to confirm its presence and exact content. This is because the reason there is a bug is that the code might not exist, i.e. that there was a failure of a tool to write the code (I thought I wrote it, but it did not save).

## mismatching db write calls with the schema
Did not thoroughly check the database schema (migration files) before writing code that interacts with the database, leading to a column name mismatch.
### What to do instead
When interacting with a database, always consult the relevant migration files or schema definitions to ensure correct column names and data structures are used. If there's any doubt, read the migration files first. Refrain from changing the databse unless explicity told to do so - change functions that interact with the database to match the database instead.

## running migrations
I should not suggest running migrations myself, i.e. `npx knex migrate:latest`
### What to do instead
Let the user an/or other systems handle this. In development, the migrations are run when the user runs `docker compose up --build` to start the test bot, server, and database. In prod, this is handled by CI/CD. I should suggest to the user that they are all good to start / restart docker compose to run the migrations.

# Memory
This is where you save records of sessions when the user asks.

## 250630 13:06:45 EST Session Summary

This session focused on building and refining a JavaScript Discord bot named GarryCoin. Key actions and decisions included:

- **Initial Setup**: Created `package.json`, `docker-compose.yml`, `Dockerfile`, and a basic `.env` file. Implemented a `/test` command.
- **Interaction Endpoint**: Added the `/interactions` endpoint to `src/index.js` to handle Discord interactions, including PING and APPLICATION_COMMAND types, and integrated `discord-interactions` for signature verification.
- **Hot-Reloading**: Configured Docker Compose to enable hot-reloading for changes in `src/` by adding `nodemon` and mounting the `src` directory as a volume. Updated `README.md` with instructions.
- **Private Messages**: Modified the `/test` command to send ephemeral (private) messages using `InteractionResponseFlags.EPHEMERAL`.
- **Command Stubs & Modularity**: Created a `src/commands` directory and added stub implementations for all planned commands (`/garryhelp`, `/garrywallet`, `/garrylookatme`, etc.), each returning a unique descriptive phrase. Commands were organized into separate modules.
- **Global Command Registration**: Refactored command registration to be global (application-level) instead of guild-specific. Separated command definitions into `commands.js` (later `src/command_definitions.js`) and updated `src/register-commands.js` to use this. Ensured command registration occurs on Docker container startup.
- **`/garryhelp` Implementation**: Implemented the `/garryhelp` command to dynamically list all available commands and their descriptions.
- **File Renaming/Moving**: Moved `commands.js` to `src/command_definitions.js` and updated all relevant imports.

## 2025-06-30 20:02:28 Session Summary

This session focused on setting up database interaction for the GarryCoin bot. Key actions and decisions included:

- **Logging Enhancement**: Added detailed logging for command requests, including user ID, username, channel ID, channel name, server ID, and server name in `src/index.js`.
- **GarryCoin Granting Tool**: Implemented an `npm run grant_gc <userId> <amount>` command. This involved adding a script to `package.json` and creating `src/grant_gc.js` to handle the logic of adding GarryCoin to a user's balance in the database.
- **`/garrywallet` Command Implementation**: Modified `src/commands/garrywallet.js` to fetch and display a user's GarryCoin balance from the database.
- **Database Integration Strategy**: Discussed various JavaScript database tools (ORMs like Sequelize, TypeORM, Prisma; ODMs like Mongoose; Query Builders like Knex.js). Decided to use **Knex.js** for its direct SQL interaction capabilities and robust migration system, avoiding full ORM abstraction.
- **Knex.js Setup**:
    - Installed `knex` and `pg` (PostgreSQL client).
    - Created `knexfile.js` for database connection configurations across development, test, and production environments.
    - Created `src/db.js` as a utility to export a configured Knex instance for use in application code.
    - Created the initial migration `create_users_table` to set up a `users` table with `user_id` and `balance` columns.
- **Automated Migrations with Docker Compose**: Added a `migrations` service to `docker-compose.yml` to automatically run `npx knex migrate:latest` on startup, ensuring the database schema is always up-to-date.
- **User Existence Check**: Implemented a generic middleware in `src/index.js` to check if a user exists in the database for every `APPLICATION_COMMAND` interaction. If not, the user is automatically added with a default balance of 0.
- **Asynchronous Operations Clarification**: Explained the necessity and benefits of using `await` for asynchronous database operations in Node.js, ensuring proper request handling without blocking the server.

## 2025-07-01 13:45:00 Session Summary

This session focused on implementing coin transfer functionality, including both slash commands and emoji reactions, and addressing several bugs.

- **Coin Transfer Logic**:
    - Implemented `transfer(senderId, receiverId, amount)` and `recordTransaction(sending_user_id, receiving_user_id, amount, trx)` functions in `src/db.js`.
    - The `transfer` function handles user existence (creating new users if needed), checks for sufficient funds, and performs balance updates within a database transaction.
    - Created a new Knex migration `create_transactions_table` for recording transfers.
- **Database Configuration Fixes**:
    - Corrected `knexfile.js` to use `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` environment variables, aligning with the `.env` file.
    - Resolved "column "discord_id" does not exist" errors by ensuring all database interactions (queries and inserts) in `src/db.js` and command files consistently use `user_id` instead of `discord_id` for the `users` table.
- **Slash Command Integration (`/garrysend`)**:
    - Updated `src/commands/garrysend.js` to utilize the new `transfer` function, accepting `target_user` and `amount` as options.
    - Modified `src/command_definitions.js` to include the new options for `/garrysend`.
    - Refactored `src/index.js` to use the `findOrCreateUser` function from `src/db.js` for initial user checks.
- **Emoji-Based Transfers**:
    - Introduced `discord.js` as a new dependency (`npm install discord.js`).
    - Created `src/bot.js` to act as a separate Discord client, listening for `messageReactionAdd` events.
    - `src/bot.js` parses custom GarryCoin emojis (e.g., `1GarryCoin`, `5GarryCoin`, `10GarryCoin`) to determine the transfer amount and calls the `transfer` function.
- **Docker Compose and Project Structure Updates**:
    - Modified `package.json` to include separate `dev-api` (for slash commands) and `dev-bot` (for emoji reactions) scripts.
    - Updated `docker-compose.yml` to run two distinct services: `api` (renamed from `bot`) and a new `emoji-bot`, each executing their respective start scripts.
- **Debugging and Permissions**:
    - Addressed "Used disallowed intents" error by instructing the user to enable the `Message Content Intent` in the Discord Developer Portal.
- **`/garrylookatme` Command Implementation**:
    - Created `src/commands/garrylookatme.js` to publicly display a user's GarryCoin balance using `findOrCreateUser`.
    - Added the `garrylookatme` command definition to `src/command_definitions.js`.
    - Resolved "Application command names must be unique" error during command registration by removing a duplicate `garrylookatme` entry in `src/command_definitions.js`.

## 2025-07-01 15:00:00 Session Summary

This session focused on implementing a "lottery" feature to randomly grant coins, which led to significant debugging and improvements in the database schema and Docker configuration.

- **Lottery Feature**:
    - Implemented a feature in `src/bot.js` to grant a random user 1 GarryCoin whenever a message is posted in the channel, with a one-minute cooldown.
    - Created a `grant` function in `src/db.js` to handle system-level coin awards.
- **Troubleshooting & Bug Fixes**:
    - **`GuildMembersTimeout` Error**: Resolved by adding the `GuildMembers` intent in `src/bot.js` and advising the user to enable the "Server Members Intent" in the Discord Developer Portal.
    - **Database `NOT NULL` Constraint Violation**: The initial `grant` function failed by passing a `null` `sending_user_id` to the database.
- **Schema and Logic Refinement**:
    - **Transaction Types**: Instead of allowing `NULL` senders, we introduced a `transaction_type` column to the `transactions` table.
    - **Special Sender IDs**: The `sending_user_id` for system grants now uses special string identifiers: `'lottery'` for the random grants and `'house'` for manual grants via `npm run grant_gc`.
    - **Code Updates**: Refactored `src/bot.js`, `src/grant_gc.js`, and `src/db.js` to implement and use the new transaction types and sender IDs.
    - **Database Migration**: Created and applied a new migration to add the `transaction_type` column to the database.
- **Docker Compose Improvements**:
    - **Race Condition**: Identified and explained a race condition where services (`migrations`, `api`) could start before the `db` service was fully initialized and ready to accept connections.
    - **Health Check**: Implemented a `healthcheck` in `docker-compose.yml` for the `db` service using `pg_isready`.
    - **Service Dependencies**: Updated the `depends_on` conditions for all dependent services to use `condition: service_healthy` or `service_completed_successfully`, ensuring a robust startup order.
- **User Education**: Explained the function of the `--rm` flag in the `docker-compose run` command.

## 2025-07-02 10:00:00 Session Summary

This session focused on implementing the remaining slash commands and troubleshooting a local Docker environment issue.

- **Command Implementation**:
    - Implemented `garrylookatme`, `garrymakeitrain`, `garryhistory`, `garryreceipt`, `garrysend`, and `garryhelp`.
    - Initially overwrote some existing commands, but corrected this by restoring the original files and adding the `findOrCreateUser` check to all commands to ensure users exist in the database before any operation.
- **`garryreceipt` Command Refinement**:
    - Updated the `garryreceipt` command to accept a `user` option, allowing a user to view the transaction history of another specific user.
    - Fixed a `TypeError` by correctly accessing the target user's data from the interaction payload (`interaction.data.resolved.users[targetUserId]`)
- **Output Formatting**:
    - Improved the output of `garryhistory` and `garryreceipt` to display user mentions (`<@USER_ID>`) instead of raw user IDs for better readability.
- **Docker Troubleshooting**:
    - Diagnosed and resolved a local Docker environment error (`request returned Internal Server Error for API route...`).
    - The issue was traced to a misconfigured Docker context and likely a stalled Docker daemon.
    - Guided the user through checking contexts (`docker context ls`), switching to the correct context (`docker context use default`), and ultimately restarting Docker Desktop, which resolved the problem.
- **Docker Cleanup**:
    - Explained how to use `docker-compose down` with flags like `--volumes` and `--rmi all` to completely remove containers, networks, and optionally volumes and images for a clean rebuild.

## 2025-07-02 Session Summary (Deployment to Render)

This session focused on deploying the GarryCoin bot to Render, establishing a CI/CD pipeline with GitHub, and resolving deployment-related issues.

- **Deployment Strategy**: Decided to use Render for deployment due to its free tier, Docker-native support, and integrated CI/CD with GitHub, despite initial considerations for other platforms like Railway.
- **GitHub Repository Setup**:
    - Created a new GitHub repository and pushed existing local code.
    - Resolved `unrelated histories` during the initial push by using `git pull origin trunk --allow-unrelated-histories`.
    - Switched the remote origin to use SSH (`git@github.com:...`) to address authentication issues during `git push`.
- **Render Service Setup**:
    - Created a PostgreSQL database on Render (`garrycoin_db`).
    - Configured the `garrycoin-api` (Web Service) and `garrycoin-emoji-bot` (Background Worker) services on Render.
    - Adjusted `Dockerfile` and `package.json` to integrate `knex migrate:latest` directly into the `dev-api` and `dev-bot` scripts (`migrate-and-start-api`, `migrate-and-start-bot`) to work around Render's free-tier limitations on "Build Commands" and "Pre-Deploy Commands".
- **Troubleshooting Render Deployment**:
    - **`ECONNREFUSED` Error**: Resolved by updating `knexfile.js` to use `process.env.DATABASE_URL` for the `production` environment and ensuring `NODE_ENV=production` was set on Render.
    - **`self-signed certificate` Error**: Fixed by adding `ssl: { rejectUnauthorized: false }` to the Knex production connection in `knexfile.js`.
    - **Render Health Check Failure**: Addressed by adding a `GET /` endpoint to `src/index.js` to satisfy Render's health check.
- **Discord Interaction Endpoint Update**: Updated the "Interactions Endpoint URL" in the Discord Developer Portal to the Render service URL (`https://garrycoin-api.onrender.com/interactions`).
- **`/garrymakeitrain` Command Fix**:
    - Resolved `TypeError: Cannot read properties of undefined (reading 'members')` in `src/commands/garrymakeitrain.js`.
    - Modified `garrymakeitrain.js` to correctly fetch guild members using the `client` object.
    - Updated `src/index.js` to create a `discord.js` `Client` instance and pass it to the command's `execute` function.
- **TODO.md Update**: Added "Set up a proper testing bot" to `TODO.md`.

## 2025-07-04 Session Summary (Cleaning up dev)
- **testing bot**: .env configs the testing version of test-garrycoin_bot. Locally we use docker-compose to run the bot, the api, the postgres db, and migrations. We use Heroku to connect to discord. ENV variables are from .env . In prod, we use Render to standup these services, and call the mirgrate-and-start- versions in package.json. The ENV variables for prod are maintned in Render.
- **Use nodemon**: For local dev, we should be using nodemon. In package.json we use the dev- commands to start the api and bot with nodemon.

## 2025-07-04 Session Summary (GitHub Integration)

This session focused on integrating the bot with GitHub to allow users to submit bug reports and feature requests directly from Discord.

- **`/garrybotrequest` Feature Implementation**:
    - Created a new slash command, `/garrybotrequest`, which takes a `type` (bug or feature) and a `description`.
    - The command logic, located in `src/commands/garrybotrequest.js`, constructs a GitHub issue with a standardized title, a body containing user and guild information, and appropriate labels (`triage`, `bug`/`feature-request`).
    - The feature uses a GitHub Personal Access Token (PAT) for authentication, configured via new environment variables (`GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`).
    - On successful issue creation, the bot replies with an ephemeral message containing a link to the new issue.

- **`ERR_REQUIRE_ESM` Bug Fix**:
    - The initial implementation crashed because `node-fetch` (v3+) is an ES Module, but the project uses CommonJS (`require`).
    - Resolved the issue by replacing the static `require('node-fetch')` with a dynamic `import('node-fetch')` within the command's `execute` function.

- **Future Improvement (GitHub App)**:
    - Discussed having the bot submit issues as itself (a GitHub App) instead of using a user's PAT.
    - This would provide better attribution but requires a more complex authentication flow (JWTs, installation tokens).
    - The user decided to postpone this improvement, and it was added to `TODO.md` for future consideration.
    
## 2025-07-05 Session Summary

This session focused on implementing a new game, `/heist`, and improving username display consistency across commands.

- **Implemented `/heist` Game**:
    - Created `src/commands/games` directory for game-related commands.
    - Added `/heist` command definition to `src/command_definitions.js`, including an `amount` option for wagering.
    - Updated `src/index.js` to recursively load commands from subdirectories, enabling modular command organization.
    - Created `src/commands/games/heist.js` to handle the game logic:
        - Validates player's wager against their balance.
        - Validates bot's balance to ensure it can cover potential payouts (2x wager).
        - Presents an interactive message with "Cut Wire" buttons (Red, Blue, Green).
    - Implemented `MESSAGE_COMPONENT` interaction handling in `src/index.js` for `/heist` button clicks:
        - Parses button `customId` to determine player's choice and wager.
        - Randomly determines win/loss outcome.
        - Uses `db.transfer` to move coins between the player and the bot (`heist_win` or `heist_loss` transaction types).
        - Updates the original message to show the outcome and disables the buttons.
- **Fixed Ephemeral Message Bug**:
    - Corrected `src/index.js` to properly apply the `ephemeral` flag to command responses, ensuring private messages remain private.
- **Fixed Heist Button Logic Typo**:
    - Corrected a typo in `src/index.js` where the `MESSAGE_COMPONENT` handler was incorrectly checking for `'garryheist'` instead of `'heist'` for the game type.
- **Improved Username Display Consistency**:
    - Fixed `src/commands/garrylookatme.js` to use `interaction.member.user.global_name` with a fallback to `interaction.member.user.username` to prevent "null" display names.
    - Proactively updated `src/commands/garrylookatyou.js` with the same `global_name` fallback logic.
    - Refactored `src/commands/garrylookatme.js` and `src/commands/garrylookatyou.js` to use the Discord-native `<@USER_ID>` mention format for displaying usernames, ensuring correct and consistent display across all Discord clients.
    - Reviewed `src/commands/garryhistory.js` (already using `<@USER_ID>`).
    - Updated `src/commands/garryreceipt.js` to consistently use `<@USER_ID>` for all username displays.
    - Reviewed `src/commands/garrysend.js` and `src/commands/garrymakeitrain.js` (no changes needed for username display).

## 2025-07-09 Session Summary

This session focused on improving the lottery system and adding advanced features to the `/heist` game.

- **Lottery Activity Tracking**:
    - To prevent the lottery from granting coins to inactive users, we implemented activity tracking.
    - Created a database migration to add a `last_active_at` timestamp column to the `users` table.
    - Updated `src/db.js` to automatically update this timestamp whenever a user sends a message (`updateUserActivity`) or uses a slash command (`findOrCreateUser`).
    - Modified the lottery logic in `src/bot.js` to only select a winner from users active in the last 7 days, using a new `getRandomActiveUser` database function.

- **Heist Game Enhancements**:
    - **User Targeting**: Modified the `/heist` command to allow a player to target another user instead of only the bot. This involved updating the command definition, the command execution logic, and the button interaction handler.
    - **Dynamic Success Chance**: Implemented a variable success chance for heists based on the target's inactivity. The probability of a successful heist now scales linearly from a 33% chance for a target active within 2 days, up to a 90% chance for a target inactive for 14 days or more. Heists against the bot have a fixed 50% chance.
    - Added a `getUser` function to `src/db.js` to retrieve the necessary activity data for the calculation.
    - Updated the result message to include the calculated success percentage for transparency.

- **Bug Fixing**:
    - Resolved a `TypeError` in the `/heist` command caused by an incorrect function signature in `src/commands/games/heist.js`.
    - Addressed a recurring Docker daemon error when running database migrations.


## 2025-07-26 Session Summary

This session focused on implementing a new Wordle rewards feature. Key aspects included:

- **Feature Planning**: Developed a detailed plan for a Wordle rewards system, including parsing messages, rewarding users, detecting cheating, and reporting.
- **Database Schema**: Decided to add a new `wordle_rewards` table to track daily Wordle participation, scores, and reward details for idempotency and historical data.
- **Core Logic (`src/wordle_handler.js`)**: Implemented the main logic for parsing Wordle bot messages, calculating rewards based on tries, applying a random "cheat detection" mechanism (GarrycOinTuringCHeatAudit - GOTCHA), and handling database transactions for rewards and penalties.
- **Bot Integration (`src/bot.js`)**: Integrated the Wordle handler into the `messageCreate` listener. Implemented a system to verify messages come from approved Wordle bot IDs (configurable via `WORDLE_BOT_IDS` environment variable) and to penalize users attempting to spoof Wordle results with an "attempted_hacking" transaction.
- **Reporting Refinement**: Enhanced the public report message to group users by outcome: individual lines for winners (batched by number of tries), a single line for all unsolved players, and a single line for all caught cheaters.
- **Dynamic Messaging**: Added random emojis to the report messages for each outcome type (winner, unsolved, cheater) to make them more engaging. Discussed how to incorporate custom Discord emojis.
- **Parsing Fixes**: Corrected the message parsing logic to properly extract user IDs from Discord's `<@USER_ID>` mention format.
- **Unsolved Handling**: Ensured that users who don't solve the Wordle (X/6) are still recorded in the `wordle_rewards` table with 10 tries.

## 2025-07-28 17:28:40 Session Summary

This session focused on debugging and fixing a critical server crash.

- **Problem Identification**: Diagnosed a `ReferenceError: custom_id is not defined` that crashed the server. The root cause was an unconditional code block at the end of `src/index.js` that attempted to process `/heist` button interactions. This block was incorrectly executing for all interaction types, including slash commands where `custom_id` is not available.
- **Replication**: Determined that the crash could be replicated by running any slash command whose handler did not explicitly send a response, causing execution to "fall through" to the faulty code. The user confirmed this with the `/heist` command.
- **Solution**: Refactored `src/index.js` by moving the heist button handling logic into the `if (type === InteractionType.MESSAGE_COMPONENT)` block. Added a conditional check, `if (custom_id.startsWith('heist_'))`, to ensure the logic only runs for valid heist button clicks, resolving the crash.

## 2025-07-28 Session Summary (Database Connection Resilience)

This session focused on diagnosing and fixing a "Connection terminated unexpectedly" error that occurred during long-running game timers.

- **Problem Identification**: Traced the error to the `endWavelengthGame` function, which is called by a `setTimeout` after 10 minutes. The long delay caused the database connection to become stale and be terminated by the server.
- **Troubleshooting & Debugging**:
    - Initially attempted to solve the issue with Knex.js connection pooling, but this caused unrelated Docker daemon errors for the user and was reverted.
    - To accelerate testing, we temporarily changed the 10-minute game timer to 15 seconds for the development environment.
    - Discovered the test timer wasn't working because the `NODE_ENV=development` environment variable was not set in `docker-compose.yml`. Adding it to the `api` and `emoji-bot` services resolved the timer issue.
- **Solution: Resilient Error Handling**:
    - Instead of relying on global connection pool settings, we implemented a more targeted fix.
    - Wrapped the database logic within the `endWavelengthGame` function in a `try...catch` block.
    - If a "Connection terminated" error is caught, the function now logs the error and automatically retries the operation once after a 5-second delay.
- **Validation**: Successfully tested the fix by starting a Wavelength game and manually restarting the database container (`docker-compose restart db`), forcing a connection drop. The retry logic engaged as expected, and the game concluded successfully without crashing the bot.

## 2025-07-29 Session Summary (Database Connection Resilience Part 2)

This session focused on diagnosing and fixing a "Connection terminated unexpectedly" error in the `/ridethebus` game.

- **Problem Identification**: The error was the same as the one previously fixed for the Wavelength game. Long-running `setTimeout` calls in `src/commands/games/ride_the_bus/ridethebus_helpers.js` were causing the database connection to go stale.
- **Solution: Proactive Resilient Error Handling**:
    - Implemented a generic `withRetry` function in `src/db.js` to handle database connection errors.
    - Wrapped the `findOrCreateUser` and `updateUserActivity` functions with the `withRetry` logic, as they were the source of the immediate errors.
    - Proactively wrapped all other database functions for both the `Ride the Bus` and `Wavelength` games to prevent similar issues in the future.

## 2025-07-30 Session Summary (Database Connection Pooling)

This session focused on resolving a recurring `Connection terminated unexpectedly` database error that appeared in the Wordle feature's cloud logs.

- **Problem Identification**: The error was traced to stale database connections, similar to previous incidents. The existing `withRetry` logic was not sufficient to handle the underlying connection pool's failure to recover.
- **Solution: Knex Connection Pooling**:
    - To create a more robust and permanent fix, the `knexfile.js` was modified to include comprehensive connection pool settings for both the `development` and `production` environments.
    - The new `pool` configuration includes parameters like `min`, `max`, `acquireTimeoutMillis`, and `idleTimeoutMillis` to allow Knex to proactively manage, test, and evict stale or broken connections. This provides a more resilient solution than relying solely on application-level retries.

## 2025-07-30 Session Summary (Knex Transaction Deadlock)

This session focused on diagnosing and fixing a `KnexTimeoutError: Knex: Timeout acquiring a connection. The pool is probably full.` error.

- **Problem Identification**: The error appeared on simple read commands like `/garrylookatyou`, but the root cause was a database connection pool deadlock. Functions like `transfer` and `grant` were initiating a database transaction (using one connection) and then calling `findOrCreateUser`, which attempted to acquire a *second* connection instead of using the existing transaction's connection. This exhausted the connection pool, causing subsequent database requests from any command to time out.

- **Solution**: The `findOrCreateUser` function was refactored to accept an optional transaction object (`trx`). The `transfer` and `grant` functions were updated to pass their transaction object to `findOrCreateUser`, ensuring all operations within the transaction share the same database connection.

- **Key Takeaway (Avoiding Deadlocks)**: When operating inside a Knex.js transaction block (`db.transaction(async trx => { ... })`), any database queries made within that block **must** use the provided `trx` object (e.g., `trx('users').select(...)`) instead of the global `db` object. This prevents the function from trying to acquire a new connection from the pool when one is already reserved by the transaction, thus avoiding deadlocks.

## 2025-08-02 Session Summary (Admin CLI & Game Logic)

This session focused on creating a secure command-line interface for bot administration and refining game logic.

- **Ride the Bus Improvement**: Modified the `/ridethebus` game to ensure that randomly drawn cards are always unique and not already present in the current game sequence.

- **Admin CLI Tool (`src/bot_cli.js`)**:
    - Discussed and opted for a command-line script over admin-only slash commands to ensure admin tools are not visible to regular users.
    - Created `src/bot_cli.js` as a dedicated tool for privileged bot actions.
    - Implemented a `say` command for the bot to send arbitrary messages to a channel.
    - Implemented a `grant` command to award GarryCoin to a user, notifying them via DM with a formatted message and optional memo.
    - Implemented a `grant-and-announce` command to award GarryCoin and post the notification publicly in a specified channel instead of a DM.

- **Debugging**:
    - Resolved several issues in the CLI tool, including argument parsing for messages with spaces, handling of invalid channel IDs, and fixing faulty exit logic that caused the script to hang or crash after execution.
    - Refined the `grant` and `grant-and-announce` commands to be mutually exclusive in their notification methods (DM vs. channel).

## 2025-08-02 Session Summary (Heist Mechanics Refactor)

This session focused on a major refactor of the `/heist` game's success chance calculation.

- **New Heist Formula**:
    - Designed and implemented a more dynamic formula: `Final Chance = Base (50%) + Activity Adjustment + Wealth Adjustment`.
    - **Activity Adjustment**: A configurable penalty (default: -15%) is applied for targeting users who have been active recently (within 14 days).
    - **Wealth Adjustment**: A "Robin Hood" style modifier (default: approx. +/-15%) makes it harder to steal from poorer players and easier to steal from richer ones, based on the logarithmic ratio of their balances.
    - The final chance is clamped between a minimum (20%) and maximum (95%) to prevent extreme outcomes.

- **Implementation & Transparency**:
    - The new logic was implemented in `src/index.js` with easily configurable constants for tweaking the formula's parameters.
    - The result message was updated to provide players with a full breakdown of how their success chance was calculated (Base + Activity + Wealth = Total).
    - Added detailed server-side logging for all variables involved in the heist calculation for future monitoring and balancing.

- **Bug Identification & Deferred Fix**:
    - A bug was identified where a target's `last_active_at` timestamp was being updated simply by being targeted in a heist. This was caused by the `db.transfer` function calling `findOrCreateUser`, which has a side effect of updating the timestamp.
    - This bug incorrectly applied the maximum activity penalty to users who were targeted multiple times in a row.
    - A fix was proposed to modify `db.transfer` to avoid this side effect, but the user opted to defer the fix and observe the current behavior after adjusting the formula's modifiers.

## 2025-08-09 Session Summary (Structured Logging & Database Resilience)

This session focused on housekeeping tasks including structured logging implementation and fixing production database connection issues.

- **Heist Investigation**:
    - User reported potential bug where bot wasn't losing coins during heist games.
    - Comprehensive testing revealed the heist functionality was working correctly - the bot does lose coins when players win heists and gains coins when players fail.
    - Created test scripts to verify transfer logic and confirmed all database transactions were properly recorded.

- **Structured Logging Implementation**:
    - **Problem**: Console logs were cluttered with noisy Knex pool state messages, making it difficult to find relevant information.
    - **Solution**: Implemented winston-based structured JSON logging throughout the entire codebase.
    - **Created `src/logger.js`**: Centralized logging configuration with category-based loggers (DATABASE, HEIST, TRANSFER, COMMAND, WORDLE, LOTTERY, etc.).
    - **Converted all console.log/console.error calls**: Updated `src/index.js`, `src/bot.js`, `src/db.js`, and `src/wordle_handler.js` to use structured logging.
    - **Benefits for Render**: JSON logs are now filterable by category, user ID, error type, etc. in Render's log aggregation system.
    - **Reduced noise**: Eliminated verbose Knex pool logs, keeping only critical connection errors.

- **Database Connection Resilience (Production Issue)**:
    - **Problem**: Wordle handler failing at 12:47 AM with "Connection terminated unexpectedly" after long idle periods.
    - **Root Cause**: Supabase session pooler terminating idle connections during low-activity periods, combined with aggressive pool timeout settings.
    - **Solutions Applied**:
        - **Enhanced Pool Configuration**: Increased `acquireTimeoutMillis` from 30s to 60s, `idleTimeoutMillis` from 30s to 5 minutes, reduced minimum connections to 1.
        - **Improved Connection Validation**: Added timeout protection and enhanced validation queries with better error handling.
        - **Structured Logging**: Converted Wordle handler to use structured logging for better debugging visibility.
    - **Expected Results**: Fewer connection timeouts during idle periods, faster recovery from connection failures, better observability for debugging.

- **Key Technical Insights**:
    - Render's log aggregation works excellently with winston's JSON format, enabling powerful filtering and search capabilities.
    - Database connection issues are often related to idle timeout settings rather than application logic.
    - Structured logging provides significant value for production debugging and monitoring, especially with cloud-hosted applications.
