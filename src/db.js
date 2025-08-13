const knex = require('knex');
const knexConfig = require('../knexfile');
const { structuredLog } = require('./logger');

const logPoolState = (pool) => {
  if (pool) {
    structuredLog.database('Pool state', {
      size: pool.numUsed() + pool.numFree(),
      available: pool.numFree(),
      pending: pool.numPendingAcquires()
    });
  }
};

const environment = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[environment]);

// --- Pool Logging (only errors and warnings) ---
const pool = db.client.pool;
structuredLog.database('Knex pool initializing', { environment });

// Only log failures and destroys (important events)
pool.on('acquireFail', (eventId, err) => {
  structuredLog.dbError('Connection acquire failed', err, { eventId });
  logPoolState(pool);
});
pool.on('destroy', (eventId, resource) => {
  structuredLog.database('Connection destroyed', { eventId });
  logPoolState(pool);
});
// --------------------

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 5000;

async function withRetry(fn, retries = MAX_RETRIES, delay = RETRY_DELAY_MS) {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && (error.code === 'ECONNRESET' || error.message.includes('Connection terminated'))) {
      structuredLog.dbError('Database connection error, retrying', error, {
        retryDelay: delay / 1000,
        retriesLeft: retries
      });
      await new Promise(res => setTimeout(res, delay));
      return withRetry(fn, retries - 1, delay);
    } else {
      structuredLog.dbError('Database operation failed after all retries', error, {
        retriable: error.code === 'ECONNRESET' || error.message.includes('Connection terminated')
      });
      throw error;
    }
  }
}

async function findOrCreateUser(userId) {
  return withRetry(async () => {
    let user = await db('users').where({ user_id: userId }).first();
    if (user) {
      await db('users').where({ user_id: userId }).update({ last_active_at: db.fn.now() });
    } else {
      user = { user_id: userId, balance: 0, last_active_at: db.fn.now() };
      await db('users').insert(user);
    }
    return user;
  });
}

async function updateUserActivity(userId) {
  return withRetry(async () => {
    structuredLog.database('Updating user activity', { userId });
    await db('users').where({ user_id: userId }).update({ last_active_at: db.fn.now() });
  });
}

async function getUser(userId) {
  return db('users').where({ user_id: userId }).first();
}

async function getRandomActiveUser(daysInactive = 7) {
  const activeSince = new Date();
  activeSince.setDate(activeSince.getDate() - daysInactive);

  const activeUsers = await db('users')
    .where('last_active_at', '>=', activeSince)
    .select('user_id');

  if (activeUsers.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * activeUsers.length);
  return activeUsers[randomIndex];
}


async function transfer(senderId, receiverId, amount, transaction_type) {
  if (amount <= 0) {
    return { success: false, message: 'Amount must be positive.' };
  }

  return db.transaction(async trx => {
    const sender = await findOrCreateUser(senderId);
    const receiver = await findOrCreateUser(receiverId);

    if (sender.balance < amount) {
      return { success: false, message: 'insufficient_funds' };
    }

    await trx('users').where({ user_id: senderId }).decrement('balance', amount);
    await trx('users').where({ user_id: receiverId }).increment('balance', amount);

    await recordTransaction(senderId, receiverId, amount, transaction_type, trx);

    return { success: true, message: 'Transfer successful.' };
  });
}

async function recordTransaction(sending_user_id, receiving_user_id, amount, transaction_type, trx) {
  await (trx || db)('transactions').insert({
    sending_user_id,
    receiving_user_id,
    amount,
    transaction_type,
  });
}

async function grant(receiverId, amount, transaction_type, trx) {
  const db_conn = trx || db;
  return db_conn.transaction(async trx => {
    await findOrCreateUser(receiverId, trx);
    await trx('users').where({ user_id: receiverId }).increment('balance', amount);
    const senderId = transaction_type === 'lottery_grant' ? 'lottery' : 'house';
    await recordTransaction(senderId, receiverId, amount, transaction_type, trx);
    return { success: true, message: 'Grant successful.' };
  });
}

