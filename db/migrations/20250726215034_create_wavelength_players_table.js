/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('wavelength_players', function(table) {
    table.increments('id').primary();
    table.integer('game_id').unsigned().notNullable().references('id').inTable('wavelength_games').onDelete('CASCADE');
    table.string('user_id').notNullable();
    table.string('player_status').notNullable();
    table.integer('guess');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['game_id', 'user_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('wavelength_players');
};
