const knex = require('knex');
const knexConfig = require('../knexfile');

const environment = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[environment]);

async function findOrCreateUser(userId) {
  let user = await db('users').where({ user_id: userId }).first();
  if (user) {
    // User exists, update their last active time
    await db('users').where({ user_id: userId }).update({ last_active_at: db.fn.now() });
  } else {
    // User doesn't exist, create them
    user = { user_id: userId, balance: 0, last_active_at: db.fn.now() };
    await db('users').insert(user);
  }
  return user;
}

async function updateUserActivity(userId) {
  console.log(`updating ${userId} last activity`)
  await db('users').where({ user_id: userId }).update({ last_active_at: db.fn.now() });
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
};

// --- Ride the Bus Functions ---

async function createBusGame(hostId, channelId, messageId, wager) {
  return db.transaction(async trx => {
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
  });
}

async function getBusGame(gameId) {
  return db('bus_games').where({ id: gameId }).first();
}

async function getActiveBusGame() {
  return db('bus_games')
    .whereIn('status', ['waiting_for_players', 'active'])
    .first();
}

async function updateBusGame(gameId, updates) {
  return db('bus_games').where({ id: gameId }).update(updates);
}

async function addPlayerToBusGame(gameId, userId) {
  // First, check if the player is already in the game to avoid violating the unique constraint.
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
}

async function getBusGamePlayers(gameId) {
  return db('bus_game_players').where({ game_id: gameId });
}

async function updateBusGamePlayer(gameId, userId, updates) {
  return db('bus_game_players')
    .where({ game_id: gameId, user_id: userId })
    .update(updates);
}

async function getBusGamePlayer(gameId, userId) {
  return db('bus_game_players').where({ game_id: gameId, user_id: userId }).first();
}

async function cancelBusGame(gameId) {
  return db('bus_games').where({ id: gameId }).update({ status: 'cancelled' });
}