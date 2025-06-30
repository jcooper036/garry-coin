const [userId, amount] = process.argv.slice(2);

if (!userId || !amount) {
  console.error('Usage: npm run grant_gc <userId> <amount>');
  process.exit(1);
}

console.log(`Granting ${amount} GarryCoin to user ${userId}`);

// TODO: Implement database logic to grant GarryCoin
