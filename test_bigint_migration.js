#!/usr/bin/env node

require('dotenv').config();
const { db, grant, getUser } = require('./src/db');

async function testBigIntMigration() {
  const testUserId = 'bigint-test-user-12345';
  
  console.log('🧪 Testing BIGINT migration with massive numbers...');
  console.log('');

  try {
    // Test 1: Insert a really large number (1 trillion GC)
    const massiveAmount = 1000000000000; // 1 trillion GC
    console.log(`💰 Granting ${massiveAmount.toLocaleString()} GC to test user...`);
    
    const grantResult = await grant(testUserId, massiveAmount, 'bigint_test');
    console.log(`✅ Grant result: ${grantResult.message}`);

    // Check the balance
    const userAfterGrant = await getUser(testUserId);
    console.log(`📊 User balance after grant: ${userAfterGrant.balance.toLocaleString()} GC`);
    
    // Test 2: Try an even bigger number (1 quadrillion GC)
    const evenBiggerAmount = 1000000000000000; // 1 quadrillion GC
    console.log('');
    console.log(`💸 Adding another ${evenBiggerAmount.toLocaleString()} GC...`);
    
    await grant(testUserId, evenBiggerAmount, 'bigint_test_huge');
    const userAfterSecondGrant = await getUser(testUserId);
    console.log(`📊 User balance after second grant: ${userAfterSecondGrant.balance.toLocaleString()} GC`);

    // Test 3: Verify the total is correct
    const expectedTotal = massiveAmount + evenBiggerAmount;
    const actualTotal = parseInt(userAfterSecondGrant.balance);
    
    console.log('');
    console.log('🔍 Verification:');
    console.log(`   Expected total: ${expectedTotal.toLocaleString()} GC`);
    console.log(`   Actual total:   ${actualTotal.toLocaleString()} GC`);
    console.log(`   ✅ Match: ${expectedTotal === actualTotal ? 'YES' : 'NO'}`);

    // Test 4: Test maximum safe integer (JavaScript limit)
    const maxSafeInt = Number.MAX_SAFE_INTEGER; // 9,007,199,254,740,991
    console.log('');
    console.log(`🚀 Testing JavaScript MAX_SAFE_INTEGER: ${maxSafeInt.toLocaleString()}`);
    
    // Clean up and start fresh for max safe int test
    await db('users').where({ user_id: testUserId }).del();
    await grant(testUserId, maxSafeInt, 'max_safe_int_test');
    
    const userWithMaxInt = await getUser(testUserId);
    console.log(`📊 Balance with MAX_SAFE_INTEGER: ${parseInt(userWithMaxInt.balance).toLocaleString()} GC`);
    console.log(`   ✅ Stored correctly: ${parseInt(userWithMaxInt.balance) === maxSafeInt ? 'YES' : 'NO'}`);

    console.log('');
    console.log('🎉 BIGINT migration test completed successfully!');
    console.log('💾 Database can now handle massive GarryCoin amounts!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup: Remove the test user
    console.log('');
    console.log('🧹 Cleaning up test data...');
    
    try {
      const deleteResult = await db('users').where({ user_id: testUserId }).del();
      console.log(`✅ Deleted ${deleteResult} test user record`);
      
      const transactionDeleteResult = await db('transactions')
        .where('receiving_user_id', testUserId)
        .orWhere('sending_user_id', testUserId)
        .del();
      console.log(`✅ Deleted ${transactionDeleteResult} test transaction records`);
      
      console.log('🎯 Cleanup complete!');
    } catch (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError.message);
    }
    
    await db.destroy();
  }
}

if (require.main === module) {
  testBigIntMigration().catch(console.error);
}