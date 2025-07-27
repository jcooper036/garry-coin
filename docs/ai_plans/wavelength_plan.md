# Wavelength Game Implementation Plan

## Overview
This plan outlines the implementation of the Wavelength game, drawing inspiration from the existing "Ride the Bus" game's structure for state management, player interaction, and database integration. The game will involve a host setting up a scale and a word, with other players guessing a numerical position on that scale. Wagers will be collected and distributed to winners.

## Database Schema
Two new tables will be required, along with potential updates to existing ones. Migrations will be created for these.

### 1. `wavelength_games` Table
Stores the overall state of each Wavelength game.

- **Columns:**
    - `id`: Primary Key, auto-incrementing integer.
    - `host_user_id`: `VARCHAR`, Discord user ID of the game initiator.
    - `channel_id`: `VARCHAR`, Discord channel ID where the game is played.
    - `message_id`: `VARCHAR`, Discord message ID of the main game interaction message.
    - `status`: `VARCHAR`, (`waiting_for_host_input`, `waiting_for_players`, `guessing`, `finished`, `cancelled`).
    - `wager`: `INTEGER`, The wager amount for all players in the game.
    - `scale_left`: `VARCHAR`, Description for the left extreme of the scale.
    - `scale_right`: `VARCHAR`, Description for the right extreme of the scale.
    - `target_number`: `INTEGER`, The secret number (-3 to 3) chosen by the host.
    - `host_word`: `VARCHAR`, The word chosen by the host to fit the scale.
    - `show_player_guesses`: `BOOLEAN`, Whether player guesses are visible to others (default: false).
    - `created_at`: `TIMESTAMP`, default to `now()`.
    - `updated_at`: `TIMESTAMP`, default to `now()`.

### 2. `wavelength_players` Table
Stores the state of each player within a game.

- **Columns:**
    - `id`: Primary Key, auto-incrementing integer.
    - `game_id`: `INTEGER`, Foreign Key referencing `wavelength_games.id`.
    - `user_id`: `VARCHAR`, Discord user ID of the player.
    - `player_status`: `VARCHAR`, (`joined`, `guessed`).
    - `guess`: `INTEGER`, The player's numerical guess (-3 to 3).
    - `created_at`: `TIMESTAMP`, default to `now()`.
    - `updated_at`: `TIMESTAMP`, default to `now()`.
    - `UNIQUE(game_id, user_id)`: Ensures a player can only join a game once.

## Core Logic & `db.js` Functions

### New `db.js` Functions
- `createWavelengthGame(hostId, channelId, messageId, wager)`: Creates a new game.
- `getWavelengthGame(gameId)`: Retrieves a game by its ID.
- `getActiveWavelengthGame()`: Retrieves the current active/waiting game.
- `updateWavelengthGame(gameId, updates)`: Updates a game's state.
- `addPlayerToWavelengthGame(gameId, userId)`: Adds a new player to a game.
- `getWavelengthPlayers(gameId)`: Retrieves all players for a game.
- `updateWavelengthPlayer(gameId, userId, updates)`: Updates a player's state (e.g., their guess or status).
- `getWavelengthPlayer(gameId, userId)`: Retrieves a specific player's state.
- `cancelWavelengthGame(gameId)`: Sets game status to `cancelled`.

## Implementation Steps

### 1. Command: `/garrywavelength`
- **File:** `src/commands/games/wavelength.js`
- **Definition:** Add the command to `src/command_definitions.js` with a required `wager` integer option and optional `show_player_guesses` boolean option.
- **Execution Flow:**
    1.  Check for an existing active Wavelength game.
    2.  Check the host's balance.
    3.  Randomly select a scale from `assets/wavelength_scales.json` and a secret `target_number` from -3 to 3.
    4.  Send an **ephemeral message** to the host containing the full scale text, the secret number, and a button (`[Enter Your Word]`). This avoids Discord's 45-character limit for modal titles.

### 2. Host Setup Interaction (Button Click & Modal Submission)
- **File:** `src/index.js` (handle button and modal interactions)
- **`[Enter Your Word]` Button Click:**
    1.  When the host clicks the button from the ephemeral message, present them with a **Discord Modal**.
    2.  The modal will have a single text input prompting for their word.
- **Modal Submission:**
    1.  When the host submits the modal with their word:
        - Acknowledge the interaction with `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE`.
        - Transfer the `wager` from the host to the bot's account.
        - Call `createWavelengthGame()` with the host's input (scale, word, wager, etc.).
        - Set the game status to `waiting_for_players`.
        - Send the initial **public game message** with the scale, host's word, and a `[Join Game]` button.
        - Start a 10-minute timer for the game to automatically end if not revealed by the host.

### 3. Player Joining
- **File:** `src/index.js` (handle button interaction)
- **`Join Game` Button:**
    1.  Check the clicking user's balance.
    2.  `transfer()` their wager to the bot.
    3.  Call `addPlayerToWavelengthGame()`.
    4.  Update the main game message to show the number of players joined.
    5.  Respond to the interaction with an ephemeral message: "You've joined the Wavelength game! Make your guess."
    6.  Present the player with buttons for guessing (-3, -2, -1, 0, 1, 2, 3) via an ephemeral message or follow-up.

### 4. Player Guessing
- **File:** `src/index.js` (handle button interaction)
- **Guess Buttons (-3 to 3):**
    1.  Verify the interactor is a `joined` player in the game.
    2.  Update their `guess` in the `wavelength_players` table.
    3.  Update their `player_status` to `guessed`.
    4.  Respond ephemerally: "Your guess (${guess}) is locked in."
    5.  If `show_player_guesses` is true, update the main game message to show who has guessed (but not their specific guess).

### 5. Host Actions
- **File:** `src/index.js` (handle button interaction)
- **`Reveal Answer` Button (Host Only):**
    1.  Verify the interactor is the host.
    2.  Call `endWavelengthGame(gameId, client)`.

### 6. Game End and Payouts
- **File:** `src/commands/games/wavelength_helpers.js` (new file, similar to `ridethebus_helpers.js`)
- **`endWavelengthGame(gameId, client)`:**
    1.  Clear any active game timer.
    2.  Update the game `status` to `finished`.
    3.  Fetch all players and the game details.
    4.  Identify winners: host + players whose `guess` matches `target_number`.
    5.  Calculate total pot: `(number of players who joined + 1 (for host)) * wager`.
    6.  Distribute pot evenly among winners using `grant()`.
    7.  Update the final game message with:
        - The scale and host's word.
        - The target number.
        - All players' guesses.
        - A summary of winners and losers.
        - Disable all buttons.

This plan provides a structured approach to implementing the Wavelength game, leveraging existing patterns while addressing the unique mechanics and interaction flows required. The use of ephemeral messages for host setup and player confirmations will ensure a smooth user experience within Discord's interaction constraints.