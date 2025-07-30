require('dotenv').config();

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
        conn.query('SELECT 1;', (err) => {
          if (err) {
            console.error('Database connection failed!', err);
            done(err, conn);
          } else {
            done(err, conn);
          }
        });
      },
    },
    migrations: {
      directory: './db/migrations',
    },
    seeds: {
      directory: './db/seeds',
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
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      propagateCreateError: false, // <<-- THIS TRUE MAY CAUSE UNHANDLED REJECTION
    },
    migrations: {
      directory: './db/migrations',
    },
    seeds: {
      directory: './db/seeds',
    },
  },
};
