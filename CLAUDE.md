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
If asked, you should modify this file (CLAUDE.md) under the `# Memory`. 
- Focus on architectural decisions, major features, and complex debugging with lessons learned
- Combine related sessions that happened close together on similar topics
- Include specific technical details for future reference (function names, file paths, key concepts)
- Emphasize "why" decisions were made and what problems they solved
- Keep entries detailed enough to understand context but concise enough to scan quickly
- Target 8-12 lines per major session, grouping minor sessions together

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

## 2025-06-30 Session Summary (Initial Setup & Database Integration)

Built Discord bot foundation with Docker Compose architecture. Key decisions:
- **Technology Stack**: Node.js with Knex.js for PostgreSQL database interaction (chose over ORMs for direct SQL control)
- **Infrastructure**: Docker services (api, emoji-bot, db) with automated migrations and health checks
- **Commands**: Implemented modular command system with global registration, ephemeral responses
- **Database**: Users table with automatic user creation, transaction tracking system
- **Development**: Hot-reloading with nodemon, environment-based configuration

## 2025-07-01 Session Summary (Core Transfer System & Game Foundation)

Implemented comprehensive coin transfer system and first game:
- **Transfer Logic**: `db.transfer()` with transaction safety, user existence checking, emoji-based transfers via discord.js bot
- **Transaction Types**: Introduced `transaction_type` column with special sender IDs ('lottery', 'house') for system operations
- **Architecture**: Split into api service (slash commands) and emoji-bot service (message reactions)
- **First Game**: Heist game with interactive buttons, win/loss mechanics, bot vs player transfers
- **Discord Permissions**: Resolved intent requirements (Message Content, Guild Members)

## 2025-07-02 Session Summary (Production Deployment)

Deployed to Render with CI/CD pipeline:
- **Platform Choice**: Render for Docker-native support and GitHub integration over Railway
- **Production Issues**: Resolved connection errors (DATABASE_URL, SSL certificates), health check endpoints
- **Service Architecture**: Web service (garrycoin-api) + Background worker (garrycoin-emoji-bot)
- **Migration Strategy**: Integrated `knex migrate:latest` into startup scripts for Render limitations
- **Command Fixes**: Resolved guild member fetching issues by passing discord.js client to commands

## 2025-07-04-05 Session Summary (Feature Expansion & Games)

Added major features and improved game system:
- **GitHub Integration**: `/garrybotrequest` command creating issues via GitHub API, resolved ES Module import issues
- **Game Organization**: Created `src/commands/games/` structure, recursive command loading
- **Heist Enhancements**: User targeting, interactive buttons with proper MESSAGE_COMPONENT handling
- **Username Display**: Standardized on Discord mentions (`<@USER_ID>`) across all commands for consistency

## 2025-07-09 Session Summary (Activity Tracking & Dynamic Game Logic)

Implemented sophisticated user activity and game mechanics:
- **Activity Tracking**: Added `last_active_at` to users table, automatic updates on messages/commands
- **Smart Lottery**: Modified to only select winners from users active within 7 days
- **Dynamic Heist Success**: Variable success rates based on target inactivity (33%-90% scaling) and wealth ratios
- **Database Functions**: `getRandomActiveUser`, `getUser` for activity-based game logic

## 2025-07-26 Session Summary (Wordle Integration)

Built comprehensive Wordle rewards system:
- **Message Parsing**: Automated detection of Wordle bot results with user extraction
- **Reward Calculation**: Tiered rewards based on solve attempts (1-6 tries), unsolved handling
- **Anti-Cheat**: Random "GOTCHA" system with penalties for spoofing attempts
- **Reporting**: Grouped public reports by outcome (winners by tries, unsolved, cheaters)
- **Database Schema**: New `wordle_rewards` table for idempotency and historical tracking

## 2025-07-28-30 Session Summary (Database Resilience & Connection Management)

Resolved critical production stability issues:
- **Server Crash Fix**: Moved heist button logic into proper MESSAGE_COMPONENT conditional to prevent crashes
- **Connection Resilience**: Implemented `withRetry` wrapper for "Connection terminated unexpectedly" errors in long-running game timers
- **Pool Configuration**: Enhanced Knex connection pooling with proper timeouts and validation for Supabase
- **Transaction Deadlock Fix**: Refactored `findOrCreateUser` to accept transaction objects, preventing pool exhaustion
- **Key Lesson**: Always use `trx` object within transaction blocks instead of global `db` to avoid connection deadlocks

## 2025-08-02 Session Summary (Admin Tools & Heist Mechanics)

Administrative interface and game balance improvements:
- **Admin CLI**: Created `src/bot_cli.js` for privileged operations (say, grant, grant-and-announce) avoiding visible admin commands
- **Heist Formula Refactor**: New dynamic calculation: Base (50%) + Activity Adjustment (-15% for recent activity) + Wealth Adjustment (Robin Hood style)
- **Transparency**: Full breakdown display of success chance calculations with server-side logging
- **Game Improvements**: Ensured unique card draws in Ride the Bus

## 2025-08-09 Session Summary (Structured Logging & Production Monitoring)

Infrastructure improvements for production debugging:
- **Structured Logging**: Implemented winston with category-based JSON logging (DATABASE, HEIST, TRANSFER, etc.)
- **Production Benefits**: Render log aggregation with filtering capabilities, eliminated noisy Knex pool logs
- **Enhanced Resilience**: Improved connection validation, increased pool timeouts for Supabase session pooler
- **Monitoring**: Better observability for debugging connection issues during idle periods

## 2025-08-13 Session Summary (Gambling Statistics & Performance Optimization)

Comprehensive analytics system and Discord timeout fixes:
- **MakeItRain Fix**: Implemented deferred response pattern to handle Discord's 3-second timeout in large servers
- **Gambling Statistics**: Built complete analytics system with `getGamblingStats` and `getGamblingLeaderboard` functions
- **Data Source Strategy**: Uses authoritative game tables (bus_games, wavelength_games) where available, falls back to transactions
- **Win Rate Bug Fix**: Corrected impossible >100% win rates by distinguishing game instances from transaction counts
- **User Features**: `/garrygamblingstats` for personal analysis, `/garrygamblingboard` with profit/volume/winrate leaderboards
- **Key Insight**: Game statistics must use proper data sources - game tables for instances, transaction tables for amounts