async function getGamblingStats(userId) {
  return await db.transaction(async (trx) => {
    // Get heist stats from transactions (no dedicated game table)
    const heistTransactions = await trx('transactions')
      .where(function() {
        this.where('sending_user_id', userId).orWhere('receiving_user_id', userId);
      })
      .where('transaction_type', 'like', 'heist_%')
      .orderBy('created_at', 'desc');

    // Get RTB stats from game tables
    const rtbGames = await trx('bus_games as bg')
      .join('bus_game_players as bgp', 'bg.id', 'bgp.game_id')
      .where('bgp.user_id', userId)
      .where('bg.status', 'finished')
      .select('bg.id', 'bg.wager', 'bgp.player_status');

    // Get RTB win transactions to calculate winnings
    const rtbWinTransactions = await trx('transactions')
      .where('receiving_user_id', userId)
      .where('transaction_type', 'like', 'rtb_win_%')
      .whereNot('transaction_type', 'like', '%_refund_%');

    // Get Wavelength stats from game tables  
    const wavelengthGames = await trx('wavelength_games as wg')
      .join('wavelength_players as wp', 'wg.id', 'wp.game_id')
      .where('wp.user_id', userId)
      .where('wg.status', 'finished')
      .select('wg.id', 'wg.wager', 'wp.player_status');

    // Get Wavelength win transactions to calculate winnings
    const wavelengthWinTransactions = await trx('transactions')
      .where('receiving_user_id', userId)
      .where('transaction_type', 'wavelength_win')
      .whereNot('transaction_type', 'like', '%_refund_%');

    // Get all gambling transactions for overall stats and streaks
    const allGamblingTransactions = await trx('transactions')
      .where(function() {
        this.where('sending_user_id', userId).orWhere('receiving_user_id', userId);
      })
      .where(function() {
        this.where('transaction_type', 'like', 'heist_%')
          .orWhere('transaction_type', 'like', 'rtb_%')
          .orWhere('transaction_type', 'like', 'wavelength_%');
      })
      .whereNot('transaction_type', 'like', '%_refund_%')
      .orderBy('created_at', 'desc');

    // Calculate heist stats
    const heistStats = { wagered: 0, won: 0, games: 0, wins: 0 };
    const heistWins = heistTransactions.filter(t => t.transaction_type === 'heist_win' && t.receiving_user_id === userId);
    const heistLosses = heistTransactions.filter(t => t.transaction_type === 'heist_loss' && t.sending_user_id === userId);
    
    heistStats.games = heistWins.length + heistLosses.length;
    heistStats.wins = heistWins.length;
    heistStats.wagered = heistLosses.reduce((sum, t) => sum + t.amount, 0);
    heistStats.won = heistWins.reduce((sum, t) => sum + t.amount, 0);

    // Calculate RTB stats
    const rtbStats = { wagered: 0, won: 0, games: 0, wins: 0 };
    rtbStats.games = rtbGames.length;
    rtbStats.wins = rtbGames.filter(g => g.player_status === 'cashed_out').length;
    rtbStats.wagered = rtbGames.reduce((sum, g) => sum + g.wager, 0);
    rtbStats.won = rtbWinTransactions.reduce((sum, t) => sum + t.amount, 0);

    // Calculate Wavelength stats (fall back to transaction-based counting since game table doesn't track winners properly)
    const wavelengthWagerTransactions = await trx('transactions')
      .where('sending_user_id', userId)
      .where('transaction_type', 'wavelength_wager')
      .whereNot('transaction_type', 'like', '%_refund_%');
    
    const wavelengthStats = { wagered: 0, won: 0, games: 0, wins: 0 };
    wavelengthStats.games = wavelengthWagerTransactions.length;
    wavelengthStats.wins = wavelengthWinTransactions.length;
    wavelengthStats.wagered = wavelengthWagerTransactions.reduce((sum, t) => sum + t.amount, 0);
    wavelengthStats.won = wavelengthWinTransactions.reduce((sum, t) => sum + t.amount, 0);

    // Calculate overall stats
    const totalWagered = heistStats.wagered + rtbStats.wagered + wavelengthStats.wagered;
    const totalWon = heistStats.won + rtbStats.won + wavelengthStats.won;
    const gamesPlayed = heistStats.games + rtbStats.games + wavelengthStats.games;
    const totalWins = heistStats.wins + rtbStats.wins + wavelengthStats.wins;

    // Calculate biggest win/loss and streaks from transaction history
    let biggestWin = 0;
    let biggestLoss = 0;
    let currentStreak = 0;
    let currentStreakType = null;

    for (const tx of allGamblingTransactions) {
      const isUserSending = tx.sending_user_id === userId;
      const isUserReceiving = tx.receiving_user_id === userId;
      const amount = tx.amount;

      if (isUserSending && (tx.transaction_type.includes('loss') || tx.transaction_type.includes('wager'))) {
        // This is a loss/wager
        if (amount > biggestLoss) biggestLoss = amount;
        
        if (currentStreakType === 'loss') {
          currentStreak++;
        } else {
          currentStreak = 1;
          currentStreakType = 'loss';
        }
      } else if (isUserReceiving && tx.transaction_type.includes('win')) {
        // This is a win
        if (amount > biggestWin) biggestWin = amount;
        
        if (currentStreakType === 'win') {
          currentStreak++;
        } else {
          currentStreak = 1;
          currentStreakType = 'win';
        }
      }
    }

    const netProfit = totalWon - totalWagered;
    const winRate = gamesPlayed > 0 ? (totalWins / gamesPlayed * 100) : 0;
    const avgWager = gamesPlayed > 0 ? (totalWagered / gamesPlayed) : 0;

    return {
      overall: {
        totalWagered,
        totalWon,
        netProfit,
        gamesPlayed,
        wins: totalWins,
        winRate,
        avgWager,
        biggestWin,
        biggestLoss,
        currentStreak,
        currentStreakType
      },
      byGame: {
        heist: heistStats,
        rtb: rtbStats,
        wavelength: wavelengthStats
      },
      recentTransactions: allGamblingTransactions.slice(0, 10)
    };
  });
}

