#!/usr/bin/env node

require('dotenv').config();
const { transferThenGrant, getUser, grant, db } = require('./src/db');

async function testTransferThenGrant() {
  const [senderId, receiverId] = process.argv.slice(2);

  if (!senderId || !receiverId) {
    console.error('Usage: node test_transfer_then_grant.js <senderId> <receiverId>');
    console.error('Example: node test_transfer_then_grant.js user1 user2');
    process.exit(1);
  }

  console.log('🧪 Testing transferThenGrant function');
  console.log(`Sender: ${senderId}`);
  console.log(`Receiver: ${receiverId}`);
  console.log('');

  try {
    // Get initial balances
    const senderBefore = await getUser(senderId);
    const receiverBefore = await getUser(receiverId);

    console.log('📊 Initial balances:');
    console.log(`  ${senderId}: ${senderBefore?.balance || 0} GC`);
    console.log(`  ${receiverId}: ${receiverBefore?.balance || 0} GC`);
    console.log('');

    // Test scenarios
    const testCases = [
      { amount: 10, description: 'Small amount (10 GC)' },
      { amount: 50, description: 'Medium amount (50 GC)' },
      { amount: (senderBefore?.balance || 0) + 100, description: 'Amount exceeding sender balance' },
    ];

    for (const testCase of testCases) {
      console.log(`🔬 Test: ${testCase.description}`);
      console.log(`  Attempting to transfer ${testCase.amount} GC`);

      const senderBeforeTest = await getUser(senderId);
      const receiverBeforeTest = await getUser(receiverId);

      const result = await transferThenGrant(senderId, receiverId, testCase.amount, 'test_transfer_then_grant');

      const senderAfterTest = await getUser(senderId);
      const receiverAfterTest = await getUser(receiverId);

      console.log(`  Result: ${result.success ? '✅ Success' : '❌ Failed'}`);
      console.log(`  Message: ${result.message}`);
      const senderChange = (senderAfterTest?.balance || 0) - (senderBeforeTest?.balance || 0);
      const receiverChange = (receiverAfterTest?.balance || 0) - (receiverBeforeTest?.balance || 0);
      console.log(`  ${senderId}: ${senderBeforeTest?.balance || 0} → ${senderAfterTest?.balance || 0} GC (${senderChange >= 0 ? '+' : ''}${senderChange})`);
      console.log(`  ${receiverId}: ${receiverBeforeTest?.balance || 0} → ${receiverAfterTest?.balance || 0} GC (${receiverChange >= 0 ? '+' : ''}${receiverChange})`);

      // Verify the transfer
      const expectedSenderDecrease = Math.min(senderBeforeTest?.balance || 0, testCase.amount);
      const actualSenderChange = (senderAfterTest?.balance || 0) - (senderBeforeTest?.balance || 0);
      const actualReceiverChange = (receiverAfterTest?.balance || 0) - (receiverBeforeTest?.balance || 0);

      if (-actualSenderChange === expectedSenderDecrease && actualReceiverChange === testCase.amount) {
        console.log(`  ✅ Balances are correct`);
      } else {
        console.log(`  ❌ Balance mismatch!`);
        console.log(`    Expected sender decrease: ${expectedSenderDecrease} `);
        console.log(`    Actual sender change: ${actualSenderChange} `);
        console.log(`    Expected receiver increase: ${testCase.amount} `);
        console.log(`    Actual receiver increase: ${actualReceiverChange} `);
      }

      console.log('');
    }

    // Test edge cases
    console.log('🔬 Edge case tests:');

    // Test with zero amount
    console.log('  Testing zero amount:');
    const zeroResult = await transferThenGrant(senderId, receiverId, 0, 'test_zero');
    console.log(`    Result: ${zeroResult.success ? '✅ Success' : '❌ Failed'} - ${zeroResult.message} `);

    // Test with negative amount
    console.log('  Testing negative amount:');
    const negativeResult = await transferThenGrant(senderId, receiverId, -10, 'test_negative');
    console.log(`    Result: ${negativeResult.success ? '✅ Success' : '❌ Failed'} - ${negativeResult.message} `);

    console.log('');
    console.log('🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error.stack);
  } finally {
    await db.destroy();
  }
}

// Setup test users if they don't exist
async function setupTestUsers(senderId, receiverId) {
  // Give sender some initial funds for testing
  await grant(senderId, 100, 'test_setup');
  console.log(`🔧 Setup: Granted 100 GC to ${senderId} for testing`);
}

async function main() {
  const [senderId, receiverId] = process.argv.slice(2);

  if (!senderId || !receiverId) {
    console.error('Usage: node test_transfer_then_grant.js <senderId> <receiverId>');
    console.error('Example: node test_transfer_then_grant.js user1 user2');
    process.exit(1);
  }

  // Setup test users
  await setupTestUsers(senderId, receiverId);

  // Run tests
  await testTransferThenGrant();
}

if (require.main === module) {
  main().catch(console.error);
}