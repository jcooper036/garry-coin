/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('sql_ban_events', function(table) {
    table.increments('id').primary();
    table.string('user_id').notNullable();
    table.text('attempted_query').notNullable();
    table.string('violation_type').notNullable(); // 'forbidden_keyword', 'dangerous_function', etc.
    table.string('violation_details').notNullable(); // specific keyword/function that triggered
    table.integer('ban_number').notNullable(); // 1st ban, 2nd ban, etc.
    table.integer('ban_duration_minutes').notNullable(); // 2, 4, 8, 16, etc.
    table.integer('fine_amount').notNullable(); // same as ban duration
    table.timestamp('banned_at').defaultTo(knex.fn.now());
    table.timestamp('ban_expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index('user_id');
    table.index('banned_at');
    table.index('ban_expires_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('sql_ban_events');
};
