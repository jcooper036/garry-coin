const knex = require('knex');
const knexConfig = require('../knexfile');
const { structuredLog } = require('./logger');
const { db, transfer } = require('./db');

const environment = process.env.NODE_ENV || 'development';

// Create read-only database configuration
const readOnlyConfig = {
  ...knexConfig[environment],
  pool: {
    ...knexConfig[environment].pool,
    min: 1,
    max: 3, // Smaller pool for read-only queries
  }
};

// If in production, we'll use the same connection string but with read-only user
// In development, we'll use the same connection (PostgreSQL role-based access would be ideal)
const readOnlyDb = knex(readOnlyConfig);

// Validate SQL query to ensure it's read-only
function validateReadOnlyQuery(sql) {
  const normalizedSql = sql.trim().toLowerCase();

  // List of forbidden keywords for write operations
  const forbiddenKeywords = [
    'insert', 'update', 'delete', 'drop', 'create', 'alter',
    'truncate', 'grant', 'revoke', 'set', 'reset', 'begin',
    'commit', 'rollback', 'savepoint', 'lock', 'unlock'
  ];

  // Check if query starts with SELECT or WITH (for CTEs)
  if (!normalizedSql.startsWith('select') && !normalizedSql.startsWith('with')) {
    return { valid: false, error: 'Only SELECT statements are allowed' };
  }

  // Check for forbidden keywords using word boundaries
  for (const keyword of forbiddenKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(normalizedSql)) {
      return { valid: false, error: `Forbidden keyword detected: ${keyword.toUpperCase()}` };
    }
  }

  // Additional checks for dangerous functions
  const dangerousFunctions = ['pg_sleep', 'pg_terminate_backend', 'pg_cancel_backend'];
  for (const func of dangerousFunctions) {
    if (normalizedSql.includes(func)) {
      return { valid: false, error: `Dangerous function not allowed: ${func}` };
    }
  }

  return { valid: true };
}

// Execute read-only query with safety measures
async function executeReadOnlyQuery(sql, options = {}) {
  const { maxRows = 100, timeoutMs = 30000 } = options;

  try {
    // Validate the query
    const validation = validateReadOnlyQuery(sql);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    structuredLog.database('Executing read-only query', { sql: sql.substring(0, 100) + '...' });

    // Execute with timeout and row limit
    const results = await Promise.race([
      readOnlyDb.raw(sql),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout exceeded')), timeoutMs)
      )
    ]);

    // Limit results if needed
    let rows = results.rows || results;
    if (Array.isArray(rows) && rows.length > maxRows) {
      rows = rows.slice(0, maxRows);
      structuredLog.database('Query results truncated', { originalCount: results.rows?.length || results.length, limitedTo: maxRows });
    }

    return {
      success: true,
      rows: rows,
      rowCount: Array.isArray(rows) ? rows.length : 0,
      truncated: Array.isArray(results.rows || results) && (results.rows || results).length > maxRows
    };

  } catch (error) {
    structuredLog.dbError('Read-only query failed', error, { sql: sql.substring(0, 100) + '...' });
    return {
      success: false,
      error: error.message,
      rows: [],
      rowCount: 0
    };
  }
}

// Format query results for Discord display
function formatQueryResults(result, isPublic = false) {
  if (!result.success) {
    return {
      content: `❌ Query failed: ${result.error}`,
      ephemeral: !isPublic
    };
  }

  if (result.rowCount === 0) {
    return {
      content: '📊 Query executed successfully but returned no results.',
      ephemeral: !isPublic
    };
  }

  const { rows, rowCount, truncated } = result;

  // Create a formatted table for small result sets
  if (rowCount <= 10 && rows.length > 0) {
    const keys = Object.keys(rows[0]);

    // Create header
    let output = '```\n';
    output += keys.join(' | ') + '\n';
    output += keys.map(() => '---').join(' | ') + '\n';

    // Add rows
    for (const row of rows) {
      const values = keys.map(key => {
        const value = row[key];
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'string' && value.length > 20) return value.substring(0, 17) + '...';
        return String(value);
      });
      output += values.join(' | ') + '\n';
    }

    output += '```';

    // Add metadata
    output += `\n📊 **Results:** ${rowCount} row${rowCount === 1 ? '' : 's'}`;
    if (truncated) {
      output += ` (truncated to first 100 rows)`;
    }

    // Check if output is too long for Discord
    if (output.length > 1900) {
      return formatLargeResults(result, isPublic);
    }

    return {
      content: output,
      ephemeral: !isPublic
    };
  }

  return formatLargeResults(result, isPublic);
}

