# personas
- You are a coder and architect that knows all languages and frameworks. You are a 10,000x developer who is sharp, to the point, and sees the bigger picture and how that relates to the task at hand
- Your human handler feeds you ideas. They are a developer that knows the languages you work in, but might not know all features. Only include lengthy explinations if they ask for them.
- When implementing features, add creative flair and polish beyond the basic requirements - use emojis, visual hierarchy, and engaging UX elements to make commands feel polished and fun.

# project details
- Always read @README.md, index.js, package.json, docker-compose.yml, db.js, command_definitions.js, and bot.js. These are the most important high level parts of this codebase and you should always have context of them.
- Always run `find . -name "node_modules" -prune -o -name ".git" -prune -o -print` to get a sense of the project structure. 
- Always read @DESIGN.md for technical guidance.
- Keep these documents up to date for major project decisions and technical decisions.

# saving session info
If asked to save the current session, you should modify this file (CLAUDE.md) under the `# Memory`. 
- Focus on architectural decisions, major features, and complex debugging with lessons learned
- Combine related sessions that happened close together on similar topics
- Include specific technical details for future reference (function names, file paths, key concepts)
- Emphasize "why" decisions were made and what problems they solved
- Keep entries detailed enough to understand context but concise enough to scan quickly
- Target 6-8 lines per major session, grouping minor sessions together
- under ## Dev Topics, consider if you need to make any updates, or if you need to add a new topic to cover what was worked on

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
Always verify assumptions with concrete evidence (e.g., by checking logs, file contents, or running commands) before making statements or taking action. Use `docker ps` to check on the running containers. Remember that we are using nodemon, so we are getting hot reloading of containers after changes to /src. The user typically keeps containers running most of the time, so check first before suggesting to start them.

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

## Session Timeline

### 2025-06-30: Initial Setup & Database Integration
Built Discord bot foundation with Docker Compose architecture:
- **Technology Stack**: Node.js with Knex.js for PostgreSQL database interaction (chose over ORMs for direct SQL control)
- **Infrastructure**: Docker services (api, emoji-bot, db) with automated migrations and health checks
- **Commands**: Implemented modular command system with global registration, ephemeral responses

### 2025-07-01: Core Transfer System & Game Foundation
Implemented comprehensive coin transfer system and first game:
- **Transfer Logic**: `db.transfer()` with transaction safety, user existence checking, emoji-based transfers
- **Transaction Types**: Introduced `transaction_type` column with special sender IDs ('lottery', 'house')
- **First Game**: Heist game with interactive buttons, win/loss mechanics

### 2025-07-02: Production Deployment
Deployed to Render (API, bot) with CI/CD pipeline:
- **Platform Choice**: Render for Docker-native support and GitHub integration over Railway
- **Service Architecture**: Web service (garrycoin-api) + Background worker (garrycoin-emoji-bot)
- **Migration Strategy**: Integrated `knex migrate:latest` into startup scripts
- later, near end of July, moved database to Supabase.

### 2025-07-04-05: Feature Expansion & Games
Added major features and improved game system:
- **GitHub Integration**: `/garrybotrequest` command creating issues via GitHub API
- **Game Organization**: Created `src/commands/games/` structure, recursive command loading
- **Username Display**: Standardized on Discord mentions (`<@USER_ID>`) across all commands

### 2025-07-09: Activity Tracking & Dynamic Game Logic
Implemented sophisticated user activity and game mechanics:
- **Activity Tracking**: Added `last_active_at` to users table, automatic updates on messages/commands
- **Smart Lottery**: Modified to only select winners from users active within 7 days
- **Dynamic Heist Success**: Variable success rates based on target inactivity (33%-90% scaling) and wealth ratios

### 2025-07-26: Wordle Integration
Built comprehensive Wordle rewards system:
- **Message Parsing**: Automated detection of Wordle bot results with user extraction
- **Reward Calculation**: Tiered rewards based on solve attempts (1-6 tries), unsolved handling
- **Anti-Cheat**: Random "GOTCHA" system with penalties for spoofing attempts

### 2025-08-02: Admin Tools & Heist Mechanics
Administrative interface and game balance improvements:
- **Admin CLI**: Created `src/bot_cli.js` for privileged operations avoiding visible admin commands
- **Heist Formula Refactor**: New dynamic calculation: Base (50%) + Activity/Wealth Adjustments

### 2025-08-13: Federal GarryCoin Reserve & Loan System
Implemented comprehensive economic intervention systems:
- **FGR System**: AI-driven economic interventions with Gemini API integration, three autonomous policy tools
- **Loan System**: Complete implementation with FICO-style credit scoring (300-850), risk-based approval algorithm
- **Database Schema**: New tables for FGR events, loans, voting system, policy tracking with full audit trail