async function getGamblingLeaderboard(type = 'profit') {
  return await db.transaction(async (trx) => {
    let query;
    
    if (type === 'profit') {
      // Calculate net profit for each user
      query = trx.raw(`
        SELECT 
          u.user_id,
          COALESCE(wins.total_won, 0) - COALESCE(wagers.total_wagered, 0) as net_profit,
          COALESCE(wagers.games_played, 0) as games_played
        FROM users u
        LEFT JOIN (
          SELECT 
            receiving_user_id as user_id,
            SUM(amount) as total_won
          FROM transactions 
          WHERE transaction_type IN ('heist_win', 'rtb_win_end_of_line', 'wavelength_win')
             OR transaction_type LIKE 'rtb_win_cash_out_%'
          GROUP BY receiving_user_id
        ) wins ON u.user_id = wins.user_id
        LEFT JOIN (
          SELECT 
            sending_user_id as user_id,
            SUM(amount) as total_wagered,
            COUNT(*) as games_played
          FROM transactions 
          WHERE transaction_type IN ('heist_loss', 'rtb_wager', 'wavelength_wager')
          GROUP BY sending_user_id
        ) wagers ON u.user_id = wagers.user_id
        WHERE COALESCE(wagers.games_played, 0) > 0
        ORDER BY net_profit DESC
        LIMIT 10
      `);
    } else if (type === 'volume') {
      // Most games played
      query = trx.raw(`
        SELECT 
          sending_user_id as user_id,
          COUNT(*) as games_played,
          SUM(amount) as total_wagered
        FROM transactions 
        WHERE transaction_type IN ('heist_loss', 'rtb_wager', 'wavelength_wager')
        GROUP BY sending_user_id
        ORDER BY games_played DESC
        LIMIT 10
      `);
    } else if (type === 'winrate') {
      // Highest win rate (min 10 games) - using proper game tables for RTB
      query = trx.raw(`
        WITH heist_stats AS (
          SELECT 
            CASE 
              WHEN t.sending_user_id IS NOT NULL THEN t.sending_user_id
              ELSE t.receiving_user_id 
            END as user_id,
            COUNT(*) as games,
            SUM(CASE WHEN t.transaction_type = 'heist_win' THEN 1 ELSE 0 END) as wins
          FROM transactions t
          WHERE t.transaction_type IN ('heist_win', 'heist_loss')
          GROUP BY CASE 
            WHEN t.sending_user_id IS NOT NULL THEN t.sending_user_id
            ELSE t.receiving_user_id 
          END
        ),
        rtb_stats AS (
          SELECT 
            bgp.user_id,
            COUNT(*) as games,
            SUM(CASE WHEN bgp.player_status = 'cashed_out' THEN 1 ELSE 0 END) as wins
          FROM bus_games bg
          JOIN bus_game_players bgp ON bg.id = bgp.game_id
          WHERE bg.status = 'finished'
          GROUP BY bgp.user_id
        ),
        wavelength_stats AS (
          SELECT 
            t.sending_user_id as user_id,
            COUNT(*) as games,
            COUNT(w.receiving_user_id) as wins
          FROM transactions t
          LEFT JOIN transactions w ON w.receiving_user_id = t.sending_user_id 
            AND w.transaction_type = 'wavelength_win'
            AND DATE(w.created_at) = DATE(t.created_at)
          WHERE t.transaction_type = 'wavelength_wager'
          GROUP BY t.sending_user_id
        )
        SELECT 
          u.user_id,
          COALESCE(h.wins, 0) + COALESCE(r.wins, 0) + COALESCE(w.wins, 0) as wins,
          COALESCE(h.games, 0) + COALESCE(r.games, 0) + COALESCE(w.games, 0) as games_played,
          CASE 
            WHEN COALESCE(h.games, 0) + COALESCE(r.games, 0) + COALESCE(w.games, 0) > 0 
            THEN ROUND((COALESCE(h.wins, 0) + COALESCE(r.wins, 0) + COALESCE(w.wins, 0)) * 100.0 / (COALESCE(h.games, 0) + COALESCE(r.games, 0) + COALESCE(w.games, 0)), 1)
            ELSE 0 
          END as win_rate
        FROM users u
        LEFT JOIN heist_stats h ON u.user_id = h.user_id
        LEFT JOIN rtb_stats r ON u.user_id = r.user_id  
        LEFT JOIN wavelength_stats w ON u.user_id = w.user_id
        WHERE COALESCE(h.games, 0) + COALESCE(r.games, 0) + COALESCE(w.games, 0) >= 10
        ORDER BY win_rate DESC
        LIMIT 10
      `);
    }
    
    const results = await query;
    return results.rows || results;
  });
}

