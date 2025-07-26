# Ride the Bus Game Implementation Plan (Synthesized Approach)

## Overview
This plan outlines the implementation of the "Ride the Bus" game using a materialized state stored in dedicated database tables. A key aspect of this approach is leveraging the Discord message ID as the unique identifier for each game, simplifying state management and linking directly to Discord interactions. This provides persistence, efficient state access for real-time interactions, and a clear path for future enhancements.

## Database Schema

### 1. `bus_games` Table
- Stores the overall state of each "Ride the Bus" game.
- **Columns:**
    - `message_id`: `VARCHAR`, Primary Key. This will be the Discord message ID of the main game interaction message, serving as the unique game identifier.
    - `host_user_id`: `VARCHAR`, Discord user ID of the game initiator (FK to `users.user_id`).
    - `channel_id`: `VARCHAR`, Discord channel ID where the game is played.
    - `status`: `VARCHAR`, e.g., `waiting_for_players`, `active`, `finished`, `cancelled`.
    - `current_phase`: `VARCHAR`, e.g., `color`, `higher_lower`, `inside_outside`, `suit`.
    - `current_cards`: `JSONB`, an array storing the drawn cards (e.g., `[{ suit: "hearts", rank: "A" }, { suit: "spades", rank: "K" }]`).
    - `created_at`: `TIMESTAMP`, default to `now()`.
    - `updated_at`: `TIMESTAMP`, default to `now()`.

### 2. `bus_game_players` Table
- Stores the state of each player within a specific "Ride the Bus" game.
- **Columns:**
    - `id`: Primary Key, auto-incrementing integer.
    - `game_message_id`: `VARCHAR`, Foreign Key referencing `bus_games.message_id`.
    - `user_id`: `VARCHAR`, Discord user ID of the player (FK to `users.user_id`).
    - `wager`: `INTEGER`, the amount of GC the player bet.
    - `stops_rode`: `INTEGER`, number of successful rounds completed by the player.
    - `player_status`: `VARCHAR`, e.g., `on_bus`, `cashed_out`, `dead_in_road`.
    - `last_action_at`: `TIMESTAMP`, timestamp of the player's last valid input (for timeout checks).
    - `joined_at`: `TIMESTAMP`, default to `now()`.
    - `UNIQUE(game_message_id, user_id)`: Ensures a player can only join a specific game once.

## Knex Migrations
- Create two new migration files:
    - `YYYYMMDDHHMMSS_create_bus_games_table.js`
    - `YYYYMMDDHHMMSS_create_bus_game_players_table.js`

## `src/db.js` Enhancements
- Add new functions to interact with the `bus_games` and `bus_game_players` tables:
    - `createBusGame(messageId, hostId, channelId, wager)`: Inserts a new game record and the host player.
    - `getBusGame(messageId)`: Retrieves a game by its message ID.
    - `getActiveBusGame()`: Retrieves the single active game (if any) by checking for `status` not equal to `finished` or `cancelled`.
    - `updateBusGame(messageId, updates)`: Updates game status, phase, cards, etc.
    - `addPlayerToBusGame(gameMessageId, userId, wager)`: Adds a player to an existing game.
    - `getBusGamePlayers(gameMessageId)`: Retrieves all players for a given game.
    - `updateBusGamePlayer(gamePlayerId, updates)`: Updates player status, stops rode, last action.
    - `getBusGamePlayer(gameMessageId, userId)`: Retrieves a specific player's state in a game.

## Concurrency Control
- When a user attempts to start a new game, query the `bus_games` table for any game with `status` not equal to `finished` or `cancelled`.
- If an active game exists, reject the new game request with the "you need to wait for the next bus" message.
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
    - Send the initial Discord message: "<@USER> has hailed the bus for a fare of X GC - who else wants on?" with a "Ride the Bus" button. **Crucially, capture the `message.id` from the response.**
    - Call `db.createBusGame()` to insert the new game and host player into the database, using the captured `message.id` as the `game_message_id`.
    - Start a `setTimeout` for 10 seconds to allow players to join, passing the `message.id` to the callback.

### 3. Discord Interaction Handling (`src/index.js`)
- **`MESSAGE_COMPONENT` handler:**
    - Extend the existing `MESSAGE_COMPONENT` handler to process buttons related to "Ride the Bus".
    - Button `custom_id`s will encode the `game_message_id`, the action (e.g., `join_bus`, `pick_red`, `cash_out`), and potentially the specific choice. Example: `ridethebus_join_<game_message_id>`.
    - **"Ride the Bus" button:**
        - Retrieve `game_message_id` from `custom_id`.
        - Call `db.addPlayerToBusGame()` to add the clicking player.
        - Fetch updated game state and players from DB.
        - Update the main game message to show the new player on the bus.
    - **Phase-specific buttons (Red/Black, Higher/Lower, Inside/Outside, Suit, Cash Out):**
        - Retrieve `game_message_id` and player `userId` from interaction.
        - Fetch player's state from `bus_game_players`.
        - Validate that the interaction is from a player currently `on_bus` in the game.
        - Update the player's state in `bus_game_players` using `db.updateBusGamePlayer()` based on their choice.
        - Update `last_action_at` for the player.

### 4. Game Logic and Phase Transitions (New Helper Functions)
- Create helper functions (e.g., `startGamePhase`, `processPhaseResults`, `drawCard`, `determineOutcome`) that operate on the database state.
- These functions will be called by `setTimeout` callbacks and button interaction handlers.
- **`startGamePhase(gameMessageId, phase)`:**
    - Fetches game state from `bus_games`.
    - Draws cards as needed and updates `current_cards` in `bus_games`.
    - Updates the main game message (using `gameMessageId`) with the current sequence and new buttons for player choices.
    - Sets a new `setTimeout` for 10 seconds, passing `gameMessageId` to the callback.
- **`processPhaseResults(gameMessageId)` (called by timeout):**
    - Fetches all players for `gameMessageId` from `bus_game_players`.
    - For players `on_bus` who did not provide input within the 10-second window, or whose input was incorrect, update their `player_status` to `dead_in_road` in `bus_game_players`.
    - Updates the main game message with player status changes.
    - Transitions the game to the next phase (updating `current_phase` in `bus_games`) or ends the game if all players are `cashed_out` or `dead_in_road`.
- **Card Logic:** Implement functions to simulate drawing cards from a fresh deck, determine color, compare ranks, and check inside/outside ranges.

### 5. Payouts and Game End
- When the game ends (either all players are out, or the final suit phase completes):
    - Fetch all players for the `gameMessageId` from `bus_game_players`.
    - For `dead_in_road` players, use `db.transfer` to deduct their `wager` (sending to a "house" ID).
    - For `cashed_out` players, use `db.grant` to give them rewards based on `stops_rode`.
    - For players who made it to the end, use `db.grant` for the 9x reward.
    - Update the main game message with the final results, including "Made it to their stop" and "Dead in the road" sections.
    - Update the `status` of the game to `finished` in `bus_games`.

## Crash Recovery
- On bot startup, query the `bus_games` table for any games with a `status` not equal to `finished` or `cancelled`.
- For each such game, attempt to resume its state or mark it as `cancelled` if it's too old or in an unrecoverable state. This might involve re-sending the last game message or simply informing the channel that the game was interrupted.

## Future Considerations
- The `game_events` log concept is valuable for auditing and replayability. Once the core game functionality is stable, we can consider adding a separate `game_events` table to record significant game events (e.g., game started, player joined, card drawn, player action, phase transition, game ended) without using it for primary state reconstruction. This would serve as a robust audit trail.