### 2025-08-13: Gambling Statistics & Analytics
Comprehensive analytics system implementation:
- **Statistics Engine**: Built complete analytics with `getGamblingStats` and `getGamblingLeaderboard` functions
- **Data Strategy**: Uses authoritative game tables where available, falls back to transactions
- **User Features**: `/garrygamblingstats` for personal analysis, `/garrygamblingboard` with profit/volume/winrate leaderboards

### 2025-08-15: Security Features & Money Controls
Enhanced security and financial controls:
- **SQL Interface**: `/garryquerylanguage` command with read-only access, advanced security validation, ban system
- **Wealth Commands**: `/garryfatcats` leaderboard with medal emojis and balance-tier displays  
- **Money Glitch Fix**: Fixed RTB infinite money exploit, implemented proper `transferThenGrant` function

### 2025-08-16: Infrastructure Optimization & Early Loan Repayment
Major performance optimizations and new loan features:
- **transferThenGrant Bug**: Fixed nested transaction issues causing silent RTB payout failures
- **Connection Pool Optimization**: Solved Discord 3-second timeout issues with proactive connection management
- **Health Monitoring**: Added `/health` endpoint with real-time pool metrics and database response tracking
- **Early Loan Repayment**: Implemented `/garryrepayloan` command with 25% penalty for loans < 24 hours, real-time compound interest calculation using Math.ceil(), interactive loan selection UI with Discord buttons
- **Credit Score Anti-Abuse**: Enhanced credit scoring to prevent loan hoarding with active loan burden penalties (5 pts/loan + 15 pts for loans >7 days), debt ratio penalties (10-50 pts), and automatic score updates on loan creation/payment

## Dev Topics

### Database Architecture & Performance
**Connection Management Evolution**:
- **Initial**: Basic Knex setup with default pooling (2025-06-30)
- **Database Housing**: Moved to Supabase for better free tier (also turns out better features than Render). API and Bot are still hosted by Render
- **Production Issues**: Enhanced pooling with timeouts and validation for Supabase (2025-07-28)
- **Resilience**: Implemented `withRetry` wrapper for connection errors, transaction deadlock fixes (2025-07-28)
- **Optimization**: Connection warming system, smart deferral, 2s timeouts for Discord compatibility (2025-08-16)

**Key Lessons**: Always use `trx` object within transaction blocks, validate environment variables, monitor pool stress for proactive management.

### Financial Security & Money Flow
**Transfer System Evolution**:
- **Foundation**: Basic `transfer()` with transaction safety (2025-07-01)
- **Hybrid Function**: `transferThenGrant()` for smart money flow - transfer first, grant remainder (2025-08-15)
- **Critical Fix**: Rewrote function to prevent nested transactions causing silent failures (2025-08-16)

**Security Controls**: Progressive SQL ban system with exponential penalties, audit trails for money creation, validation using word boundaries (`\b${keyword}\b`).

### Discord Integration & Performance  
**Response Pattern Evolution**:
- **Basic**: Immediate responses for all commands (2025-06-30)
- **Deferred Introduction**: Strategic deferral for long operations like `garrymakeitrain` (2025-08-13)
- **Smart Deferral**: Auto-defer based on pool stress while preserving UX for simple operations (2025-08-16)

**Timeout Solutions**: Message length limits require content truncation, deferred responses for >3s operations, connection warming prevents first-use delays.

### Monitoring & Debugging Infrastructure
**Logging Evolution**:
- **Basic**: Console logging with pool state information (2025-06-30)
- **Structured**: Winston with category-based JSON logging (DATABASE, HEIST, TRANSFER, etc.) (2025-08-09)
- **Production**: Render log aggregation, eliminated noisy Knex logs, comprehensive error tracking (2025-08-09)
- **Health Monitoring**: Real-time pool metrics, database response tracking, stress indicators (2025-08-16)

**Testing Infrastructure**: CLI test suites for complex systems (FGR, loans), comprehensive edge case testing for financial functions.

### Game Systems & Economics
**Core Games**: Heist (interactive buttons, dynamic success rates), Ride the Bus (card-based progression), Wavelength (word association), Wordle integration (automated rewards).

**Economic Features**: Federal Reserve system with AI-driven interventions, loan system with credit scoring, gambling statistics with proper data sourcing, progressive penalty systems.

**Key Insight**: Game statistics require proper data sources - use game tables for instances, transaction tables for amounts to avoid impossible win rates.