# GarryRoyale Technical Plan

## Summary

GarryRoyale is a Discord Activity - a web app embedded in Discord. **Database-centric architecture**: All game state lives in PostgreSQL. The API is stateless except for Battle Royale mode which requires real-time WebSocket communication. Frontend uses **Svelte for UI** (90% of app) and **Phaser for game scenes** (10% of app - battles only).

---

## Core Architecture Principles

1. **Database as Source of Truth**: All GCM state (HP, stats, modifiers) persists in PostgreSQL. No distinction between "in-battle" and "out-of-battle" state.
2. **Event-Driven**: Record discrete events (attacks, deaths, trades). Frontend animates event logs.
3. **Stateless API**: REST endpoints read/write to DB and return results. No server-side session state.
4. **Minimal Real-Time**: Only Battle Royale uses WebSockets. Turn-based battles are fully server-side simulated.
5. **Hybrid Frontend**: Svelte for menus/UI, Phaser for battle animations.

**Benefits:** Simple, scalable, auditable, cost-effective.
**Trade-off:** BR mode requires stateful server (acceptable - <5% of gameplay).

---

## Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Frontend UI** | Svelte + Vite | 50% smaller than React, faster runtime, perfect for data-heavy UIs |
| **Game Engine** | Phaser 3 | Discord recommends for Activities, handles sprites/physics/animations |
| **Discord SDK** | @discord/embedded-app-sdk | Official, required for authentication and Discord integration |
| **Backend** | Express.js + Node.js | Aligns with existing GarryCoin bot infrastructure |
| **Database** | PostgreSQL (Supabase) | Existing GarryCoin infrastructure, JSONB support |
| **Query Builder** | Knex.js | Already in use, migrations, clean API |
| **WebSocket** | ws or socket.io | For BR mode only |
| **Deployment** | Render | Existing GarryCoin hosting |

---

## Frontend Architecture: Svelte + Phaser Hybrid

### Why Hybrid?

**90% of GarryRoyale is menus and forms:**
- Collection browsing
- Pack opening
- Breeding interface
- Territory management
- Trading marketplace
- Stats screens

**10% is real-time game rendering:**
- Turn-based battle animations
- Battle Royale player movement

**Svelte excels at UI, Phaser excels at games.** Use each for its strength.

### Svelte for UI Layer

**Advantages over React:**
- Compiles to vanilla JS (no virtual DOM overhead)
- 15kb vs 40kb bundle
- Built-in transitions/animations
- Reactive by default (less boilerplate)

**Use cases:**
- All navigation and screens
- GCM collection lists
- Form inputs (breeding, trading)
- Territory map (SVG-based)

