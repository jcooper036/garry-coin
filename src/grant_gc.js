const { db, findOrCreateUser } = require('./db');

const [userId, amount] = process.argv.slice(2);

if (!userId || !amount) {
  console.error('Usage: npm run grant_gc <userId> <amount>');
  process.exit(1);
}

async function grantGarryCoin() {
  try {
    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount)) {
      console.error('Amount must be a number.');
      process.exit(1);
    }

    const user = await findOrCreateUser(userId);

    await db('users').where({ user_id: userId }).increment('balance', parsedAmount);

    console.log(`Granting ${parsedAmount} GarryCoin to user ${userId} successful. New balance: ${user.balance + parsedAmount}`);
  } catch (error) {
    console.error(`Error granting GarryCoin to user ${userId}:`, error);
    process.exit(1);
  } finally {
    db.destroy(); // Close the database connection
  }
}

grantGarryCoin();