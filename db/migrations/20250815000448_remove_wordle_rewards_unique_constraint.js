/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('wordle_rewards', function(table) {
    table.dropUnique(['user_id', 'reward_date']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('wordle_rewards', function(table) {
    table.unique(['user_id', 'reward_date']);
  });
};