module.exports = {
  db,
  findOrCreateUser,
  transfer,
  recordTransaction,
  grant,
  updateUserActivity,
  getRandomActiveUser,
  getUser,
  // Ride the Bus
  createBusGame,
  getBusGame,
  getActiveBusGame,
  updateBusGame,
  addPlayerToBusGame,
  getBusGamePlayers,
  updateBusGamePlayer,
  getBusGamePlayer,
  cancelBusGame,
  // Wavelength
  createWavelengthGame,
  getWavelengthGame,
  getActiveWavelengthGame,
  updateWavelengthGame,
  addPlayerToWavelengthGame,
  getWavelengthPlayers,
  updateWavelengthPlayer,
  getWavelengthPlayer,
  cancelWavelengthGame,
  // Wordle
  processWordleTransaction,
  // Gambling Stats
  getGamblingStats,
  getGamblingLeaderboard,
  // Federal GarryCoin Reserve
  recordFGREvent,
  getFGREvents,
  castFGRVote,
  getFGRVotes,
  createFGRPolicy,
  getFGRPolicy,
  updateFGRPolicy,
  getEconomicMetrics,
};

// --- Ride the Bus Functions

async function createBusGame(hostId, channelId, messageId, wager) {
  return withRetry(() => db.transaction(async trx => {
    const [game] = await trx('bus_games').insert({
      host_user_id: hostId,
      channel_id: channelId,
      message_id: messageId,
      wager: wager,
      status: 'waiting_for_players',
      current_phase: 'joining',
    }).returning('*');

    await trx('bus_game_players').insert({
      game_id: game.id,
      user_id: hostId,
    });

    console.log(`Created new bus game with ID: ${game.id} by host: ${hostId}`);
    return game;
  }));
}

async function getBusGame(gameId) {
  return withRetry(() => db('bus_games').where({ id: gameId }).first());
}

async function getActiveBusGame() {
  return withRetry(() => db('bus_games')
    .whereIn('status', ['waiting_for_players', 'active'])
    .first());
}

async function updateBusGame(gameId, updates) {
  return withRetry(() => db('bus_games').where({ id: gameId }).update(updates));
}

async function addPlayerToBusGame(gameId, userId) {
  return withRetry(async () => {
    const existingPlayer = await db('bus_game_players').where({ game_id: gameId, user_id: userId }).first();
    if (existingPlayer) {
      console.log(`User ${userId} is already in game ${gameId}.`);
      return { success: false, message: 'already_joined' };
    }

    await db('bus_game_players').insert({
      game_id: gameId,
      user_id: userId,
    });

    console.log(`Added player ${userId} to game ${gameId}`);
    return { success: true };
  });
}

async function getBusGamePlayers(gameId) {
  return withRetry(() => db('bus_game_players').where({ game_id: gameId }));
}

