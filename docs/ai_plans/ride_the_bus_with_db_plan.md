# Ride the Bus Game Implementation Plan (With New Database Tables)

## Overview
This plan outlines the implementation of the "Ride the Bus" game by persisting game state in new database tables. This approach provides resilience against bot restarts and a more structured way to manage complex game data.

## Database Schema

### 1. `bus_games` Table
- Stores the overall state of each "Ride the Bus" game.
- **Columns:**
    - `id`: Primary Key, auto-incrementing integer.
    - `host_user_id`: `VARCHAR`, Discord user ID of the game initiator (FK to `users.user_id`).
    - `channel_id`: `VARCHAR`, Discord channel ID where the game is played.
    - `message_id`: `VARCHAR`, Discord message ID of the main game interaction message.
    - `status`: `VARCHAR`, e.g., `waiting_for_players`, `active`, `finished`, `cancelled`.
    - `current_phase`: `VARCHAR`, e.g., `color`, `higher_lower`, `inside_outside`, `suit`.
    - `current_cards`: `JSONB`, an array storing the drawn cards (e.g., `[{ suit: "hearts", rank: "A" }, { suit: "spades", rank: "K" }]`).
    - `created_at`: `TIMESTAMP`, default to `now()`.
    - `updated_at`: `TIMESTAMP`, default to `now()`.

### 2. `bus_game_players` Table
- Stores the state of each player within a specific "Ride the Bus" game.
- **Columns:**
    - `id`: Primary Key, auto-incrementing integer.
    - `game_id`: `INTEGER`, Foreign Key referencing `bus_games.id`.
    - `user_id`: `VARCHAR`, Discord user ID of the player (FK to `users.user_id`).
    - `wager`: `INTEGER`, the amount of GC the player bet.
    - `stops_rode`: `INTEGER`, number of successful rounds completed by the player.
    - `player_status`: `VARCHAR`, e.g., `on_bus`, `cashed_out`, `dead_in_road`.
    - `last_action_at`: `TIMESTAMP`, timestamp of the player's last valid input (for timeout checks).
    - `joined_at`: `TIMESTAMP`, default to `now()`.
    - `UNIQUE(game_id, user_id)`: Ensures a player can only join a specific game once.

## Knex Migrations
- Create two new migration files:
    - `YYYYMMDDHHMMSS_create_bus_games_table.js`
    - `YYYYMMDDHHMMSS_create_bus_game_players_table.js`

## `src/db.js` Enhancements
- Add new functions to interact with the `bus_games` and `bus_game_players` tables:
    - `createBusGame(hostId, channelId, messageId, wager)`: Inserts a new game record and the host player.
    - `getBusGame(gameId)`: Retrieves a game by its ID.
    - `getActiveBusGame()`: Retrieves the single active game (if any).
    - `updateBusGame(gameId, updates)`: Updates game status, phase, cards, etc.
    - `addPlayerToBusGame(gameId, userId, wager)`: Adds a player to an existing game.
    - `getBusGamePlayers(gameId)`: Retrieves all players for a given game.
    - `updateBusGamePlayer(gamePlayerId, updates)`: Updates player status, stops rode, last action.
    - `getBusGamePlayer(gameId, userId)`: Retrieves a specific player's state in a game.

## Concurrency Control
- When a user attempts to start a new game, query the `bus_games` table for any game with `status = 'active'` or `status = 'waiting_for_players'`.
- If an active game exists, reject the new game request with the "wait for next bus" message.
- Use database transactions for creating new games and updating critical game state to ensure atomicity.

## Implementation Steps

### 1. Command Definition (`src/command_definitions.js`)
- Add a new slash command `/garryridethebus` with a required `wager` integer option.

