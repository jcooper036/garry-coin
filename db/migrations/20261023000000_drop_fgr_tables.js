/**
 * Federal GarryCoin Reserve removed. Drops its tables.
 * `down` restores the empty schema only; data is not recoverable.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.dropTableIfExists('fgr_policies');
  await knex.schema.dropTableIfExists('fgr_votes');
  await knex.schema.dropTableIfExists('fgr_events');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.createTable('fgr_events', table => {
    table.increments('id').primary();
    table.string('event_type').notNullable();
    table.text('description').notNullable();
    table.json('event_data');
    table.integer('coins_distributed').defaultTo(0);
    table.integer('users_affected').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('fgr_votes', table => {
    table.increments('id').primary();
    table.string('policy_type').notNullable();
    table.string('user_id').notNullable();
    table.string('vote_choice').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['policy_type', 'user_id']);
  });

  await knex.schema.createTable('fgr_policies', table => {
    table.increments('id').primary();
    table.string('policy_name').notNullable().unique();
    table.string('status').notNullable().defaultTo('active');
    table.json('policy_data');
    table.timestamp('expires_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};