async function updateBusGamePlayer(gameId, userId, updates) {
  return withRetry(() => db('bus_game_players')
    .where({ game_id: gameId, user_id: userId })
    .update(updates));
}

async function getBusGamePlayer(gameId, userId) {
  return withRetry(() => db('bus_game_players').where({ game_id: gameId, user_id: userId }).first());
}

async function cancelBusGame(gameId) {
  return withRetry(() => db('bus_games').where({ id: gameId }).update({ status: 'cancelled' }));
} ""

// --- Wavelength Functions ---

async function createWavelengthGame(hostId, channelId, messageId, wager, scaleLeft, scaleRight, targetNumber, hostWord, showPlayerGuesses) {
  return withRetry(() => db.transaction(async trx => {
    const [game] = await trx('wavelength_games').insert({
      host_user_id: hostId,
      channel_id: channelId,
      message_id: messageId,
      wager: wager,
      status: 'waiting_for_players',
      scale_left: scaleLeft,
      scale_right: scaleRight,
      target_number: targetNumber,
      host_word: hostWord,
      show_player_guesses: showPlayerGuesses,
    }).returning('*');

    console.log(`Created new Wavelength game with ID: ${game.id} by host: ${hostId}`);
    return game;
  }));
}

async function getWavelengthGame(gameId) {
  return withRetry(() => db('wavelength_games').where({ id: gameId }).first());
}

async function getActiveWavelengthGame() {
  return withRetry(() => db('wavelength_games')
    .whereIn('status', ['waiting_for_host_input', 'waiting_for_players', 'guessing'])
    .first());
}

async function updateWavelengthGame(gameId, updates) {
  return withRetry(() => db('wavelength_games').where({ id: gameId }).update(updates));
}

async function addPlayerToWavelengthGame(gameId, userId) {
  return withRetry(async () => {
    const existingPlayer = await db('wavelength_players').where({ game_id: gameId, user_id: userId }).first();
    if (existingPlayer) {
      console.log(`User ${userId} is already in game ${gameId}.`);
      return { success: false, message: 'already_joined' };
    }

    await db('wavelength_players').insert({
      game_id: gameId,
      user_id: userId,
      player_status: 'joined',
    });

    console.log(`Added player ${userId} to game ${gameId}`);
    return { success: true };
  });
}

async function getWavelengthPlayers(gameId) {
  return withRetry(() => db('wavelength_players').where({ game_id: gameId }));
}

async function updateWavelengthPlayer(gameId, userId, updates) {
  return withRetry(() => db('wavelength_players')
    .where({ game_id: gameId, user_id: userId })
    .update(updates));
}

async function getWavelengthPlayer(gameId, userId) {
  return withRetry(() => db('wavelength_players').where({ game_id: gameId, user_id: userId }).first());
}

async function cancelWavelengthGame(gameId) {
  return withRetry(() => db('wavelength_games').where({ id: gameId }).update({ status: 'cancelled' }));
}

// --- Wordle Functions ---

async function processWordleTransaction(userId, tries, amount, isCheater, transactionType) {
  const today = new Date().toISOString().slice(0, 10);

  return withRetry(() => db.transaction(async trx => {
    // Update user balance
    if (amount > 0) {
      await trx('users').where({ user_id: userId }).increment('balance', amount);
    } else if (amount < 0) {
      await trx('users').where({ user_id: userId }).decrement('balance', Math.abs(amount));
    }

    // Record in transactions table
    await trx('transactions').insert({
      sending_user_id: isCheater ? userId : 'wordle_bot',
      receiving_user_id: isCheater ? 'wordle_bot' : userId,
      amount: Math.abs(amount),
      transaction_type: transactionType,
    });

    // Record in wordle_rewards table
    await trx('wordle_rewards').insert({
      user_id: userId,
      reward_date: today,
      tries: tries,
      reward_amount: amount,
      was_caught_cheating: isCheater,
    });
  }));
}

// --- Federal GarryCoin Reserve Functions ---

async function recordFGREvent(eventType, description, eventData = {}, coinsDistributed = 0, usersAffected = 0) {
  return withRetry(() => db('fgr_events').insert({
    event_type: eventType,
    description,
    event_data: eventData,
    coins_distributed: coinsDistributed,
    users_affected: usersAffected
  }).returning('*'));
}

