exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    table.timestamp('last_active_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropColumn('last_active_at');
  });
};