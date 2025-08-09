require('dotenv').config();

const logPoolState = (pool) => {
  if (pool) {
    console.log(`[Knex Pool] State: size=${pool.size}, available=${pool.available}, pending=${pool.pending}`);
  }
};

module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.POSTGRES_USER || 'garrycoin_user',
      password: process.env.POSTGRES_PASSWORD || 'garrycoin_password',
      database: process.env.POSTGRES_DB || 'garrycoin_db',
    },
    pool: {
      min: 2,
      max: 10,
      afterCreate: (conn, done) => {
        console.log('[Knex Pool] Connection created.');
        conn.on('error', err => {
          console.error('[Knex Pool] Connection error:', err);
        });
        done(null, conn);
      }
    },
    migrations: {
      directory: './db/migrations',
    },
    seeds: {
      directory: './db/seeds',
    },
    debug: false, // Set to true for verbose query logging
    log: {
      warn(message) {
        console.warn('[Knex Warn]', message);
      },
      error(message) {
        console.error('[Knex Error]', message);
      },
      deprecate(message) {
        console.log('[Knex Deprecation]', message);
      },
      debug(message) {
        console.log('[Knex Debug]', message);
      },
    },
  },

  test: {
    client: 'pg',
    connection: {
      host: process.env.TEST_DB_HOST || 'localhost',
      port: process.env.TEST_DB_PORT || 5433, // Use a different port for test DB
      user: process.env.TEST_DB_USER || 'garrycoin_test_user',
      password: process.env.TEST_DB_PASSWORD || 'garrycoin_test_password',
      database: process.env.TEST_DB_NAME || 'garrycoin_test_db',
    },
    migrations: {
      directory: './db/migrations',
    },
    seeds: {
      directory: './db/seeds',
    },
  },

  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    },
    pool: {
      min: 1,
      max: 10,
      acquireTimeoutMillis: 60000,     // Increased to 60s
      idleTimeoutMillis: 300000,      // Increased to 5 minutes
      reapIntervalMillis: 10000,      // Check every 10s instead of 1s
      propagateCreateError: false,
      createTimeoutMillis: 30000,     // Add connection creation timeout
      destroyTimeoutMillis: 5000,
      afterCreate: (conn, done) => {
        console.log('[Knex Pool] Connection created.');
        conn.on('error', err => {
          console.error('[Knex Pool] Connection error:', err);
        });
        done(null, conn);
      },
      validate: (conn) => {
        return new Promise((resolve, reject) => {
          // Set a timeout for validation query
          const timeout = setTimeout(() => {
            reject(new Error('Connection validation timeout'));
          }, 5000);

          conn.query('SELECT 1 as ping', (err, result) => {
            clearTimeout(timeout);
            if (err) {
              console.error('[Knex Pool] Connection validation failed:', err);
              return reject(err);
            }
            // Additional check to ensure the connection is truly working
            if (!result || !result.rows || result.rows.length === 0) {
              return reject(new Error('Invalid validation response'));
            }
            resolve();
          });
        });
      }
    },
    migrations: {
      directory: './db/migrations',
    },
    seeds: {
      directory: './db/seeds',
    },
    log: {
      warn(message) {
        console.warn('[Knex Warn]', message);
      },
      error(message) {
        console.error('[Knex Error]', message);
      },
      deprecate(message) {
        console.log('[Knex Deprecation]', message);
      },
      debug(message) {
        console.log('[Knex Debug]', message);
      },
    },
  },
};
''
