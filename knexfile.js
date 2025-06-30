require('dotenv').config();

module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'garrycoin_user',
      password: process.env.DB_PASSWORD || 'garrycoin_password',
      database: process.env.DB_NAME || 'garrycoin_db',
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
      host: process.env.PROD_DB_HOST,
      port: process.env.PROD_DB_PORT,
      user: process.env.PROD_DB_USER,
      password: process.env.PROD_DB_PASSWORD,
      database: process.env.PROD_DB_NAME,
      ssl: { rejectUnauthorized: false }, // Adjust based on your production setup
    },
    migrations: {
      directory: './db/migrations',
    },
    seeds: {
      directory: './db/seeds',
    },
  },
};
