const knex = require('knex');
const knexConfig = require('../knexfile');

const environment = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[environment]);

async function findOrCreateUser(userId) {
  let user = await db('users').where({ user_id: userId }).first();
  if (!user) {
    user = { user_id: userId, balance: 0 };
    await db('users').insert(user);
  }
  return user;
}

async function transfer(senderId, receiverId, amount) {
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

    await recordTransaction(senderId, receiverId, amount, trx);

    return { success: true, message: 'Transfer successful.' };
  });
}

async function recordTransaction(sending_user_id, receiving_user_id, amount, trx) {
  await (trx || db)('transactions').insert({
    sending_user_id,
    receiving_user_id,
    amount,
  });
}

module.exports = {
  db,
  findOrCreateUser,
  transfer,
  recordTransaction,
};