**Pattern Reference:** [Svelte Tutorial](https://svelte.dev/tutorial)

### Phaser for Game Scenes

**Why Phaser:**
- Discord [officially recommends Phaser for Activities](https://phaser.io/news/2024/11/build-a-discord-activity-with-phaser)
- Battle-tested for multiplayer games
- Sprite animation, particle effects, physics built-in
- WebGL renderer (high performance)

**Use cases:**
- Turn-based battle visualization (animate event log from server)
- Battle Royale real-time gameplay (player movement, combat, zone shrinking)

**Integration pattern:** Svelte mounts Phaser when entering battle mode, destroys when returning to menus.

**Pattern Reference:** [Phaser Discord Activity Tutorial](https://phaser.io/news/2024/11/build-a-discord-activity-with-phaser)

### Directory Structure

```
frontend/
├── src/
│   ├── lib/
│   │   ├── components/        # Svelte UI components
│   │   │   ├── Collection.svelte
│   │   │   ├── Gacha.svelte
│   │   │   ├── Breeding.svelte
│   │   │   └── Territory.svelte
│   │   └── scenes/            # Phaser game scenes
│   │       ├── BattleScene.js
│   │       └── BRScene.js
│   ├── stores/                # Svelte stores (state management)
│   │   ├── auth.js
│   │   ├── gcms.js
│   │   └── battle.js
│   ├── api/                   # REST client
│   └── App.svelte             # Root (switches UI/Game modes)
```

### Mobile Requirements (2025 Discord Mandate)

- **Safe Area:** Use CSS `env(safe-area-inset-*)` to avoid notches
- **Touch Events:** Pointer events API (works for mouse + touch)
- **Responsive:** Tailwind CSS utilities for mobile-first design

**Reference:** [Discord 2025 Development Guide](https://discord-media.com/en/news/development-2025-the-complete-year-in-review-api-migration-guide.html)

---

## Backend Architecture

### Express.js REST API

**Stateless design:** Each request carries JWT auth token. No session cookies.

**Key Endpoints:**
- `POST /api/auth/discord` - OAuth2 token exchange
- `GET /api/gcm` - List player's GCMs
- `POST /api/gcm/gacha` - Open pack, get random GCMs
- `POST /api/battle/start` - Simulate battle server-side, return event log
- `GET /api/territory` - Get map state
- `POST /api/territory/attack` - Initiate gym takeover
- `POST /api/br/join` - Join BR lobby (then upgrade to WebSocket)

**Pattern Reference:** [Discord OAuth2 Implementation](https://discordjs.guide/oauth2/)

### Battle System: Server-Side Simulation

**Turn-based battles are fully simulated on server:**

1. Client calls `POST /api/battle/start` with team IDs
2. Server locks GCMs in database (`in_battle = true`)
3. Server simulates entire battle deterministically (seeded RNG)
4. Server records event log: `[{type: 'attack', attacker: 1, target: 2, damage: 15}, ...]`
5. Server updates GCM HP, XP, modifiers in single transaction
6. Server returns event log to client
7. **Phaser scene animates events** at display speed (no game logic on client)

**Why server-side?**
- Prevents cheating (client can't manipulate RNG)
- Deterministic (same seed = same result)
- Enables battle replays
- Simplifies client (just visualization)

**Pattern:** Use `seedrandom` library for deterministic RNG.

### Battle Royale: WebSocket Game Server

**Only real-time component in entire app.**

**Architecture:**
- Lobby system (4-16 players)
- In-memory game state (player positions, active GCMs, supply drops)
- 20 tick/second game loop
- Broadcasts state updates to all connected clients
- Periodic DB snapshots (every 10s for recovery)
- Full state written to DB on game end

**Pattern Reference:** [Discord Multiplayer Activities](https://dev.to/waveplay/how-to-add-multiplayer-to-your-discord-activity-lo1)

---

## Database Schema

### Integration with GarryCoin

**Reuse existing tables:**
- `users` - Discord user records
- `balances` - GC balances
- `transactions` - All GC transfers (add new types: `gacha_purchase`, `ai_victory`, `territory_income`)

### New Tables

**Core:**
- `gcms` - All GCM data (stats, HP, level, abilities, status)
- `gcm_modifiers` - PTSD/memory system (trauma, bloodlust, winning_streak, etc.)
- `moves` - Fast/charge attacks
- `abilities` - Passive abilities

**Battles:**
- `battles` - Battle records
- `battle_events` - Event log for replay (attack, KO, death, flee)
- `ai_trainers` - AI opponent definitions
- `trainer_memory` - Remembers player team compositions

**Territory:**
- `territories` - Districts/Cities/Regions
- `territory_income` - Daily GC/item payouts

**Economy:**
- `items` - TMs, healing, stat boosts
- `inventory` - Player items
- `breeding_queue` - Active breeding pairs
- `graveyard` - Dead GCMs (for Hall of Legends)
- `trades` - Marketplace listings

**BR:**
- `br_sessions` - BR game instances
- `br_events` - Event log for replays

**Audit:**
- `event_log` - Global audit trail

### Key Design Decisions

**Persistent HP:** `gcms.current_hp` is always stored. No separate battle state.

**JSONB for Flexibility:** Battle logs, modifiers, special conditions stored as JSONB.

**Event Sourcing:** `battle_events` table records every action. Can replay any battle.

**Foreign Keys:** Enforce integrity, cascade deletes where appropriate.

---

## Game Logic Concepts

### Stats Calculation

**Formula:** `Effective Stat = Base Stat + (Level - 1) + Modifiers + Adjacency Bonuses`

- Base stats: Random 1-15 at birth
- Level: +1 to all stats per level (max 10)
- Modifiers: From PTSD system (grit adjustments)
- Adjacency: Territory defenders get +1 per adjacent controlled territory

### Battle Simulation

**Deterministic RNG:** Seed with battle ID. Same seed always produces same result.

**Turn order:** Speed stat determines order. Higher speed acts first.

**Grit checks:** Below 60% HP, roll flee check: `fight_chance = (current_hp / max_hp) + (grit * 0.4 / 15)`

**Permadeath:** 0 HP = permanent death (removed from inventory, recorded in graveyard).

**KO mechanic:** Below 30% HP, stability check on each hit. Fail = KO (survives at 1 HP).

### Memory/PTSD System

**Post-battle processing:**
- Check recent battle history
- Apply modifiers based on events (wins, kills, KOs, flees)
- Store in `gcm_modifiers` table
- Modifiers checked at battle start and applied to stats

**Examples:**
- Winning streak: +1 grit per win after 3rd
- Bloodlust: Kill 2+ opponents → +1 attack/sp.attack per kill when enemy <50% HP
- Type Trauma: 25% chance on KO → -1 grit vs that type
- Phobia: Flee 3+ times from same type → -10 grit vs that type

---

## Deployment

### Hosting (Render)

**Services:**
- Static Site: Frontend (Svelte + Phaser compiled to static files)
- Web Service: Backend API (Node.js/Express)
- Database: Supabase PostgreSQL (existing)

**Environment Variables:**
- Discord: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
- Database: `DATABASE_URL`
- Auth: `JWT_SECRET`
- CORS: `ALLOWED_ORIGINS=https://discord.com,https://*.discord.com`

### CI/CD

GitHub Actions triggers Render deployment on push to `main`:
1. Build frontend (`npm run build` in `/frontend`)
2. Deploy backend
3. Run migrations (`npx knex migrate:latest`)

**Pattern Reference:** Render's [automatic deployments from GitHub](https://render.com/docs/deploys)

### Scaling

**Phase 1-2 (MVP):** Single Render instance, Supabase free tier
**Phase 3 (Territory):** Upgrade Supabase, add Redis for locks
**Phase 4 (BR):** Separate WebSocket service, consider Agones for >100 concurrent BR sessions

---

## Security

### Authentication Flow

1. Frontend: Discord SDK gets OAuth2 code
2. Frontend: Sends code to backend `/api/auth/discord`
3. Backend: Exchanges code with Discord for access token
4. Backend: Verifies user, creates JWT
5. Frontend: Uses JWT for all subsequent API calls

**Never expose `DISCORD_CLIENT_SECRET` on frontend.**

**Pattern Reference:** [Robo.js Discord Authentication](https://robojs.dev/discord-activities/authentication)

### Authorization

- JWT middleware on all protected routes
- Ownership checks (e.g., can only breed your own GCMs)
- Rate limiting (prevent spam attacks on territories)

### Exploit Prevention

- Database transactions with row locks (`forUpdate()`) prevent double-spend
- Server-side battle logic prevents manipulation
- Event log provides immutable audit trail

---

## Performance

### Database Indexing

```sql
CREATE INDEX idx_gcms_owner ON gcms(owner_id);
CREATE INDEX idx_gcms_in_battle ON gcms(in_battle) WHERE in_battle = true;
CREATE INDEX idx_battles_status ON battles(status);
CREATE INDEX idx_territories_owner ON territories(owner_id);
CREATE INDEX idx_battles_log ON battles USING gin(battle_log);
```

### Caching

**Cache:** AI trainers, moves, abilities, territory adjacency (rarely changes)
**Don't cache:** GCM stats, player balances, battle state (frequently changes)

Use `node-cache` or Redis.

### Frontend Optimization

- Code-split Phaser scenes (lazy load only when entering battle)
- Svelte compiles to optimized vanilla JS (no runtime overhead)
- Tailwind CSS tree-shaking removes unused styles

---

## Monitoring & Observability

### Grafana LGTM Stack

**Three pillars of observability:**

1. **Logs (Grafana Loki)** - Label-based log aggregation, simpler than ELK
2. **Metrics (Prometheus/Mimir)** - Time-series metrics for performance and game events
3. **Traces (Tempo)** - Distributed tracing across services using OpenTelemetry

**All visualized in Grafana dashboards.**

### Deployment Strategy

**Phase 1-2 (MVP):** Render's built-in monitoring + file-based Winston logs
**Phase 2+ (Territory Launch):** Grafana Cloud free tier (50GB logs, 10k metrics series, 50GB traces/month)
**Phase 4+ (Production Scale):** Re-evaluate based on volume, consider self-hosting if needed

### Implementation Pattern

**Logs:** Winston transport sends JSON logs to Loki with labels (service, environment, log_level)
**Metrics:** Use `prom-client` library to expose `/metrics` endpoint, Grafana Cloud scrapes or use push gateway
**Traces:** OpenTelemetry auto-instrumentation for Express, PostgreSQL, HTTP calls

**Pattern References:**
- [winston-loki GitHub](https://github.com/JaniAnttonen/winston-loki)
- [Grafana Cloud Prometheus Integration](https://grafana.com/docs/grafana-cloud/send-data/metrics/metrics-prometheus/)
- [OpenTelemetry Node.js Auto-Instrumentation](https://opentelemetry.io/docs/instrumentation/js/getting-started/nodejs/)

### Key Metrics to Track

**API Performance:**
- `api_response_time_seconds` (histogram, by endpoint)
- `api_requests_total` (counter, by endpoint, status)
- `db_query_duration_seconds` (histogram, by query type)
- `db_connection_pool_active` (gauge)

**Game Metrics:**
- `battles_total` (counter, by type: ai, pvp, gym, br)
- `battle_duration_seconds` (histogram)
- `gcm_deaths_total` (counter)
- `gcm_created_total` (counter, by rarity)
- `gacha_purchases_total` (counter, by pack type)
- `territory_control_changes_total` (counter)
- `active_br_sessions` (gauge)
- `br_players_per_session` (histogram)

**Business Metrics:**
- `gc_spent_total` (counter, by transaction type)
- `gc_earned_total` (counter, by source)
- `active_users_daily` (gauge)
- `new_users_daily` (counter)

### Dashboard Examples

**GarryRoyale Health:**
- API response time (p50, p95, p99) by endpoint
- Error rate by endpoint
- Active users (current + 24h trend)
- Database connection pool usage

**Game Metrics:**
- Battles per hour (stacked by type)
- GCM deaths per hour
- Gacha purchases by rarity
- Territory control heatmap

**Battle Royale:**
- Active BR sessions (time series)
- Average players per session
- Session duration distribution
- Death causes (zone damage vs combat vs flee)

**Errors & Debugging:**
- Error logs by endpoint (Loki query)
- Failed database transactions
- OAuth failures
- WebSocket disconnection rate

**Reference:** [Grafana Dashboard Gallery](https://grafana.com/grafana/dashboards/)

### Cost Estimate

**Grafana Cloud Free Tier Limits:**
- 50GB logs/month
- 10,000 metrics series
- 50GB traces/month

**Estimated Usage (100 daily active users):**
- Logs: ~5-10GB/month (Winston JSON logs, INFO level)
- Metrics: ~500 series (API endpoints, DB queries, game stats)
- Traces: ~10GB/month (10% sampling rate)

**Verdict:** Free tier sufficient for MVP and early production. Adjust sampling if approaching limits.

### Tracing Example

**Typical trace flow for pack opening:**
```
User opens pack
└─ POST /api/gcm/gacha [200ms]
   ├─ JWT validation [5ms]
   ├─ Check GC balance [20ms] → SELECT from balances
   ├─ Deduct GC [15ms] → UPDATE balances, INSERT transaction
   ├─ Generate GCMs [10ms] → Random stat rolls
   ├─ Insert GCMs [30ms] → INSERT into gcms (batch)
   └─ Return response [120ms]
```

**Enables debugging:** "Why is pack opening slow?" → See database query taking 80ms → Optimize query or add index.

---

## Development Workflow

### Docker Compose Setup

**Philosophy:** Everything starts with a single command: `docker compose up --build`

GarryRoyale extends the existing GarryCoin docker-compose.yml with new services:

**New Services:**
- `garryroyale-frontend` - Svelte + Phaser app (Vite dev server)
- `garryroyale-api` - Express backend (Node.js)
- `garryroyale-migrations` - Knex migrations for GarryRoyale tables

**Shared Services:**
- `db` - PostgreSQL (existing, shared with GarryCoin bot)
- `ngrok` - Optional, for Discord Activity testing

**Pattern:** Follow existing docker-compose.yml structure:
- Services depend on `db` with health checks
- Migrations run automatically when db is healthy
- Hot-reload enabled via volume mounts for `/src`
- Environment variables from `.env` file

### Local Development Commands

**Start everything:**
```bash
docker compose up --build
```

**Run migrations only:**
```bash
docker compose run garryroyale-migrations
```

**View logs:**
```bash
docker compose logs -f garryroyale-api
docker compose logs -f garryroyale-frontend
```

**Stop everything:**
```bash
docker compose down
```

**Reset database (destructive):**
```bash
docker compose down -v  # Removes volumes
docker compose up --build
```

### Environment Configuration

**Required in `.env`:**
- `DISCORD_CLIENT_ID` - Discord Activity app ID
- `DISCORD_CLIENT_SECRET` - For OAuth2 token exchange
- `DISCORD_PUBLIC_KEY` - For request verification
- `JWT_SECRET` - For session tokens
- Database credentials (inherited from existing GarryCoin setup)

### Testing

**Unit Tests:** Battle simulation, stat calculations, modifier logic
**Integration Tests:** API endpoints, database transactions, OAuth flow
**E2E Tests (Playwright):** Pack opening, battle flow, territory claiming

**Run tests in Docker:**
```bash
docker compose run garryroyale-api npm test
```

---

## Integration with GarryCoin

### Shared Database

GarryRoyale adds new tables to existing GarryCoin database. Shares `users`, `balances`, `transactions`.

### GC Transfers

Use existing GarryCoin transfer functions:
- Gacha purchase: `db.transfer(playerId, 'house', 10_000_000, 'gacha_purchase')`
- AI victory: `db.grant(playerId, 5_000_000, 'ai_victory')`
- Territory income: `db.grant(playerId, income, 'territory_income')`

### Discord Bot Integration

Add `/garryroyale` slash command to existing bot that replies with Activity launch button.

## References & Resources

### Discord Activities
- [Discord Activities Overview](https://discord.com/developers/docs/activities/overview)
- [Discord Embedded App SDK](https://github.com/discord/embedded-app-sdk)
- [How Activities Work](https://discord.com/developers/docs/activities/how-activities-work)
- [Building an Activity Tutorial](https://discord.com/developers/docs/activities/building-an-activity)

### Frontend
- [Svelte Tutorial](https://svelte.dev/tutorial)
- [Phaser Discord Activity Tutorial](https://phaser.io/news/2024/11/build-a-discord-activity-with-phaser)
- [Phaser 3 Documentation](https://photonstorm.github.io/phaser3-docs/)

### Authentication & Multiplayer
- [Discord OAuth2 Guide](https://discordjs.guide/oauth2/)
- [Robo.js Discord Authentication](https://robojs.dev/discord-activities/authentication)
- [Adding Multiplayer to Discord Activities](https://dev.to/waveplay/how-to-add-multiplayer-to-your-discord-activity-lo1)

### Development
- [Discord 2025 Development Guide](https://discord-media.com/en/news/development-2025-the-complete-year-in-review-api-migration-guide.html)
- [Getting Started Activity Template](https://github.com/discord/getting-started-activity)

---

Version: 2.3
Date: 2025-12-29

**Stack:** Svelte + Phaser + Express + PostgreSQL

END OF DOCUMENT
