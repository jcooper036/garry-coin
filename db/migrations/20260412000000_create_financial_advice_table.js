/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('financial_advice', function(table) {
    table.increments('id').primary();
    table.string('user_id').notNullable().index();
    table.string('advice_type'); // stock, platform, garrycoin_item, command, financial_product, subscription, real_world_purchase, etc.
    table.text('advice_item'); // specific item pushed (e.g., "RXRX", "GarryTX", "GarryMon")
    table.text('advice_full_text'); // full AI response for context
    table.boolean('callback_used').defaultTo(false); // whether this was referenced in future advice
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('financial_advice');
};
