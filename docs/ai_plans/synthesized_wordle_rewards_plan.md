# Synthesized Plan for Wordle Rewards Feature

This plan combines the user's high-level strategy with the AI's detailed implementation proposals.

## 1. Listener & Verification (in `src/bot.js`)
- The `messageCreate` event listener in `src/bot.js` will be the entry point.
- It will first check if the message author is a bot and if the author's ID matches the known ID of the Wordle bot. This prevents other users or bots from triggering the reward logic.
    - We should allow for an array of "approved_ids", which will help with testing (since we don't have the wordle bot in our testing server). practically, this will be just the wordle bot and a user that we designate for testing
    - I want people to be punished if they are not on the approved list and try to do this. If we detect any other user doing this, we should make a public message that calls them out for cheating, and subtracts 10 GC from their account. The transaction type for this is "attempted_hacking", and we don't need to track it other than the transaction table. This will be as a transfer to the GarryCoin bot from that users account
- It will then check if the message content matches the Wordle results template (e.g., starts with `Your group is on a`).
- **Configuration**: We will add a `WORDLE_BOT_IDS` variable to our `.env` file to store a comma-separated list of approved user/bot IDs.

## 2. Idempotency & History (Database)
- We'll create a new database migration for a `wordle_rewards` table. This table will track daily rewards and prevent duplicates.
- **Schema**: `id`, `user_id`, `reward_date`, `tries`, `reward_amount`, `was_caught_cheating`.
- Before processing, we'll check this table to ensure we haven't already processed a reward for that day.

## 3. Parsing & Logic (new `src/wordle_handler.js`)
- To keep `bot.js` clean, the core logic will live in a new `src/wordle_handler.js`.
- This module will parse the message, using `message.mentions.users` to reliably map display names to user IDs.
- For each user mentioned, it will:
    - Determine their score (number of tries).
    - Run the 20% "cheat detection" random check.
    - Calculate the final coin adjustment (+reward or -penalty).

## 4. Database Transactions (in `src/db.js`)
- We'll create a new function, likely `processWordleReward`, that handles all database changes for a single user in an atomic transaction.
- This will update the user's balance, record the transaction in the `transactions` table (with `wordle_reward` or `wordle_cheat_fine` types), and log the event in our new `wordle_rewards` table.

## 5. Reporting (in `src/wordle_handler.js`)
- After processing all users from the message, the handler will build a summary string.
- This string will detail who received rewards and who was "caught cheating."
- The `bot.js` listener will then post this summary message to the channel.
