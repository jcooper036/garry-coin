# AI's Plan for Wordle Rewards Feature

## 1. Objective
Implement a feature to automatically reward users with GarryCoin based on their daily Wordle performance, including a "cheat detection" mechanism and public reporting.

## 2. Triggering Mechanism & User Identification
- **Listener**: The `emoji-bot` service (`src/bot.js`) will listen for `messageCreate` events.
- **Identification**: It will identify the Wordle bot's daily results message by checking `message.author.bot` and matching the message content against a specific pattern (e.g., starting with "Your group is on a").
- **User Mapping**: The bot will parse the `@mentions` in the message. The `message.mentions.users` collection provided by `discord.js` will be the source of truth for mapping mentioned names to their unique user IDs, which is crucial for database operations.

## 3. Database Schema Changes
A new database migration will be created to introduce a `wordle_rewards` table. This prevents processing the same day's results more than once.
- **Table**: `wordle_rewards`
- **Columns**:
    - `id`: (Primary Key)
    - `user_id`: (varchar, Foreign Key to `users.user_id`)
    - `reward_date`: (Date)
    - `tries`: (Integer)
    - `reward_amount`: (Integer)
    - `was_caught_cheating`: (Boolean)
    - `created_at`: (Timestamp)

## 4. Core Logic Implementation
1.  **Parsing**: A new function will be responsible for parsing the Wordle results message. It will extract the number of tries (1-6 or X) and the list of user IDs associated with each score.
2.  **Reward Calculation**: A function will map the number of tries to the corresponding GarryCoin reward amount as specified in the requirements.
3.  **Cheat Detection**: For each user who played, a `Math.random()` check will determine if they are flagged as a "cheater" (20% chance). If flagged, they will be penalized 5 GC instead of receiving a reward.
4.  **Transaction Handling**: For each user, all database updates will occur within a single atomic transaction to ensure data consistency. This includes:
    - Updating the user's `balance` in the `users` table.
    - Inserting a new record into the `wordle_rewards` table.
    - Inserting a corresponding record into the `transactions` table with a new `transaction_type` (e.g., `wordle_reward` or `wordle_cheat_fine`).

## 5. Reporting
- After processing all users from the message, the bot will construct a summary message.
- This message will be sent publicly to the same channel.
- It will detail the GC rewards distributed and explicitly name any users caught by the cheat detection system.

## 6. Code Structure & Modularity
- **New Module**: The core logic for this feature will be encapsulated in a new file, `src/wordle_handler.js`, to keep `src/bot.js` clean.
- **Database Functions**: All new database queries (e.g., for the `wordle_rewards` table) will be added to `src/db.js`.
- **Integration**: The `messageCreate` listener in `src/bot.js` will simply call the main function from `src/wordle_handler.js` when a valid Wordle message is detected.
