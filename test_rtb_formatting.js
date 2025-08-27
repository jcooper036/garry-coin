#!/usr/bin/env node

const { formatExactGC, formatApproxGC } = require('./src/number_formatter');

function testRTBFormatting() {
  console.log('🚌 Testing RTB Number Formatting');
  console.log('');

  // Test cases that would commonly appear in RTB
  const rtbScenarios = [
    { desc: 'Small wager', amount: 50, context: 'wager' },
    { desc: 'Medium wager', amount: 500, context: 'wager' },
    { desc: 'Large wager', amount: 5000, context: 'wager' },
    { desc: 'Massive wager', amount: 50000, context: 'wager' },
    { desc: 'RTB 1x payout', amount: 50, context: 'small payout' },
    { desc: 'RTB 2x payout', amount: 1000, context: 'medium payout' },
    { desc: 'RTB 4x payout', amount: 20000, context: 'large payout' },
    { desc: 'RTB 100x end-of-line', amount: 5000000, context: 'massive payout' },
    { desc: 'Capped payout scenario', amount: 1250000, context: 'capped payout' },
  ];

  console.log('💰 Testing formatExactGC (for precise payouts):');
  rtbScenarios.forEach(({ desc, amount, context }) => {
    const formatted = formatExactGC(amount);
    console.log(`  ${desc}: ${amount} → ${formatted} (${context})`);
  });

  console.log('');
  console.log('📊 Testing formatApproxGC (for general display):');
  rtbScenarios.forEach(({ desc, amount, context }) => {
    const formatted = formatApproxGC(amount);
    console.log(`  ${desc}: ${amount} → ${formatted} (${context})`);
  });

  console.log('');
  console.log('🎯 Example RTB Messages:');
  console.log(`  Wager embed: "has hailed the bus for a fare of **${formatExactGC(5000)} GC**!"`);
  console.log(`  Footer: "Wager: ${formatExactGC(5000)} GC"`);
  console.log(`  End-of-line win: "made it all the way and wins **${formatExactGC(500000)} GC**!"`);
  console.log(`  Cash-out win: "got off with **${formatExactGC(20000)} GC**."`);
  console.log(`  Refund message: "has been refunded their **${formatExactGC(2500)} GC** fare."`);

  console.log('');
  console.log('✅ RTB formatting ready! Numbers will be much more readable in Discord.');
}

testRTBFormatting();