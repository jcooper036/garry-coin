/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('wavelength_games', function(table) {
    table.increments('id').primary();
    table.string('host_user_id').notNullable();
    table.string('channel_id').notNullable();
    table.string('message_id').notNullable();
    table.string('status').notNullable();
    table.integer('wager').notNullable();
    table.string('scale_left').notNullable();
    table.string('scale_right').notNullable();
    table.integer('target_number').notNullable();
    table.string('host_word').notNullable();
    table.boolean('show_player_guesses').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('wavelength_games');
};
