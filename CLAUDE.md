# personas
- You are a coder and architect that knows all languages and frameworks. You are a 10,000x developer who is sharp, to the point, and sees the bigger picture and how that relates to the task at hand
- Your human handler feeds you ideas. They are a developer that knows the languages you work in, but might not know all features. Only include lengthy explinations if they ask for them.
- When implementing features, add creative flair and polish beyond the basic requirements - use emojis, visual hierarchy, and engaging UX elements to make commands feel polished and fun.

# project details
- Always read @README.md, index.js, package.json, docker-compose.yml, db.js, command_definitions.js, and bot.js. These are the most important high level parts of this codebase and you should always have context of them.
- Always run `find . -name "node_modules" -prune -o -name ".git" -prune -o -print` to get a sense of the project structure. 
- Always read @DESIGN.md for technical guidance.
- Keep these documents up to date for major project decisions and technical decisions.
- If asked to dump your memory, condense the memory of the current coversation and add the summary to CLAUDE.md, with the section header as the date and time, following the example there.

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

## Missing environment variables in troubleshooting
### What I did wrong
When troubleshooting issues where services fail silently or get stuck, I didn't check for missing environment variables that services depend on.
### What to do instead
When troubleshooting mysterious failures, timeouts, or hanging processes, always check that required environment variables are properly configured in docker-compose.yml, .env files, and production deployment settings. Missing API keys, tokens, or connection strings often cause services to fail silently or hang indefinitely.

# Memory

## 2025-08-15 Session Summary (/garryquerylanguage Command & SQL Ban System Implementation)

Implemented comprehensive SQL query interface with advanced security and punishment system:
- **Core Feature**: Created `/garryquerylanguage` command allowing read-only SQL queries against database with optional public results
- **Security Validation**: Multi-layer protection including SELECT-only enforcement, forbidden keyword detection using word boundaries, dangerous function blocking, query timeouts (30s), and result limits (100 rows)
- **SQL Ban System**: Complete punishment framework with `sql_ban_events` table tracking violations, exponential ban escalation (2^n minutes), matching fine amounts transferred to bot, and public shaming messages
- **Smart Word Boundaries**: Fixed validation to allow legitimate column names like `created_at` while blocking actual SQL keywords like `CREATE TABLE`
- **Database Architecture**: Read-only connection configuration, detailed violation categorization (forbidden_keyword, dangerous_function, invalid_statement_type), comprehensive audit logging with full query storage
- **Progressive Penalties**: 1st violation = 2min + 2GC fine, 2nd = 4min + 4GC, escalating exponentially to deter repeated attempts
- **Public Accountability**: Violations trigger public Discord messages showing user, violation type, query attempt, and penalty details for community awareness
- **Integration**: Seamlessly integrated with existing transfer system, structured logging, and Discord.js interaction patterns

Critical Security Insight: Word boundary validation (`\b${keyword}\b`) essential for blocking actual SQL keywords while preserving legitimate database column names containing those substrings.

## 2025-08-15 Session Summary (/garryfatcats Command Implementation)

Quick implementation of new wealth leaderboard command:
- **New Command**: Created `/garryfatcats` showing users with highest balances, defaults to top 5
- **Optional Parameter**: Added `count` parameter for flexible display (1-N users), with positive number validation  
- **Smart Display**: Medal emojis for top 3, balance-tier emojis (💎💰🟡🪙), automatic adjustment when fewer users exist than requested
- **Database Function**: Added `getTopUsersByBalance(limit)` with proper ordering by balance DESC
- **Command Registration**: Updated command_definitions.js with INTEGER type parameter, proper descriptions

## 2025-08-15 Session Summary (Ride the Bus Money Glitch Fix & transferThenGrant Implementation)

Fixed critical infinite money exploit in Ride the Bus game and implemented proper money flow controls:
- **Security Issue Identified**: RTB game was creating money from thin air using `grant()` function for all winnings, while only collecting wagers from players via `transfer()` to bot
- **Money Glitch Analysis**: Players paid wagers to bot, but winners received payouts created from nothing, enabling infinite money generation through large bets
- **New Function**: Implemented `transferThenGrant(senderId, receiverId, amount, transaction_type)` function that first attempts transfer from sender, then grants remainder if insufficient funds
- **Smart Money Flow**: Bot pays winnings from collected wagers first, only creates new money when bot balance is insufficient (with structured logging for monitoring)
- **RTB Integration**: Updated `ridethebus_helpers.js` to use `transferThenGrant` instead of `grant` for end-of-line and cash-out winnings (lines 375, 385)
- **Database Changes**: Added `transferThenGrant` to exports, imported in RTB helpers, maintains same interface as `transfer()` function
- **Testing Infrastructure**: Created comprehensive test script `test_transfer_then_grant.js` with multiple scenarios, edge cases, and balance verification
- **Wordle Migration**: Fixed unrelated duplicate key error by creating migration to remove unique constraint on `wordle_rewards` table
- **Financial Controls**: System now prevents infinite money creation while maintaining game functionality, with audit trail for any money generation events
- **Key Architecture**: Preserved existing `transfer()` and `grant()` functions, added hybrid function that intelligently chooses between transfer vs creation based on sender balance

## 2025-08-13 Session Summary (Federal GarryCoin Reserve Implementation & Debugging)

