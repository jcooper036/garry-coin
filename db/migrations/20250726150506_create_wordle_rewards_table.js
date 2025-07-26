/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('wordle_rewards', function(table) {
    table.increments('id').primary();
    table.string('user_id').notNullable();
    table.date('reward_date').notNullable();
    table.integer('tries').notNullable();
    table.integer('reward_amount').notNullable();
    table.boolean('was_caught_cheating').defaultTo(false);
    table.timestamps(true, true);
    table.unique(['user_id', 'reward_date']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('wordle_rewards');
};