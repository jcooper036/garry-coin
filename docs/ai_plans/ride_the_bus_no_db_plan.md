# Ride the Bus Game Implementation Plan (No New Database Tables)

## Overview
This plan outlines the implementation of the "Ride the Bus" game without introducing any new database tables. Game state will be managed primarily in-memory, leveraging Discord message components and global variables for persistence within the bot's active runtime.

## Game State Management
- A single global JavaScript object, `activeBusGame`, will hold the entire state of the currently active game. This object will be initialized when a game starts and cleared when it ends.
- `activeBusGame` will contain:
    - `id`: A unique identifier for the game (e.g., timestamp).
    - `status`: Enum representing the current game phase (e.g., `waiting_for_players`, `picking_color`, `picking_higher_lower`, `picking_inside_outside`, `picking_suit`, `finished`).
    - `hostId`: The Discord user ID of the player who started the game.
    - `messageId`: The Discord message ID of the main game interaction message, which will be updated throughout the game.
    - `channelId`: The Discord channel ID where the game is being played.
    - `players`: A `Map` where keys are `userId`s and values are objects containing player-specific state:
        - `wager`: The amount of GC the player bet.
        - `stopsRode`: Number of successful rounds completed.
        - `currentStatus`: `on_bus`, `cashed_out`, `dead_in_road`.
        - `lastInputTime`: Timestamp of their last valid input (for timeout checks).
    - `currentCards`: An array of objects representing the cards drawn so far in the current game (e.g., `{ suit: "hearts", rank: "A" }`).
    - `currentPhaseTimeout`: A `setTimeout` ID to manage the 10-second decision windows.

## Concurrency Control
- A simple boolean flag, `isBusGameActive`, will be used. It will be set to `true` when a game starts and `false` when it ends.
- Any attempt to start a new game while `isBusGameActive` is `true` will be rejected with the "you need to wait for the next bus" message.

## Implementation Steps

### 1. Command Definition (`src/command_definitions.js`)
- Add a new slash command `/garryridethebus` with a required `wager` integer option.

### 2. New Command File (`src/commands/games/ridethebus.js`)
- Create this file to handle the `/garryridethebus` command.
- **`execute` function:**
    - Check `isBusGameActive`. If true, return the "wait for next bus" message.
    - Get `wager` from options.
    - Check player's balance using `db.getUser` and `db.transfer` (to deduct wager upfront or check for sufficient funds).
    - If insufficient funds, return "You're too poor..." message.
    - Set `isBusGameActive = true`.
    - Initialize the `activeBusGame` object.
    - Send the initial Discord message: "<@USER> has hailed the bus for a fare of X GC - who else wants on?" with a "Ride the Bus" button.
    - Store the `messageId` of this initial message in `activeBusGame.messageId`.
    - Start `activeBusGame.currentPhaseTimeout` for 10 seconds to allow players to join.

### 3. Discord Interaction Handling (`src/index.js`)
- **`MESSAGE_COMPONENT` handler:**
    - Extend the existing `MESSAGE_COMPONENT` handler to process buttons related to "Ride the Bus".
    - Button `custom_id`s will need to encode the game ID, the action (e.g., `join_bus`, `pick_red`, `cash_out`), and potentially other relevant data (e.g., `wager`). Example: `ridethebus_join_<gameId>`.
    - **"Ride the Bus" button:**
        - Add the clicking player to `activeBusGame.players` with their wager.
        - Update the main game message to show the new player on the bus.
    - **Phase-specific buttons (Red/Black, Higher/Lower, Inside/Outside, Suit, Cash Out):**
        - Validate that the interaction is from a player currently `on_bus` in `activeBusGame`.
        - Update the player's state in `activeBusGame.players` based on their choice.
        - Update `lastInputTime` for the player.

### 4. Game Logic and Phase Transitions (New Helper Functions)
- Create helper functions (e.g., `startGamePhase`, `processPhaseResults`, `drawCard`, `determineOutcome`) to manage game flow.
- These functions will be called by `setTimeout` callbacks and button interaction handlers.
- **`startGamePhase(phase)`:**
    - Draws cards as needed for the phase.
    - Updates the main game message with the current sequence and new buttons for player choices.
    - Sets a new `activeBusGame.currentPhaseTimeout` for 10 seconds.
- **`processPhaseResults()` (called by timeout):**
    - Iterates through `activeBusGame.players`.
    - For players `on_bus` who did not provide input within the 10-second window, or whose input was incorrect, move them to `dead_in_road`.
    - Updates the main game message with player status changes.
    - Transitions to the next phase or ends the game if all players are `cashed_out` or `dead_in_road`.
- **Card Logic:** Implement functions to simulate drawing cards from a fresh deck, determine color, compare ranks, and check inside/outside ranges.

### 5. Payouts and Game End
- When the game ends (either all players are out, or the final suit phase completes):
    - Iterate through all players in `activeBusGame.players`.
    - For `dead_in_road` players, use `db.transfer` to deduct their `wager` (sending to a "house" ID).
    - For `cashed_out` players, use `db.grant` to give them rewards based on `stopsRode`.
    - For players who made it to the end, use `db.grant` for the 9x reward.
    - Update the main game message with the final results, including "Made it to their stop" and "Dead in the road" sections.
    - Reset `isBusGameActive = false` and clear `activeBusGame`.

## Limitations
- **Volatile State:** If the bot restarts for any reason, the entire game state will be lost, and any active games will be interrupted.
- **Complex Button IDs:** As the game progresses, the `custom_id` for buttons might become very long to encode all necessary state, potentially hitting Discord's limits.
- **Scalability:** While only one game is active at a time, managing complex in-memory state for multiple concurrent games would be challenging with this approach.
- **Error Recovery:** No built-in mechanism to recover from errors during a game, leading to potential stuck games or inconsistent states.