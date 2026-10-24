# AI's Plan: Wordle missed rewards (fix + tally)

Status: IMPLEMENTED (fix). Original hypotheses below were code-derived; see "Prod cross-check" at the end for what the data showed.

## What the code does today (`src/bot.js`, `src/wordle_handler.js`, `db.processWordleTransaction`)
1. `messageCreate` and `messageUpdate` both call `processWordleMessage`.
2. Trigger: content contains `Your group is on a` AND author id is in `WORDLE_BOT_IDS`.
3. `parseWordleResults`: skips line 1, `split(':')` per line, regex `(\d+|X)/6`, only IDs present in `message.mentions.users`.
4. Per user, sequentially: 20% random "cheat" roll, `getUser`, `processWordleTransaction` (balance update + `transactions` + `wordle_rewards` insert). One report message at the end.
5. No dedupe. The once-a-day check (`checkWordleDay`) was removed in `70be718`, and `wordle_rewards` unique constraint was dropped in `20250815000448`.

## Hypotheses for "missed rewards" (ranked by how plausible they are from code alone)
| # | Cause | Effect | Evidence in code |
|---|-------|--------|------------------|
| H1 | Exception mid-loop (`processWordleTransaction` throws for one user) | Remaining users in the message get nothing, no report, only `error.message` logged | No try/catch inside the `for` loop; caught once in `bot.js` |
| H2 | Result user not in `users` table | `increment` hits 0 rows, `wordle_rewards` row is written, balance never changes. Looks rewarded, isn't | `findOrCreateUser` is never called in the handler |
| H3 | Bot offline/redeploying when the daily message posts | Whole day lost, nothing to retry | No startup catch-up / backfill |
| H4 | Message format variant not matching trigger string or parser | Whole message ignored, only a `structuredLog.wordle` line | `includes('Your group is on a')`, `.slice(1)`, `split(':')` |
| H5 | Wordle bot edits message after posting (adds late players) | Late players covered via `messageUpdate`, but everyone already paid is paid again (duplicates, the inverse bug) | no dedupe |
| H6 | Mentions not resolvable (user left guild, name text instead of `<@id>`) | User silently dropped from `results` | parser only keeps IDs in `mentions` |
| H7 | 20% "cheat" roll replaces reward with a fine | Perceived as a miss; by design | `CHEAT_CHANCE` |
| H8 | Missing/incorrect `WORDLE_BOT_IDS` in prod env | Real messages treated as spoofs | `.env` parsing in `bot.js` |

## Proposed behavior fix (pending confirmation of which hypotheses are real)
- Idempotency key per `(user_id, wordle message id)` instead of per day. Store `source_message_id` on `wordle_rewards` (new migration), unique index. This fixes H5 and makes retries safe.
- `findOrCreateUser` before paying (H2).
- Per-user try/catch in the loop; a failure for one user never blocks the rest, and failures are recorded (see tally) (H1).
- Startup + periodic reconciliation: fetch recent channel history for Wordle-bot messages, process any whose message id has no rows (H3).
- Harden trigger/parser against format variants; log the raw content of any message from a Wordle bot ID that does not parse (H4, H6).
- Do not touch `CHEAT_CHANCE` behavior (H7) unless asked.

## Tally design
Define a "miss" = a user listed in a Wordle-bot result message for which we have no successful `wordle_rewards` row keyed to that message.
- New table `wordle_misses` (`user_id`, `source_message_id`, `reason`, `detected_at`, `recovered_at`).
- Live: written by the handler on any failure path.
- Historical: one-off backfill script that walks channel history through the Discord API, parses each Wordle-bot message, diffs against `wordle_rewards` by `(user_id, date)` and prints/saves a per-user tally. Needs read-message-history on the prod bot token and the channel id (neither is in the local environment).
- Surfacing: bot CLI command (admin, like `src/bot_cli.js`) for per-user counts. Optional slash command only if asked.

## Open questions
- Which of H1-H8 does the user actually observe? (e.g. "no reply message at all" vs "reply but wrong amounts" vs "only some users missing")
- Is a retroactive payout for historical misses wanted, or tally only?
- Prod DB / channel access for the backfill: who runs it?

## Findings: audit run 2026-10-23 (`node src/wordle_audit.js`, Discord history, read-only)
Method: a user listed in a Wordle-bot results message is "missed" if no GarryCoin report-shaped reply (`solved the Wordle in` / `knew too many words` / `Cheating detected`) follows before the next results message (max 24h).
- 513 trigger messages, 503 with at least one mappable player. 42 of those (8.3%) got no GarryCoin reply at all. Zero partial replies.
- Era split: through 2025-09-06, 20 of 66 days missed (30%). Since 2025-09-07, 22 of 437 (5.0%); in 2026, 20 of 298 (6.7%).
- Player-days missed: 298 of 2798 (10.7%) overall; 133 of 2351 (5.7%) since 2025-09-07.
- 10 trigger messages list players only as plain text `@Name` (no `<@id>`); nothing to map, so they are excluded from the tally.
- Ruled out at the Discord-visible level: H4 (no near-miss formats), H6 for mapped users (parser dropped nobody), H5 (Wordle bot never edited a message), partial-loop failures that still reply.
- Still open: H3 (bot down / missed gateway event) vs H1/H2 (exception or DB failure aborting before the report). A throw after some users were paid would show here as a "miss" even though rewards were paid, so the tally is an upper bound until checked against `wordle_rewards`.
- Time of day does not separate missed from hit days (both cluster 10-14 UTC).

## Prod cross-check (`wordle_rewards`, read-only) and implemented fix
- Of 298 Discord-visible missed player-days: 144 were paid but got no report, 154 were never paid (126 before 2025-09-07, 28 since).
- Every missed day since 2025-09-07 has the same shape: a prefix of users paid, the trailing 1-2 unpaid, no report. That is an exception partway through the payout loop (H1); the report is only sent after the loop.
- Implemented: per-user isolation with 3 attempts and backoff, `findOrCreateUser` before paying, report always sent and names users it could not process, and idempotency per `(user_id, source_message_id)` via migration `20261023010000_add_source_message_id_to_wordle_rewards.js` (claim row first, `ON CONFLICT DO NOTHING`).
- Not implemented: startup catch-up from channel history, a persisted misses table (the audit script is the tally), retroactive payout.