function formatLargeResults(result, isPublic) {
  const { rows, rowCount, truncated } = result;

  let output = `📊 **Query Results**\n`;
  output += `**Rows returned:** ${rowCount}`;
  if (truncated) output += ` (truncated to first 100)`;
  output += `\n\n`;

  // Show just a summary for large results
  if (rows.length > 0) {
    const firstRow = rows[0];
    const columns = Object.keys(firstRow);

    output += `**Columns:** ${columns.join(', ')}\n\n`;
    output += `**Sample data:**\n\`\`\`\n`;

    // Show first few rows in a simple format
    const sampleRows = rows.slice(0, 3);
    for (let i = 0; i < sampleRows.length; i++) {
      output += `Row ${i + 1}:\n`;
      for (const [key, value] of Object.entries(sampleRows[i])) {
        let displayValue = value;
        if (value === null || value === undefined) displayValue = 'NULL';
        else if (typeof value === 'string' && value.length > 50) displayValue = value.substring(0, 47) + '...';
        output += `  ${key}: ${displayValue}\n`;
      }
      output += '\n';
    }

    if (rowCount > 3) {
      output += `... and ${rowCount - 3} more rows\n`;
    }
    output += '```';
  }

  return {
    content: output,
    ephemeral: !isPublic
  };
}

// SQL Ban System Functions

async function checkUserSqlBan(userId) {
  try {
    // Get user's ban history
    const banHistory = await db('sql_ban_events')
      .where({ user_id: userId })
      .orderBy('banned_at', 'desc');

    const banCount = banHistory.length;

    // Check if user is currently banned
    if (banCount > 0) {
      const latestBan = banHistory[0];
      const now = new Date();
      const banExpiry = new Date(latestBan.ban_expires_at);

      if (now < banExpiry) {
        return {
          isBanned: true,
          banNumber: latestBan.ban_number,
          banExpiresAt: banExpiry,
          minutesRemaining: Math.ceil((banExpiry - now) / (1000 * 60))
        };
      }
    }

    return {
      isBanned: false,
      banCount: banCount
    };
  } catch (error) {
    structuredLog.dbError('Error checking SQL ban status', error, { userId });
    return { isBanned: false, banCount: 0 };
  }
}

async function issueSqlBan(userId, attemptedQuery, violationType, violationDetails) {
  try {
    // Get current ban count
    const banCount = await db('sql_ban_events')
      .where({ user_id: userId })
      .count('* as count')
      .first();

    const newBanNumber = parseInt(banCount.count) + 1;

    // Calculate ban duration: 2^ban_number minutes
    const banDurationMinutes = Math.pow(2, newBanNumber);
    const fineAmount = banDurationMinutes;

    const now = new Date();
    const banExpiry = new Date(now.getTime() + (banDurationMinutes * 60 * 1000));

    // Insert ban record
    await db('sql_ban_events').insert({
      user_id: userId,
      attempted_query: attemptedQuery,
      violation_type: violationType,
      violation_details: violationDetails,
      ban_number: newBanNumber,
      ban_duration_minutes: banDurationMinutes,
      fine_amount: fineAmount,
      banned_at: now,
      ban_expires_at: banExpiry
    });

    // Issue fine (transfer GarryCoins from user to bot)
    const transferResult = await transfer(userId, 'house', fineAmount, 'sql_ban_fine');

    structuredLog.warn('SQL ban issued', {
      userId,
      banNumber: newBanNumber,
      banDurationMinutes,
      fineAmount,
      violationType,
      violationDetails,
      transferSuccess: transferResult.success,
      attemptedQuery: attemptedQuery.substring(0, 100) + '...'
    });

    return {
      banNumber: newBanNumber,
      banDurationMinutes,
      fineAmount,
      banExpiry,
      transferResult
    };

  } catch (error) {
    structuredLog.dbError('Error issuing SQL ban', error, { userId, violationType });
    throw error;
  }
}

// Enhanced validation that includes ban details
function validateReadOnlyQueryWithDetails(sql) {
  const normalizedSql = sql.trim().toLowerCase();

  // List of forbidden keywords for write operations
  const forbiddenKeywords = [
    'insert', 'update', 'delete', 'drop', 'create', 'alter',
    'truncate', 'grant', 'revoke', 'set', 'reset', 'begin',
    'commit', 'rollback', 'savepoint', 'lock', 'unlock'
  ];

  // Check if query starts with SELECT or WITH (for CTEs)
  if (!normalizedSql.startsWith('select') && !normalizedSql.startsWith('with')) {
    return {
      valid: false,
      error: 'Only SELECT statements are allowed',
      violationType: 'invalid_statement_type',
      violationDetails: 'Non-SELECT statement attempted'
    };
  }

  // Check for forbidden keywords using word boundaries
  for (const keyword of forbiddenKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(normalizedSql)) {
      return {
        valid: false,
        error: `Forbidden keyword detected: ${keyword.toUpperCase()}`,
        violationType: 'forbidden_keyword',
        violationDetails: keyword.toUpperCase()
      };
    }
  }

  // Additional checks for dangerous functions
  const dangerousFunctions = ['pg_sleep', 'pg_terminate_backend', 'pg_cancel_backend'];
  for (const func of dangerousFunctions) {
    if (normalizedSql.includes(func)) {
      return {
        valid: false,
        error: `Dangerous function not allowed: ${func}`,
        violationType: 'dangerous_function',
        violationDetails: func
      };
    }
  }

  return { valid: true };
}

module.exports = {
  readOnlyDb,
  validateReadOnlyQuery,
  validateReadOnlyQueryWithDetails,
  executeReadOnlyQuery,
  formatQueryResults,
  checkUserSqlBan,
  issueSqlBan
};