async function getFGREvents(limit = 10) {
  return withRetry(() => db('fgr_events')
    .orderBy('created_at', 'desc')
    .limit(limit));
}

async function castFGRVote(userId, policyType, voteChoice) {
  return withRetry(() => db('fgr_votes')
    .insert({
      user_id: userId,
      policy_type: policyType,
      vote_choice: voteChoice
    })
    .onConflict(['policy_type', 'user_id'])
    .merge(['vote_choice', 'created_at'])
    .returning('*'));
}

async function getFGRVotes(policyType) {
  return withRetry(() => db('fgr_votes')
    .where({ policy_type: policyType })
    .orderBy('created_at', 'desc'));
}

async function createFGRPolicy(policyName, policyData = {}, expiresAt = null) {
  return withRetry(() => db('fgr_policies').insert({
    policy_name: policyName,
    policy_data: policyData,
    expires_at: expiresAt
  }).returning('*'));
}

async function getFGRPolicy(policyName) {
  return withRetry(() => db('fgr_policies')
    .where({ policy_name: policyName, status: 'active' })
    .first());
}

async function updateFGRPolicy(policyName, updates) {
  return withRetry(() => db('fgr_policies')
    .where({ policy_name: policyName })
    .update(updates));
}

async function getEconomicMetrics() {
  return withRetry(async () => {
    // Get overall gambling metrics for economic analysis
    const [
      totalUsers,
      activeUsers,
      totalBalance,
      recentTransactions,
      gamblingVolume,
      heistStats,
      rtbStats,
      wavelengthStats
    ] = await Promise.all([
      // Total registered users
      db('users').count('* as count').first(),
      
      // Active users (last 7 days)
      db('users')
        .where('last_active_at', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .count('* as count')
        .first(),
      
      // Total GarryCoin in circulation
      db('users').sum('balance as total').first(),
      
      // Recent transaction volume (last 24 hours)
      db('transactions')
        .where('created_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
        .count('* as count')
        .first(),
      
      // Total gambling volume (last 7 days)
      db('transactions')
        .where('created_at', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .whereIn('transaction_type', ['heist_loss', 'rtb_wager', 'wavelength_wager'])
        .sum('amount as total')
        .first(),
      
      // Heist metrics
      db('transactions')
        .where('created_at', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .where('transaction_type', 'like', 'heist_%')
        .select(
          db.raw('COUNT(*) as total_games'),
          db.raw('SUM(CASE WHEN transaction_type = \'heist_win\' THEN 1 ELSE 0 END) as wins'),
          db.raw('SUM(CASE WHEN transaction_type = \'heist_loss\' THEN amount ELSE 0 END) as volume')
        )
        .first(),
      
      // RTB metrics
      db('bus_games')
        .where('created_at', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .where('status', 'finished')
        .select(
          db.raw('COUNT(*) as games'),
          db.raw('AVG(wager) as avg_wager'),
          db.raw('SUM(wager) as total_volume')
        )
        .first(),
      
      // Wavelength metrics
      db('wavelength_games')
        .where('created_at', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .where('status', 'finished')
        .select(
          db.raw('COUNT(*) as games'),
          db.raw('AVG(wager) as avg_wager'),
          db.raw('SUM(wager) as total_volume')
        )
        .first()
    ]);

    return {
      userMetrics: {
        totalUsers: parseInt(totalUsers.count),
        activeUsers: parseInt(activeUsers.count),
        activityRate: totalUsers.count > 0 ? (activeUsers.count / totalUsers.count * 100) : 0
      },
      economicMetrics: {
        totalSupply: parseInt(totalBalance.total || 0),
        recentTransactionVolume: parseInt(recentTransactions.count),
        weeklyGamblingVolume: parseInt(gamblingVolume.total || 0)
      },
      gameMetrics: {
        heist: {
          games: parseInt(heistStats.total_games || 0),
          winRate: heistStats.total_games > 0 ? (heistStats.wins / heistStats.total_games * 100) : 0,
          volume: parseInt(heistStats.volume || 0)
        },
        rtb: {
          games: parseInt(rtbStats.games || 0),
          avgWager: parseFloat(rtbStats.avg_wager || 0),
          volume: parseInt(rtbStats.total_volume || 0)
        },
        wavelength: {
          games: parseInt(wavelengthStats.games || 0),
          avgWager: parseFloat(wavelengthStats.avg_wager || 0),
          volume: parseInt(wavelengthStats.total_volume || 0)
        }
      }
    };
  });
}
