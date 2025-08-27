#!/usr/bin/env node

require('dotenv').config();
const { transferThenGrantCapped, getUser, grant, db } = require('./src/db');

async function testCappedTransfer() {
  const botUserId = 'test-bot-capped';
  const playerUserId = 'test-player-capped';
  
  console.log('🧪 Testing transferThenGrantCapped function');
  console.log(`Bot: ${botUserId}`);
  console.log(`Player: ${playerUserId}`);
  console.log('');

  try {
    // Setup: Give bot some limited funds
    await grant(botUserId, 50, 'test_setup');
    console.log('🔧 Setup: Granted 50 GC to bot for testing');
    
    const botBefore = await getUser(botUserId);
    const playerBefore = await getUser(playerUserId);
    
    console.log('📊 Initial balances:');
    console.log(`  ${botUserId}: ${botBefore?.balance || 0} GC`);
    console.log(`  ${playerUserId}: ${playerBefore?.balance || 0} GC`);
    console.log('');

    // Test case 1: Large payout request (1000 GC) with default 10% cap
    console.log('🔬 Test Case 1: Large payout (1000 GC) with 10% cap');
    console.log(`  Expected: Bot transfers ${botBefore?.balance || 0} GC, grants up to 100 GC (10% of 1000)`);
    
    const botBeforeTest1 = await getUser(botUserId);
    const playerBeforeTest1 = await getUser(playerUserId);
    
    const result1 = await transferThenGrantCapped(botUserId, playerUserId, 1000, 'rtb_win_test');
    
    const botAfterTest1 = await getUser(botUserId);
    const playerAfterTest1 = await getUser(playerUserId);
    
    console.log(`  Result: ${result1.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`  Message: ${result1.message}`);
    console.log(`  Actual payout: ${result1.actualAmount} GC`);
    console.log(`  ${botUserId}: ${botBeforeTest1?.balance || 0} → ${botAfterTest1?.balance || 0} GC`);
    console.log(`  ${playerUserId}: ${playerBeforeTest1?.balance || 0} → ${playerAfterTest1?.balance || 0} GC`);
    console.log('');

    // Test case 2: Custom cap percentage (5%)
    console.log('🔬 Test Case 2: Large payout (1000 GC) with 5% cap');
    await grant(botUserId, 25, 'test_setup'); // Give bot some more money
    
    const botBeforeTest2 = await getUser(botUserId);
    const playerBeforeTest2 = await getUser(playerUserId);
    
    const result2 = await transferThenGrantCapped(botUserId, playerUserId, 1000, 'rtb_win_test', 5);
    
    const botAfterTest2 = await getUser(botUserId);
    const playerAfterTest2 = await getUser(playerUserId);
    
    console.log(`  Result: ${result2.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`  Message: ${result2.message}`);
    console.log(`  Actual payout: ${result2.actualAmount} GC`);
    console.log(`  ${botUserId}: ${botBeforeTest2?.balance || 0} → ${botAfterTest2?.balance || 0} GC`);
    console.log(`  ${playerUserId}: ${playerBeforeTest2?.balance || 0} → ${playerAfterTest2?.balance || 0} GC`);
    console.log('');

    // Test case 3: Bot can afford full amount
    console.log('🔬 Test Case 3: Small payout bot can afford (20 GC)');
    await grant(botUserId, 30, 'test_setup'); // Give bot enough money
    
    const botBeforeTest3 = await getUser(botUserId);
    const playerBeforeTest3 = await getUser(playerUserId);
    
    const result3 = await transferThenGrantCapped(botUserId, playerUserId, 20, 'rtb_win_test');
    
    const botAfterTest3 = await getUser(botUserId);
    const playerAfterTest3 = await getUser(playerUserId);
    
    console.log(`  Result: ${result3.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`  Message: ${result3.message}`);
    console.log(`  Actual payout: ${result3.actualAmount || 20} GC`);
    console.log(`  ${botUserId}: ${botBeforeTest3?.balance || 0} → ${botAfterTest3?.balance || 0} GC`);
    console.log(`  ${playerUserId}: ${playerBeforeTest3?.balance || 0} → ${playerAfterTest3?.balance || 0} GC`);
    console.log('');

    console.log('🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error.stack);
  } finally {
    await db.destroy();
  }
}

if (require.main === module) {
  testCappedTransfer().catch(console.error);
}