/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('release_files_cases', function (table) {
      table.increments('id').primary();
      table.string('submitter_user_id', 255).notNullable();
      table.text('grievance').notNullable();
      table.string('bias_direction', 10).notNullable(); // 'for' or 'against'
      table.integer('bribe_amount').defaultTo(0);
      table.string('case_status', 20).defaultTo('active'); // 'active', 'closed'
      table.timestamps(true, true);
    })
    .createTable('release_files_queries', function (table) {
      table.increments('id').primary();
      table.integer('case_id').unsigned().references('id').inTable('release_files_cases').onDelete('CASCADE');
      table.text('query_text').notNullable();
      table.jsonb('query_results');
      table.text('interpretation');
      table.boolean('supports_bias').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('release_files_codebase_refs', function (table) {
      table.increments('id').primary();
      table.integer('case_id').unsigned().references('id').inTable('release_files_cases').onDelete('CASCADE');
      table.text('file_path').notNullable();
      table.text('relevant_content');
      table.text('interpretation');
      table.boolean('supports_bias').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('release_files_codebase_refs')
    .dropTableIfExists('release_files_queries')
    .dropTableIfExists('release_files_cases');
};