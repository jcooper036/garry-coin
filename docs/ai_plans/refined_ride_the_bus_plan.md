# Refined Ride the Bus Game Implementation Plan

## Overview
This document provides a refined, robust plan for implementing the "Ride the Bus" game. The key changes from the previous plan are:
1.  **Host-Driven Progression:** Replaces fragile `setTimeout` calls for game rounds with a host-controlled "Reveal" button, making the game resilient to bot restarts.
2.  **Improved Interaction Flow:** Uses ephemeral messages to immediately acknowledge player actions, providing a better user experience and complying with Discord's 3-second interaction response window.
3.  **Enhanced DB Schema:** Adds columns to better manage player state and choices.
4.  **Clearer Game Flow:** Details the game states, including cancellation and payout logic.

## Database Schema
Two new tables are required. Migrations should be created for each.

### 1. `bus_games` Table
Stores the overall state of each "Ride the Bus" game.

- **Columns:**
    - `id`: Primary Key, auto-incrementing integer.
    - `host_user_id`: `VARCHAR`, Discord user ID of the game initiator.
    - `channel_id`: `VARCHAR`, Discord channel ID where the game is played.
    - `message_id`: `VARCHAR`, Discord message ID of the main game interaction message.
    - `status`: `VARCHAR`, (`waiting_for_players`, `active`, `finished`, `cancelled`).
    - `current_phase`: `VARCHAR`, (`color`, `higher_lower`, `inside_outside`, `suit`).
    - `current_cards`: `JSONB`, An array of drawn card objects, e.g., `[{ suit: "hearts", rank: "A" }]`.
    - `wager`: `INTEGER`, The wager amount for all players in the game.
    - `created_at`: `TIMESTAMP`, default to `now()`.
    - `updated_at`: `TIMESTAMP`, default to `now()`.

### 2. `bus_game_players` Table
Stores the state of each player within a game.

- **Columns:**
    - `id`: Primary Key, auto-incrementing integer.
    - `game_id`: `INTEGER`, Foreign Key referencing `bus_games.id`.
    - `user_id`: `VARCHAR`, Discord user ID of the player.
    - `player_status`: `VARCHAR`, (`on_bus`, `cashed_out`, `dead_in_road`).
    - `current_choice`: `VARCHAR`, The player's choice for the current round (e.g., `red`, `higher`).
    - `stops_rode`: `INTEGER`, Number of successful rounds completed.
    - `joined_at`: `TIMESTAMP`, default to `now()`.
    - `UNIQUE(game_id, user_id)`: Ensures a player can only join a game once.

---

## Core Logic & `db.js` Functions

- **Card Logic:** Card draws will be simulated from a fresh 52-card deck for each draw. This avoids the complexity of managing a persistent deck state.
- **Concurrency:** A check against the `bus_games` table for any game with `status = 'waiting_for_players'` or `status = 'active'` must be performed before creating a new game.

### New `db.js` Functions
- `createBusGame(hostId, channelId, messageId, wager)`: Creates a new game and adds the host as the first player.
- `getBusGame(gameId)`: Retrieves a game by its ID.
- `getActiveBusGame()`: Retrieves the current active/waiting game.
- `updateBusGame(gameId, updates)`: Updates a game's state.
- `addPlayerToBusGame(gameId, userId, wager)`: Adds a new player to a game.
- `getBusGamePlayers(gameId)`: Retrieves all players for a game.
- `updateBusGamePlayer(gameId, userId, updates)`: Updates a player's state (e.g., their choice or status).
- `getBusGamePlayer(gameId, userId)`: Retrieves a specific player's state.
- `cancelBusGame(gameId)`: Sets game status to `cancelled`.

---

## Refined Implementation Steps

### 1. Command: `/garryridethebus`
- **File:** `src/commands/games/ridethebus.js`
- **Definition:** Add the command to `src/command_definitions.js` with a required `wager` integer option.
- **Execution Flow:**
    1.  Check for an existing active game using `getActiveBusGame()`. If one exists, reply with "You need to wait for the next bus." and stop.
    2.  Check the host's balance. If it's less than `wager`, reply with "You're too poor..." and stop.
    3.  Use a database transaction:
        - Call `transfer()` to move the `wager` from the host to the bot's account. This secures the bet.
        - Call `createBusGame()` to create the game and the host player entry.
    4.  Send the initial game message: `<@USER> has hailed the bus for a fare of X GC! Who else is getting on?`
    5.  Add two buttons: `[Join Bus]` and `[Cancel Bus]` (for the host only).
    6.  Start a `setTimeout` for the join period.

### 2. Interaction: Joining and Starting
- **`Join Bus` Button:**
    1.  Check the clicking user's balance.
    2.  `transfer()` their wager to the bot.
    3.  Call `addPlayerToBusGame()`.
    4.  Update the main game message to add their name to the "On the bus" list.
    5.  Respond to the interaction with an ephemeral message: "You're on the bus! Your fare has been paid."
- **`Cancel Bus` Button (Host Only):**
    1.  Verify the interactor is the game host.
    2.  Call `cancelBusGame()`.
    3.  Refund the wager to all players who joined (including the host).
    4.  Update the message to "The bus was cancelled. All fares refunded." and disable buttons.
- **Join Timeout:**
    1.  When the `setTimeout` from step 1 fires, fetch the game players.
    2.  If only the host is in the game, cancel it automatically (refund host, update message).
    3.  Otherwise, call `startNextPhase(gameId)`.

### 3. Game Progression: Phases and Player Actions
- **`startNextPhase(gameId, phase)`:**
    1.  Update the game's `current_phase` in the database.
    2.  Draw the required card(s) and update `current_cards`.
    3.  Update the main game message with the new state: show drawn cards, player lists, and new action buttons for the phase (e.g., `[Red]`, `[Black]`).
    4.  Crucially, add a `[Reveal Next Card]` button, which should only be enabled for the host.
- **Player Action Buttons (e.g., `Red`, `Higher`, `Cash Out`):**
    1.  Verify the interactor is an `on_bus` player in the game.
    2.  If the choice is to cash out:
        - Update their `player_status` to `cashed_out`.
        - Record their `stops_rode` based on the current phase.
        - Respond ephemerally: "You got off the bus safely."
    3.  If it's a game choice (e.g., "Red"):
        - Update their `current_choice` in the `bus_game_players` table.
        - Respond ephemerally: "Your choice (Red) is locked in."
- **`Reveal Next Card` Button (Host Only):**
    1.  Verify the interactor is the host.
    2.  Draw the outcome card.
    3.  For each player `on_bus`:
        - Determine if their `current_choice` was correct.
        - If incorrect or `null` (no choice), update their `player_status` to `dead_in_road`.
        - If correct, increment their `stops_rode`.
        - Reset their `current_choice` to `null`.
    4.  Check for game end conditions (all players are `cashed_out` or `dead_in_road`, or final phase is complete).
    5.  If the game is over, call `endGame(gameId)`.
    6.  Otherwise, call `startNextPhase(gameId)` for the next phase.

### 4. Game End and Payouts
- **`endGame(gameId)`:**
    1.  Update the game `status` to `finished`.
    2.  Fetch all players.
    3.  Calculate payouts based on final `player_status` and `stops_rode`:
        - `dead_in_road`: No refund (wager was already taken).
        - `cashed_out` / `end_of_line`: Grant a reward using `grant()` based on the payout structure (1x, 2x, 4x, 9x).
    4.  Update the final game message with a summary of winners and losers. Disable all buttons.

This host-driven, database-centric model ensures game state is always consistent and recoverable, providing a much more stable foundation for the feature.