const { grant, db } = require('./db');

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

    const result = await grant(userId, parsedAmount, 'house_grant');

    if (result.success) {
      console.log(`Successfully granted ${parsedAmount} GarryCoin to user ${userId}.`);
    } else {
      console.error(`Failed to grant GarryCoin to user ${userId}: ${result.message}`);
    }
  } catch (error) {
    console.error(`Error granting GarryCoin to user ${userId}:`, error);
    process.exit(1);
  } finally {
    db.destroy(); // Close the database connection
  }
}

grantGarryCoin();