const knex = require('knex');
const knexConfig = require('../knexfile');

const environment = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[environment]);

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 2000;

async function withRetry(fn, retries = MAX_RETRIES, delay = RETRY_DELAY_MS) {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && (error.code === 'ECONNRESET' || error.message.includes('Connection terminated'))) {
      console.log(`Database connection error: "${error.message}". Retrying in ${delay / 1000}s... (${retries} retries left)`);
      await new Promise(res => setTimeout(res, delay));
      return withRetry(fn, retries - 1, delay);
    } else {
      console.error(`Database operation failed after all retries or for a non-retriable error:`, error);
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
    console.log(`updating ${userId} last activity`);
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

async function grant(receiverId, amount, transaction_type) {
  return db.transaction(async trx => {
    await findOrCreateUser(receiverId);
    await trx('users').where({ user_id: receiverId }).increment('balance', amount);
    const senderId = transaction_type === 'lottery_grant' ? 'lottery' : 'house';
    await recordTransaction(senderId, receiverId, amount, transaction_type, trx);
    return { success: true, message: 'Grant successful.' };
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
  checkWordleDay,
  processWordleTransaction,
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

async function checkWordleDay(today, userIds) {
    return withRetry(() => db('wordle_rewards')
        .where('reward_date', today)
        .whereIn('user_id', userIds)
        .first());
}

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