### 2. New Command File (`src/commands/games/ridethebus.js`)
- Create this file to handle the `/garryridethebus` command.
- **`execute` function:**
    - Check for an `active` or `waiting_for_players` game using `db.getActiveBusGame()`.
    - Get `wager` from options.
    - Check player's balance using `db.getUser` and `db.transfer` (to deduct wager upfront or check for sufficient funds).
    - If insufficient funds, return "You're too poor..." message.
    - Send the initial Discord message: "<@USER> has hailed the bus for a fare of X GC - who else wants on?" with a "Ride the Bus" button.
    - Call `db.createBusGame()` to insert the new game and host player into the database. Store the returned `gameId`.
    - Start a `setTimeout` for 10 seconds to allow players to join, passing the `gameId` to the callback.

### 3. Discord Interaction Handling (`src/index.js`)
- **`MESSAGE_COMPONENT` handler:**
    - Extend the existing `MESSAGE_COMPONENT` handler to process buttons related to "Ride the Bus".
    - Button `custom_id`s will encode the `gameId`, the action (e.g., `join_bus`, `pick_red`, `cash_out`), and potentially the specific choice. Example: `ridethebus_join_<gameId>`.
    - **"Ride the Bus" button:**
        - Retrieve `gameId` from `custom_id`.
        - Call `db.addPlayerToBusGame()` to add the clicking player.
        - Fetch updated game state and players from DB.
        - Update the main game message to show the new player on the bus.
    - **Phase-specific buttons (Red/Black, Higher/Lower, Inside/Outside, Suit, Cash Out):**
        - Retrieve `gameId` and player `userId` from interaction.
        - Fetch player's state from `bus_game_players`.
        - Validate that the interaction is from a player currently `on_bus` in the game.
        - Update the player's state in `bus_game_players` using `db.updateBusGamePlayer()` based on their choice.
        - Update `last_action_at` for the player.

### 4. Game Logic and Phase Transitions (New Helper Functions)
- Create helper functions (e.g., `startGamePhase`, `processPhaseResults`, `drawCard`, `determineOutcome`) that operate on the database state.
- These functions will be called by `setTimeout` callbacks and button interaction handlers.
- **`startGamePhase(gameId, phase)`:**
    - Fetches game state from `bus_games`.
    - Draws cards as needed and updates `current_cards` in `bus_games`.
    - Updates the main game message with the current sequence and new buttons for player choices.
    - Sets a new `setTimeout` for 10 seconds, passing `gameId` to the callback.
- **`processPhaseResults(gameId)` (called by timeout):**
    - Fetches all players for `gameId` from `bus_game_players`.
    - For players `on_bus` who did not provide input within the 10-second window, or whose input was incorrect, update their `player_status` to `dead_in_road` in `bus_game_players`.
    - Updates the main game message with player status changes.
    - Transitions the game to the next phase (updating `current_phase` in `bus_games`) or ends the game if all players are `cashed_out` or `dead_in_road`.
- **Card Logic:** Implement functions to simulate drawing cards from a fresh deck, determine color, compare ranks, and check inside/outside ranges.

### 5. Payouts and Game End
- When the game ends (either all players are out, or the final suit phase completes):
    - Fetch all players for the `gameId` from `bus_game_players`.
    - For `dead_in_road` players, use `db.transfer` to deduct their `wager` (sending to a "house" ID).
    - For `cashed_out` players, use `db.grant` to give them rewards based on `stops_rode`.
    - For players who made it to the end, use `db.grant` for the 9x reward.
    - Update the main game message with the final results, including "Made it to their stop" and "Dead in the road" sections.
    - Update the `status` of the game to `finished` in `bus_games`.

## Advantages
- **Persistence:** Game state is preserved across bot restarts, allowing games to resume if the bot goes down.
- **Robustness:** Less prone to inconsistencies due to in-memory state issues.
- **Scalability (Future):** While the current requirement is one game at a time, a database-backed approach makes it easier to extend to multiple concurrent games in the future.
- **Auditability:** Game history and player performance can be easily queried from the database.

## Disadvantages
- **Increased Complexity:** Requires initial setup of database migrations and more extensive `db.js` functions.
- **Database Overhead:** Every state change requires a database write, which adds a small amount of overhead compared to in-memory operations.