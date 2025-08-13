/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return Promise.all([
    // Federal GarryCoin Reserve events tracking
    knex.schema.createTable('fgr_events', table => {
      table.increments('id').primary();
      table.string('event_type').notNullable(); // 'qe', 'buyback', 'announcement', 'vote'
      table.text('description').notNullable();
      table.json('event_data'); // store event-specific data
      table.integer('coins_distributed').defaultTo(0);
      table.integer('users_affected').defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    }),

    // FGR voting system
    knex.schema.createTable('fgr_votes', table => {
      table.increments('id').primary();
      table.string('policy_type').notNullable(); // 'hawkish', 'dovish', etc.
      table.string('user_id').notNullable();
      table.string('vote_choice').notNullable(); // 'yes', 'no', 'abstain'
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['policy_type', 'user_id']); // one vote per user per policy
    }),

    // FGR policy state tracking
    knex.schema.createTable('fgr_policies', table => {
      table.increments('id').primary();
      table.string('policy_name').notNullable().unique();
      table.string('status').notNullable().defaultTo('active'); // 'active', 'expired'
      table.json('policy_data'); // store policy parameters
      table.timestamp('expires_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('fgr_policies'),
    knex.schema.dropTableIfExists('fgr_votes'),
    knex.schema.dropTableIfExists('fgr_events')
  ]);
};
