const { readOnlyDb } = require('./readOnlyDb');
const { structuredLog } = require('./logger');

/**
 * Predefined investigation queries for Release The Files system
 * These 10 queries provide comprehensive evidence across all investigation areas
 */

const INVESTIGATION_QUERIES = [
  {
    id: 'user_profile',
    name: 'User Profile & Financial Status',
    description: 'Basic user information including balance, credit score, and activity',
    query: `
      WITH user_data AS (
        SELECT 
          user_id,
          balance,
          credit_score,
          last_active_at,
          EXTRACT(days FROM (NOW() - last_active_at)) as days_since_active
        FROM users 
        WHERE user_id = ?
      )
      SELECT 
        ud.user_id,
        ud.balance,
        ud.credit_score,
        ud.last_active_at,
        ud.days_since_active,
        ROUND((
          SELECT COUNT(*)::float / COUNT(*) OVER () * 100 
          FROM users u 
          WHERE u.balance <= ud.balance
        )::numeric, 1) as balance_percentile,
        ROUND((
          SELECT COUNT(*)::float / COUNT(*) OVER () * 100 
          FROM users u 
          WHERE u.credit_score <= ud.credit_score AND u.credit_score IS NOT NULL
        )::numeric, 1) as credit_percentile
      FROM user_data ud
    `,
    requiresUserId: true
  },

  {
    id: 'recent_transactions',
    name: 'Recent Transaction History',
    description: 'Last 20 transactions involving the user with timestamps and types',
    query: `
      SELECT 
        sending_user_id,
        receiving_user_id,
        amount,
        transaction_type,
        created_at,
        CASE 
          WHEN sending_user_id = ? THEN 'outgoing'
          WHEN receiving_user_id = ? THEN 'incoming'
        END as direction
      FROM transactions 
      WHERE sending_user_id = ? OR receiving_user_id = ?
      ORDER BY created_at DESC 
      LIMIT 20
    `,
    requiresUserId: true
  },

  {
    id: 'gambling_performance',
    name: 'Gambling Win Rates & Patterns',
    description: 'Comprehensive gambling statistics across all games',
    query: `
      WITH gambling_transactions AS (
        SELECT 
          CASE 
            WHEN sending_user_id = ? THEN 'loss'
            WHEN receiving_user_id = ? THEN 'win'
          END as outcome,
          amount,
          transaction_type,
          created_at,
          CASE 
            WHEN transaction_type LIKE 'heist_%' THEN 'heist'
            WHEN transaction_type LIKE 'rtb_%' THEN 'rtb'
            WHEN transaction_type LIKE 'wavelength_%' THEN 'wavelength'
          END as game_type
        FROM transactions 
        WHERE (sending_user_id = ? OR receiving_user_id = ?)
          AND (transaction_type LIKE 'heist_%' OR transaction_type LIKE 'rtb_%' OR transaction_type LIKE 'wavelength_%')
          AND transaction_type NOT LIKE '%_refund_%'
      ),
      user_stats AS (
        SELECT 
          game_type,
          COUNT(*) as total_games,
          SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN outcome = 'loss' THEN amount ELSE 0 END) as total_wagered,
          SUM(CASE WHEN outcome = 'win' THEN amount ELSE 0 END) as total_won,
          ROUND(SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as win_rate,
          MAX(CASE WHEN outcome = 'win' THEN amount ELSE 0 END) as biggest_win,
          MAX(CASE WHEN outcome = 'loss' THEN amount ELSE 0 END) as biggest_loss
        FROM gambling_transactions 
        WHERE game_type IS NOT NULL
        GROUP BY game_type
      ),
      all_player_stats AS (
        SELECT 
          CASE 
            WHEN transaction_type LIKE 'heist_%' THEN 'heist'
            WHEN transaction_type LIKE 'rtb_%' THEN 'rtb' 
            WHEN transaction_type LIKE 'wavelength_%' THEN 'wavelength'
          END as game_type,
          CASE 
            WHEN receiving_user_id NOT IN ('house', 'lottery', 'garry_bot') THEN receiving_user_id
            ELSE sending_user_id
          END as player_id,
          COUNT(*) as games_played,
          ROUND(SUM(CASE WHEN receiving_user_id NOT IN ('house', 'lottery', 'garry_bot') THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as player_win_rate
        FROM transactions 
        WHERE (transaction_type LIKE 'heist_%' OR transaction_type LIKE 'rtb_%' OR transaction_type LIKE 'wavelength_%')
          AND transaction_type NOT LIKE '%_refund_%'
        GROUP BY game_type, player_id
        HAVING COUNT(*) > 0
      )
      SELECT 
        us.game_type,
        us.total_games,
        us.wins,
        us.total_wagered,
        us.total_won,
        us.win_rate,
        us.biggest_win,
        us.biggest_loss,
        ROUND((
          SELECT COUNT(*)::float / COUNT(*) OVER () * 100 
          FROM all_player_stats aps 
          WHERE aps.game_type = us.game_type AND aps.player_win_rate <= us.win_rate
        )::numeric, 1) as win_rate_percentile,
        ROUND((
          SELECT COUNT(*)::float / COUNT(*) OVER () * 100 
          FROM all_player_stats aps 
          WHERE aps.game_type = us.game_type AND aps.games_played <= us.total_games
        )::numeric, 1) as volume_percentile
      FROM user_stats us
      ORDER BY us.total_games DESC
    `,
    requiresUserId: true
  },

  {
    id: 'loan_history',
    name: 'Loan History & Debt Patterns',
    description: 'All loans taken, current debt, and repayment behavior',
    query: `
      SELECT 
        l.id as loan_id,
        l.amount as loan_amount,
        l.interest_rate,
        l.status,
        l.created_at,
        l.due_date,
        l.amount_paid,
        l.went_into_debt,
        EXTRACT(days FROM (NOW() - l.created_at)) as days_since_loan,
        EXTRACT(days FROM (l.due_date - NOW())) as days_until_due,
        CASE 
          WHEN l.status = 'active' AND l.due_date < NOW() THEN 'overdue'
          WHEN l.status = 'active' THEN 'current'
          ELSE l.status
        END as loan_status
      FROM loans l
      WHERE l.borrower_user_id = ?
      ORDER BY l.created_at DESC
      LIMIT 10
    `,
    requiresUserId: true
  },

  {
    id: 'user_interactions',
    name: 'Interaction Frequency with Other Users',
    description: 'Most frequent transaction partners and amounts',
    query: `
      SELECT 
        other_user,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount,
        MAX(created_at) as last_interaction,
        SUM(CASE WHEN sending_user_id = ? THEN amount ELSE 0 END) as sent_to_them,
        SUM(CASE WHEN receiving_user_id = ? THEN amount ELSE 0 END) as received_from_them,
        SUM(CASE WHEN sending_user_id = ? THEN amount ELSE 0 END) - 
        SUM(CASE WHEN receiving_user_id = ? THEN amount ELSE 0 END) as net_flow_to_them
      FROM (
        SELECT 
          CASE WHEN sending_user_id = ? THEN receiving_user_id ELSE sending_user_id END as other_user,
          sending_user_id,
          receiving_user_id,
          amount,
          created_at
        FROM transactions 
        WHERE (sending_user_id = ? OR receiving_user_id = ?)
          AND sending_user_id != receiving_user_id
      ) t
      WHERE other_user NOT IN ('house', 'lottery', 'garry_bot', 'release_files_fund', ?)
      GROUP BY other_user
      ORDER BY transaction_count DESC 
      LIMIT 10
    `,
    requiresUserId: true
  },

  {
    id: 'bot_interactions',
    name: 'Bot Interaction Activity',
    description: 'Frequency and types of interactions with bot systems',
    query: `
      SELECT 
        transaction_type,
        COUNT(*) as frequency,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        MAX(created_at) as last_occurrence,
        MIN(created_at) as first_occurrence
      FROM transactions 
      WHERE (sending_user_id = ? OR receiving_user_id = ?)
        AND (sending_user_id IN ('house', 'lottery', 'garry_bot', 'release_files_fund') 
             OR receiving_user_id IN ('house', 'lottery', 'garry_bot', 'release_files_fund'))
        AND sending_user_id != ? AND receiving_user_id != ?
      GROUP BY transaction_type
      ORDER BY frequency DESC
    `,
    requiresUserId: true
  },

  {
    id: 'wealth_comparison',
    name: 'Wealth Rankings & Distribution',
    description: 'User position in wealth rankings and percentile',
    query: `
      WITH wealth_rankings AS (
        SELECT 
          user_id,
          balance,
          credit_score,
          ROW_NUMBER() OVER (ORDER BY balance DESC) as wealth_rank,
          COUNT(*) OVER () as total_users,
          PERCENT_RANK() OVER (ORDER BY balance) as wealth_percentile
        FROM users 
        WHERE balance > 0
      )
      SELECT 
        wealth_rank,
        total_users,
        ROUND((wealth_percentile * 100)::numeric, 1) as wealth_percentile,
        balance,
        credit_score,
        ROUND((PERCENT_RANK() OVER (ORDER BY credit_score) * 100)::numeric, 1) as credit_percentile
      FROM wealth_rankings 
      WHERE user_id = ?
    `,
    requiresUserId: true
  },

  {
    id: 'game_hosting',
    name: 'Game Hosting Patterns',
    description: 'Analysis of games hosted and their outcomes',
    query: `
      WITH all_game_hosting AS (
        SELECT 'bus' as game_type, host_user_id, status, wager, created_at 
        FROM bus_games 
        UNION ALL
        SELECT 'wavelength' as game_type, host_user_id, status, wager, created_at 
        FROM wavelength_games 
      ),
      user_game_hosting AS (
        SELECT 'bus' as game_type, host_user_id, status, wager, created_at 
        FROM bus_games 
        WHERE host_user_id = ?
        UNION ALL
        SELECT 'wavelength' as game_type, host_user_id, status, wager, created_at 
        FROM wavelength_games 
        WHERE host_user_id = ?
      ),
      hosting_stats AS (
        SELECT 
          game_type,
          host_user_id,
          COUNT(*) as games_hosted,
          AVG(wager) as avg_wager,
          MAX(wager) as max_wager,
          COUNT(CASE WHEN status = 'finished' THEN 1 END) as completed_games,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_games,
          COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned_games
        FROM all_game_hosting
        GROUP BY game_type, host_user_id
      ),
      percentile_ranks AS (
        SELECT 
          game_type,
          host_user_id,
          games_hosted,
          PERCENT_RANK() OVER (PARTITION BY game_type ORDER BY games_hosted) as hosting_percentile
        FROM hosting_stats
      )
      SELECT 
        ugh.game_type,
        COUNT(*) as games_hosted,
        AVG(ugh.wager) as avg_wager,
        MAX(ugh.wager) as max_wager,
        COUNT(CASE WHEN ugh.status = 'finished' THEN 1 END) as completed_games,
        COUNT(CASE WHEN ugh.status = 'cancelled' THEN 1 END) as cancelled_games,
        COUNT(CASE WHEN ugh.status = 'abandoned' THEN 1 END) as abandoned_games,
        MAX(ugh.created_at) as last_hosted,
        MIN(ugh.created_at) as first_hosted,
        ROUND((COALESCE(pr.hosting_percentile, 0) * 100)::numeric, 1) as hosting_percentile
      FROM user_game_hosting ugh
      LEFT JOIN percentile_ranks pr ON ugh.game_type = pr.game_type AND pr.host_user_id = ?
      GROUP BY ugh.game_type, pr.hosting_percentile
      ORDER BY games_hosted DESC
    `,
    requiresUserId: true
  },

  {
    id: 'suspicious_patterns',
    name: 'Suspicious Transaction Patterns',
    description: 'Large transactions, rapid sequences, and unusual patterns',
    query: `
      WITH economic_baseline AS (
        SELECT 
          AVG(amount) as avg_amount,
          COUNT(*) as total_transactions
        FROM transactions 
        WHERE created_at > NOW() - INTERVAL '30 days'
          AND amount > 0
      ),
      total_wealth AS (
        SELECT SUM(balance) as total_wealth FROM users
      ),
      recent_amounts AS (
        SELECT amount
        FROM transactions 
        WHERE created_at > NOW() - INTERVAL '30 days' 
          AND amount > 0
      ),
      user_transactions AS (
        SELECT 
          sending_user_id,
          receiving_user_id,
          amount,
          transaction_type,
          created_at,
          LAG(created_at) OVER (ORDER BY created_at) as prev_transaction_time
        FROM transactions 
        WHERE (sending_user_id = ? OR receiving_user_id = ?)
          AND amount > 0
        ORDER BY created_at DESC
        LIMIT 20
      )
      SELECT 
        ut.sending_user_id,
        ut.receiving_user_id,
        ut.amount,
        ut.transaction_type,
        ut.created_at,
        EXTRACT(seconds FROM (ut.created_at - ut.prev_transaction_time)) as seconds_since_previous,
        ROUND((ut.amount / eb.avg_amount)::numeric, 2) as amount_vs_average,
        ROUND((ut.amount / tw.total_wealth * 100)::numeric, 4) as percent_of_total_wealth,
        ROUND((
          SELECT COUNT(*)::float / (SELECT COUNT(*) FROM recent_amounts) * 100 
          FROM recent_amounts ra 
          WHERE ra.amount <= ut.amount
        )::numeric, 1) as amount_percentile,
        CASE
          WHEN ut.amount > (SELECT PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY amount) FROM recent_amounts) THEN true
          WHEN EXTRACT(seconds FROM (ut.created_at - ut.prev_transaction_time)) < 10 THEN true
          WHEN ut.amount > eb.avg_amount * 5 THEN true
          ELSE false
        END as is_suspicious
      FROM user_transactions ut
      CROSS JOIN economic_baseline eb
      CROSS JOIN total_wealth tw
      ORDER BY ut.created_at DESC
    `,
    requiresUserId: true
  },

  {
    id: 'activity_summary',
    name: 'Recent Activity Summary',
    description: 'Overview of recent activity across all systems',
    query: `
      WITH recent_activity AS (
        SELECT 'transaction' as activity_type, created_at 
        FROM transactions 
        WHERE (sending_user_id = ? OR receiving_user_id = ?) 
          AND created_at > NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT 'loan' as activity_type, created_at 
        FROM loans 
        WHERE borrower_user_id = ? 
          AND created_at > NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT 'game_host' as activity_type, created_at 
        FROM bus_games 
        WHERE host_user_id = ? 
          AND created_at > NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT 'game_host' as activity_type, created_at 
        FROM wavelength_games 
        WHERE host_user_id = ? 
          AND created_at > NOW() - INTERVAL '7 days'
      )
      SELECT 
        activity_type,
        COUNT(*) as count,
        MAX(created_at) as most_recent,
        MIN(created_at) as oldest
      FROM recent_activity 
      GROUP BY activity_type
      ORDER BY count DESC
    `,
    requiresUserId: true
  }
];

