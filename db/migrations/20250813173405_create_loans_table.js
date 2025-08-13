/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('loans', function(table) {
    table.increments('id').primary();
    table.string('borrower_user_id').notNullable();
    table.string('lender_user_id').notNullable(); // 'garry_bot' for bot loans
    table.integer('amount').notNullable();
    table.decimal('interest_rate', 5, 2).notNullable(); // e.g., 5.50 for 5.5%
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('due_date').notNullable();
    table.string('status').defaultTo('active'); // 'active', 'paid', 'defaulted'
    table.integer('amount_paid').defaultTo(0);
    table.boolean('went_into_debt').defaultTo(false);
    
    // Add indexes for performance
    table.index(['borrower_user_id']);
    table.index(['lender_user_id']);
    table.index(['due_date']);
    table.index(['status']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('loans');
};
