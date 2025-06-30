const db = require('./db');

const [userId, amount] = process.argv.slice(2);

if (!userId || !amount) {
  console.error('Usage: npm run grant_gc <userId> <amount>');
  process.exit(1);
}

async function grantGarryCoin() {
  try {
    // Check if user exists
    const user = await db.raw('SELECT * FROM users WHERE user_id = ?', [userId]);

    if (user.rows.length > 0) {
      // Update existing user's balance
      await db.raw('UPDATE users SET balance = balance + ? WHERE user_id = ?', [amount, userId]);
      console.log(`Updated user ${userId}: added ${amount} GarryCoin.`);
    } else {
      // Insert new user
      await db.raw('INSERT INTO users (user_id, balance) VALUES (?, ?)', [userId, amount]);
      console.log(`Created user ${userId} with ${amount} GarryCoin.`);
    }
    console.log(`Granting ${amount} GarryCoin to user ${userId} successful.`);
  } catch (error) {
    console.error(`Error granting GarryCoin to user ${userId}:`, error);
    process.exit(1);
  } finally {
    db.destroy(); // Close the database connection
  }
}

grantGarryCoin();