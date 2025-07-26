exports.up = function(knex) {
  return knex.schema.createTable('bus_games', table => {
    table.increments('id').primary();
    table.string('host_user_id').notNullable();
    table.string('channel_id').notNullable();
    table.string('message_id').notNullable();
    table.string('status').notNullable().defaultTo('waiting_for_players'); // waiting_for_players, active, finished, cancelled
    table.string('current_phase'); // color, higher_lower, inside_outside, suit
    table.jsonb('current_cards').defaultTo('[]');
    table.integer('wager').notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('bus_games');
};