Implemented comprehensive Federal GarryCoin Reserve (FGR) system with AI-driven economic interventions:
- **Technology Stack**: Gemini API integration for contextual financial content generation, structured logging system
- **Core Features**: Three autonomous policy tools - Quantitative Easing (targets losing gamblers every 6hrs, 15% chance), Strategic Buybacks (targets profitable players daily, 10% chance), Policy Announcements (pure theater every 12hrs, 20% chance)
- **LLM Integration**: Generic `llmService` with Gemini 2.5 Flash, contextual prompts using live market data, fallback to "no comments" message
- **Database Schema**: New tables for FGR events, voting system, policy tracking with full audit trail
- **Data-Driven Decisions**: Real-time context gathering from gambling stats, transaction history, user activity patterns fed into AI prompts
- **Commands**: `/garryreservevote` for community input, `/garryreservereport` for economic analysis with live data
- **Testing Infrastructure**: Complete CLI testing suite with npm scripts, detailed diagnostics for API connectivity
- **Architecture**: Modular design with `FGRContext` for data aggregation, event-driven system with configurable probabilities
- **Documentation**: Comprehensive `Economic_Policy.md` explaining all policy tools, triggers, and expected frequencies
- **Critical Debugging**: Fixed `/garryreservereport` timeout issue by identifying missing GEMINI_API_KEY in docker-compose.yml, added comprehensive logging for post-processing flows
- **Troubleshooting Lesson**: Environment variable validation crucial for silent service failures - added to corrections section

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

## 2025-08-13 Session Summary (Loan System & FGR Reserve Report Fixes)

Comprehensive loan system implementation and critical bug fixes:
- **Loan System Architecture**: Complete implementation with `/garryloan` and `/garrycreditreport` commands, FICO-style credit scoring (300-850), risk-based approval algorithm
- **Database Schema**: New `loans` table with environment-dependent timing (5 min dev, 3 days prod), credit_score column added to users
- **FGR Integration**: Automatic interest rate adjustments (5%-50%) based on policy stance, loan rates adjust with credit scores
- **Automated Payments**: LoanScheduler with debt handling, comprehensive notification system, proper transaction management
- **Testing Infrastructure**: Complete CLI test suite (`npm run test-loan-*`), integration with existing FGR commands
- **Critical Bug Fix**: Fixed `/garryreservereport` hanging issue caused by message length exceeding Discord's 2000 character limit
- **Report Improvements**: Added current interest rate display, implemented timeouts (15s LLM, 30s total), shortened LLM prompts for concise responses
- **Error Handling**: Enhanced webhook response validation, proper timeout management, fallback messages for service failures
- **Key Lesson**: Discord message limits require careful content management - reports now stay under 1000 characters with truncation safeguards

## Session Summary - August 16, 2025

Major Bug Fixes & Optimizations

1. Fixed Critical RTB Money Glitch in transferThenGrant

Problem: RTB winnings weren't being paid out when the bot had insufficient funds. The transferThenGrant function was calling
nested transfer() functions within transactions, causing silent failures.

Root Cause:
- Nested transaction calls that failed silently
- RTB cash-outs used transfer instead of transferThenGrant
- No error handling for failed transfers

Fix:
- Rewrote transferThenGrant to handle all operations within a single transaction
- Updated RTB cash-out logic to use transferThenGrant consistently
- Proper money flow: transfers what bot has, grants remainder with logging

Testing: Confirmed with test script - correctly transfers 40 GC and grants 160 GC when requesting 200 GC with insufficient
bot funds.

2. Solved Discord 3-Second Timeout Issues with Connection Pool Optimizations

Problem: Commands timing out on first use after connection staleness, not due to operation complexity but database
connection acquisition delays.

Analysis: This was a connection pool problem, not a need for universal deferred responses.

Solutions Implemented:

A. Optimized Pool Configuration

- Set acquisition/creation timeouts to 2 seconds (< Discord's 3s limit)
- Shortened idle timeouts to 30 seconds with 5s cleanup intervals
- Increased minimum connections to 2 for connection warming
- Simplified validation queries with 1s timeouts

B. Connection Warming System

- Automatic SELECT 1 queries every 20 seconds on both services
- Prevents stale connections before they become problematic
- Minimal database impact (2 queries every 20s total)
- Full pool state monitoring and logging

C. Smart Deferral Logic

- Monitors pool stress (pending acquisitions, free connections)
- Auto-defers simple commands only when pool is stressed
- Preserves UX for fast operations while protecting against timeouts
- Complex commands keep existing deferral patterns

D. Health Monitoring

- New /health endpoint with real-time pool metrics
- Database response time tracking and utilization percentages
- Pool stress indicators and connection state visibility

Results: Logs show healthy pools with 0 pending acquisitions and 2-63ms response times. Connection warming maintains warm
connections preventing timeout issues.

Inventory Analysis

Deferred vs Immediate Response Commands

Commands Using Deferred Responses (5):
- garrymakeitrain - Bulk transfers to many users
- garryreservereport - LLM API calls (15-30s)
- garryloan - Complex loan processing
- garrycreditreport - Detailed gambling analysis
- ridethebus - Game state creation with timers

Commands Using Immediate Responses (18+):
- Simple operations: garrywallet, garrysend, garryfatcats
- Quick queries: garryhistory, garryreceipt, garrygamblingstats
- Interactive setup: heist, wavelength (buttons return immediately)

Pattern: Deferred responses strategically used for operations >3 seconds, immediate responses for better UX on simple
operations.

Session Impact

- Fixed silent money glitch that prevented RTB winnings payouts
- Eliminated first-use timeout issues with proactive connection management
- Enhanced monitoring capabilities for production debugging
- Preserved optimal UX by avoiding universal deferral while solving root cause
- Added robust health checking for infrastructure monitoring

The optimizations address infrastructure stability while maintaining the responsive user experience for simple commands that
users expect to be instant.