/**
 * Idempotency key for Wordle payouts: one row per (user, Wordle-bot message).
 * Existing rows keep NULL, and Postgres unique indexes treat NULLs as distinct,
 * so history is unaffected.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('wordle_rewards', function(table) {
    table.string('source_message_id');
    table.unique(['user_id', 'source_message_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('wordle_rewards', function(table) {
    table.dropUnique(['user_id', 'source_message_id']);
    table.dropColumn('source_message_id');
  });
};
