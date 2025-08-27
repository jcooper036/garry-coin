/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return Promise.all([
    // Change balance column in users table
    knex.schema.alterTable('users', function(table) {
      table.bigInteger('balance').defaultTo(0).alter();
    }),
    
    // Change amount column in transactions table
    knex.schema.alterTable('transactions', function(table) {
      table.bigInteger('amount').notNullable().alter();
    }),
    
    // Change wager column in bus_games table
    knex.schema.alterTable('bus_games', function(table) {
      table.bigInteger('wager').notNullable().alter();
    }),
    
    // Change wager column in wavelength_games table
    knex.schema.alterTable('wavelength_games', function(table) {
      table.bigInteger('wager').notNullable().alter();
    }),
    
    // Change amount columns in loans table
    knex.schema.alterTable('loans', function(table) {
      table.bigInteger('amount').notNullable().alter();
      table.bigInteger('amount_paid').defaultTo(0).alter();
    }),
    
    // Change reward_amount column in wordle_rewards table
    knex.schema.alterTable('wordle_rewards', function(table) {
      table.bigInteger('reward_amount').notNullable().alter();
    }),
    
    // Change fine_amount column in sql_ban_events table
    knex.schema.alterTable('sql_ban_events', function(table) {
      table.bigInteger('fine_amount').notNullable().alter();
    }),
    
    // Change bribe_amount column in release_files_cases table
    knex.schema.alterTable('release_files_cases', function(table) {
      table.bigInteger('bribe_amount').defaultTo(0).alter();
    })
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return Promise.all([
    // Revert balance column in users table
    knex.schema.alterTable('users', function(table) {
      table.integer('balance').defaultTo(0).alter();
    }),
    
    // Revert amount column in transactions table
    knex.schema.alterTable('transactions', function(table) {
      table.integer('amount').notNullable().alter();
    }),
    
    // Revert wager column in bus_games table
    knex.schema.alterTable('bus_games', function(table) {
      table.integer('wager').notNullable().alter();
    }),
    
    // Revert wager column in wavelength_games table
    knex.schema.alterTable('wavelength_games', function(table) {
      table.integer('wager').notNullable().alter();
    }),
    
    // Revert amount columns in loans table
    knex.schema.alterTable('loans', function(table) {
      table.integer('amount').notNullable().alter();
      table.integer('amount_paid').defaultTo(0).alter();
    }),
    
    // Revert reward_amount column in wordle_rewards table
    knex.schema.alterTable('wordle_rewards', function(table) {
      table.integer('reward_amount').notNullable().alter();
    }),
    
    // Revert fine_amount column in sql_ban_events table
    knex.schema.alterTable('sql_ban_events', function(table) {
      table.integer('fine_amount').notNullable().alter();
    }),
    
    // Revert bribe_amount column in release_files_cases table
    knex.schema.alterTable('release_files_cases', function(table) {
      table.integer('bribe_amount').defaultTo(0).alter();
    })
  ]);
};
