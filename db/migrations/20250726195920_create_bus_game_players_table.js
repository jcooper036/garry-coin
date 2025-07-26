exports.up = function(knex) {
  return knex.schema.createTable('bus_game_players', table => {
    table.increments('id').primary();
    table.integer('game_id').unsigned().notNullable().references('id').inTable('bus_games').onDelete('CASCADE');
    table.string('user_id').notNullable();
    table.string('player_status').notNullable().defaultTo('on_bus'); // on_bus, cashed_out, dead_in_road
    table.string('current_choice');
    table.integer('stops_rode').notNullable().defaultTo(0);
    table.timestamps(true, true);
    table.unique(['game_id', 'user_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('bus_game_players');
};