/**
 * Execute a predefined investigation query
 * @param {string} queryId - The ID of the query to execute
 * @param {string} userId - The user ID to investigate (if required)
 * @param {string} botUserId - The bot's Discord user ID (optional)
 * @returns {Promise<Object>} Query results with metadata
 */
async function executeInvestigationQuery(queryId, userId = null, botUserId = null) {
  const queryDef = INVESTIGATION_QUERIES.find(q => q.id === queryId);
  
  if (!queryDef) {
    throw new Error(`Invalid query ID: ${queryId}`);
  }

  if (queryDef.requiresUserId && !userId) {
    throw new Error(`Query ${queryId} requires a user ID`);
  }

  const startTime = Date.now();
  
  try {
    let results;
    if (queryDef.requiresUserId && userId) {
      // Count the number of ? placeholders and fill them appropriately
      const placeholderCount = (queryDef.query.match(/\?/g) || []).length;
      let params;
      
      if (queryId === 'user_interactions') {
        // Special handling for user_interactions: 7 userId params + 1 botUserId exclusion
        params = Array(7).fill(userId).concat([botUserId || userId]);
      } else if (queryId === 'bot_interactions') {
        // Special handling for bot_interactions: 2 userId params + 2 botUserId exclusions
        params = [userId, userId, botUserId || userId, botUserId || userId];
      } else if (queryId === 'game_hosting') {
        // Special handling for game_hosting: 3 userId params (2 for user games, 1 for percentile lookup)
        params = [userId, userId, userId];
      } else {
        // Default: fill all placeholders with userId
        params = Array(placeholderCount).fill(userId);
      }
      
      results = await readOnlyDb.raw(queryDef.query, params);
    } else {
      results = await readOnlyDb.raw(queryDef.query);
    }
    const executionTime = Date.now() - startTime;

    structuredLog.security('Investigation query executed', {
      queryId,
      userId,
      executionTime,
      resultCount: results.rows?.length || results.length || 0
    });

    return {
      queryId,
      name: queryDef.name,
      description: queryDef.description,
      results: results.rows || results,
      executionTime,
      userId
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    structuredLog.error('Investigation query failed', error, {
      queryId,
      userId,
      executionTime
    });
    
    throw new Error(`Query execution failed: ${error.message}`);
  }
}

/**
 * Execute all investigation queries for a user
 * @param {string} userId - The user ID to investigate
 * @param {string} botUserId - The bot's Discord user ID (optional)
 * @returns {Promise<Array>} Array of all query results
 */
async function executeAllInvestigationQueries(userId, botUserId = null) {
  const results = [];
  
  for (const queryDef of INVESTIGATION_QUERIES) {
    try {
      const result = await executeInvestigationQuery(queryDef.id, userId, botUserId);
      results.push(result);
    } catch (error) {
      // Continue with other queries if one fails
      structuredLog.warn('Investigation query failed, continuing with others', error, {
        queryId: queryDef.id,
        userId
      });
      
      results.push({
        queryId: queryDef.id,
        name: queryDef.name,
        description: queryDef.description,
        error: error.message,
        results: [],
        userId
      });
    }
  }
  
  return results;
}

/**
 * Test a specific query to ensure it works
 * @param {string} queryId - The ID of the query to test
 * @param {string} testUserId - Test user ID (optional)
 * @returns {Promise<boolean>} True if query executes successfully
 */
async function testInvestigationQuery(queryId, testUserId = '123456789012345678') {
  try {
    const result = await executeInvestigationQuery(queryId, testUserId);
    console.log(`✅ Query ${queryId} executed successfully:`, {
      resultCount: result.results.length,
      executionTime: result.executionTime
    });
    return true;
  } catch (error) {
    console.error(`❌ Query ${queryId} failed:`, error.message);
    return false;
  }
}

/**
 * Test all investigation queries
 * @param {string} testUserId - Test user ID (optional)
 * @returns {Promise<Object>} Test results summary
 */
async function testAllInvestigationQueries(testUserId = '123456789012345678') {
  console.log('🧪 Testing all investigation queries...\n');
  
  const testResults = {
    passed: [],
    failed: [],
    total: INVESTIGATION_QUERIES.length
  };
  
  for (const queryDef of INVESTIGATION_QUERIES) {
    const success = await testInvestigationQuery(queryDef.id, testUserId);
    if (success) {
      testResults.passed.push(queryDef.id);
    } else {
      testResults.failed.push(queryDef.id);
    }
  }
  
  console.log('\n📊 Test Summary:');
  console.log(`✅ Passed: ${testResults.passed.length}/${testResults.total}`);
  console.log(`❌ Failed: ${testResults.failed.length}/${testResults.total}`);
  
  if (testResults.failed.length > 0) {
    console.log('\n❌ Failed queries:', testResults.failed);
  }
  
  return testResults;
}

module.exports = {
  INVESTIGATION_QUERIES,
  executeInvestigationQuery,
  executeAllInvestigationQueries,
  testInvestigationQuery,
  testAllInvestigationQueries
};