#!/usr/bin/env node

/**
 * Test script for FGR Loan Bailout System
 * Tests various scenarios of loan repayment with Federal GarryCoin Reserve intervention
 */

const {
  db,
  findOrCreateUser,
  getUser,
  createLoan,
  payLoan,
  transfer,
  grant
} = require('./src/db');

// Test user IDs
const BORROWER_ID = 'test_borrower_123';
const LENDER_ID = 'test_lender_456';
const BOT_ID = 'test_bot_789';

async function setupTestUsers() {
  console.log('🔧 Setting up test users...');
  
  // Create test users with known balances
  await findOrCreateUser(BORROWER_ID);
  await findOrCreateUser(LENDER_ID);
  await findOrCreateUser(BOT_ID);
  
  // Set specific balances for testing
  await db('users').where({ user_id: BORROWER_ID }).update({ balance: 50 });
  await db('users').where({ user_id: LENDER_ID }).update({ balance: 1000 });
  await db('users').where({ user_id: BOT_ID }).update({ balance: 0 }); // Bot starts with no money
  
  console.log('✅ Test users created with initial balances');
}

async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...');
  
  // Delete test loans
  await db('loans').whereIn('borrower_user_id', [BORROWER_ID]).del();
  await db('loans').whereIn('lender_user_id', [LENDER_ID]).del();
  
  // Delete test transactions
  await db('transactions').whereIn('sending_user_id', [BORROWER_ID, LENDER_ID, BOT_ID, 'fgr']).del();
  await db('transactions').whereIn('receiving_user_id', [BORROWER_ID, LENDER_ID, BOT_ID]).del();
  
  // Delete test users
  await db('users').whereIn('user_id', [BORROWER_ID, LENDER_ID, BOT_ID]).del();
  
  console.log('✅ Test data cleaned up');
}

async function testScenario1_PureFGRGrant() {
  console.log('\n🧪 TEST SCENARIO 1: Pure FGR Grant (Bot has no money)');
  console.log('='.repeat(60));
  
  await setupTestUsers();
  
  // Create loan: borrower gets 100 GC, so they'll have 150 total
  const loanResult = await createLoan(BORROWER_ID, LENDER_ID, 100, 5); // 5% daily interest
  console.log(`📋 Created loan #${loanResult.loan.id}: 100 GC from lender to borrower`);
  
  // Now drain borrower's money to simulate insufficient funds for repayment
  await db('users').where({ user_id: BORROWER_ID }).update({ balance: 25 });
  console.log('💸 Drained borrower balance to 25 GC to simulate insufficient funds');
  
  // Check balances before repayment
  const borrowerBefore = await getUser(BORROWER_ID);
  const lenderBefore = await getUser(LENDER_ID);
  const botBefore = await getUser(BOT_ID);
  
  console.log('\n💰 Balances BEFORE repayment:');
  console.log(`   Borrower: ${borrowerBefore.balance} GC`);
  console.log(`   Lender: ${lenderBefore.balance} GC`);
  console.log(`   Bot: ${botBefore.balance} GC`);
  
  // Attempt repayment - borrower only has 50 GC but loan is 100 GC
  console.log('\n💸 Processing loan repayment...');
  const paymentResult = await payLoan(loanResult.loan.id, 100, BOT_ID);
  
  console.log('\n📊 Payment Result:');
  console.log(`   Success: ${paymentResult.success}`);
  console.log(`   Borrower paid: ${paymentResult.paid_amount} GC`);
  console.log(`   Total due: ${paymentResult.total_due} GC`);
  console.log(`   Went into debt: ${paymentResult.went_into_debt}`);
  console.log(`   FGR bailout: ${paymentResult.fgr_bailout}`);
  
  if (paymentResult.fgr_bailout) {
    console.log(`   Bailout details:`, paymentResult.bailout_details);
  }
  
  // Check balances after repayment
  const borrowerAfter = await getUser(BORROWER_ID);
  const lenderAfter = await getUser(LENDER_ID);
  const botAfter = await getUser(BOT_ID);
  
  console.log('\n💰 Balances AFTER repayment:');
  console.log(`   Borrower: ${borrowerAfter.balance} GC (change: ${borrowerAfter.balance - borrowerBefore.balance})`);
  console.log(`   Lender: ${lenderAfter.balance} GC (change: ${lenderAfter.balance - lenderBefore.balance})`);
  console.log(`   Bot: ${botAfter.balance} GC (change: ${botAfter.balance - botBefore.balance})`);
  
  // Verify expected outcomes  
  console.log('\n✅ VERIFICATION:');
  console.log(`   ✓ Borrower should be at 0 GC (FGR protection): ${borrowerAfter.balance === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`   ✓ Lender should have gained 100 GC: ${lenderAfter.balance - lenderBefore.balance === 100 ? 'PASS' : 'FAIL'}`);
  console.log(`   ✓ FGR bailout occurred: ${paymentResult.fgr_bailout ? 'PASS' : 'FAIL'}`);
  console.log(`   ✓ Pure grant (75 GC created): ${paymentResult.bailout_details?.grantedAmount === 75 ? 'PASS' : 'FAIL'}`);
}

async function testScenario2_BotHasSomeMoney() {
  console.log('\n🧪 TEST SCENARIO 2: Bot has partial money (Transfer + Grant)');
  console.log('='.repeat(60));
  
  await cleanupTestData();
  await setupTestUsers();
  
  // Give bot some money (but not enough)
  await db('users').where({ user_id: BOT_ID }).update({ balance: 30 });
  
  // Create loan and then drain borrower funds
  const loanResult = await createLoan(BORROWER_ID, LENDER_ID, 100, 5);
  console.log(`📋 Created loan #${loanResult.loan.id}: 100 GC from lender to borrower`);
  
  // Drain borrower's money to simulate insufficient funds
  await db('users').where({ user_id: BORROWER_ID }).update({ balance: 25 });
  console.log('💸 Drained borrower balance to 25 GC to simulate insufficient funds');
  
  // Check balances before repayment
  const borrowerBefore = await getUser(BORROWER_ID);
  const lenderBefore = await getUser(LENDER_ID);
  const botBefore = await getUser(BOT_ID);
  
  console.log('\n💰 Balances BEFORE repayment:');
  console.log(`   Borrower: ${borrowerBefore.balance} GC`);
  console.log(`   Lender: ${lenderBefore.balance} GC`);
  console.log(`   Bot: ${botBefore.balance} GC`);
  
  // Attempt repayment
  console.log('\n💸 Processing loan repayment...');
  const paymentResult = await payLoan(loanResult.loan.id, 100, BOT_ID);
  
  console.log('\n📊 Payment Result:');
  console.log(`   Success: ${paymentResult.success}`);
  console.log(`   Borrower paid: ${paymentResult.paid_amount} GC`);
  console.log(`   FGR bailout: ${paymentResult.fgr_bailout}`);
  
  if (paymentResult.fgr_bailout) {
    console.log(`   Bailout details:`, paymentResult.bailout_details);
  }
  
  // Check balances after repayment
  const borrowerAfter = await getUser(BORROWER_ID);
  const lenderAfter = await getUser(LENDER_ID);
  const botAfter = await getUser(BOT_ID);
  
  console.log('\n💰 Balances AFTER repayment:');
  console.log(`   Borrower: ${borrowerAfter.balance} GC (change: ${borrowerAfter.balance - borrowerBefore.balance})`);
  console.log(`   Lender: ${lenderAfter.balance} GC (change: ${lenderAfter.balance - lenderBefore.balance})`);
  console.log(`   Bot: ${botAfter.balance} GC (change: ${botAfter.balance - botBefore.balance})`);
  
  // Verify expected outcomes
  console.log('\n✅ VERIFICATION:');
  console.log(`   ✓ Borrower at 0 GC (FGR protection): ${borrowerAfter.balance === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`   ✓ Bot transferred 30 GC: ${paymentResult.bailout_details?.transferredFromBot === 30 ? 'PASS' : 'FAIL'}`);
  console.log(`   ✓ FGR granted 45 GC: ${paymentResult.bailout_details?.grantedAmount === 45 ? 'PASS' : 'FAIL'}`);
  console.log(`   ✓ Bot balance is now 0: ${botAfter.balance === 0 ? 'PASS' : 'FAIL'}`);
}

async function testScenario3_BotHasEnoughMoney() {
  console.log('\n🧪 TEST SCENARIO 3: Bot has enough money (Pure Transfer)');
  console.log('='.repeat(60));
  
  await cleanupTestData();
  await setupTestUsers();
  
  // Give bot plenty of money
  await db('users').where({ user_id: BOT_ID }).update({ balance: 200 });
  
  // Create loan and then drain borrower funds
  const loanResult = await createLoan(BORROWER_ID, LENDER_ID, 100, 5);
  console.log(`📋 Created loan #${loanResult.loan.id}: 100 GC from lender to borrower`);
  
  // Drain borrower's money to simulate insufficient funds
  await db('users').where({ user_id: BORROWER_ID }).update({ balance: 25 });
  console.log('💸 Drained borrower balance to 25 GC to simulate insufficient funds');
  
  // Check balances before repayment
  const borrowerBefore = await getUser(BORROWER_ID);
  const lenderBefore = await getUser(LENDER_ID);
  const botBefore = await getUser(BOT_ID);
  
  console.log('\n💰 Balances BEFORE repayment:');
  console.log(`   Borrower: ${borrowerBefore.balance} GC`);
  console.log(`   Lender: ${lenderBefore.balance} GC`);
  console.log(`   Bot: ${botBefore.balance} GC`);
  
  // Attempt repayment
  console.log('\n💸 Processing loan repayment...');
  const paymentResult = await payLoan(loanResult.loan.id, 100, BOT_ID);
  
  console.log('\n📊 Payment Result:');
  console.log(`   Success: ${paymentResult.success}`);
  console.log(`   Borrower paid: ${paymentResult.paid_amount} GC`);
  console.log(`   FGR bailout: ${paymentResult.fgr_bailout}`);
  
  if (paymentResult.fgr_bailout) {
    console.log(`   Bailout details:`, paymentResult.bailout_details);
  }
  
  // Check balances after repayment
  const borrowerAfter = await getUser(BORROWER_ID);
  const lenderAfter = await getUser(LENDER_ID);
  const botAfter = await getUser(BOT_ID);
  
  console.log('\n💰 Balances AFTER repayment:');
  console.log(`   Borrower: ${borrowerAfter.balance} GC (change: ${borrowerAfter.balance - borrowerBefore.balance})`);
  console.log(`   Lender: ${lenderAfter.balance} GC (change: ${lenderAfter.balance - lenderBefore.balance})`);
  console.log(`   Bot: ${botAfter.balance} GC (change: ${botAfter.balance - botBefore.balance})`);
  
  // Verify expected outcomes
  console.log('\n✅ VERIFICATION:');
  console.log(`   ✓ Borrower at 0 GC (FGR protection): ${borrowerAfter.balance === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`   ✓ Bot transferred 75 GC: ${paymentResult.bailout_details?.transferredFromBot === 75 ? 'PASS' : 'FAIL'}`);
  console.log(`   ✓ No grant needed: ${paymentResult.bailout_details?.grantedAmount === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`   ✓ Bot balance reduced by 75: ${botBefore.balance - botAfter.balance === 75 ? 'PASS' : 'FAIL'}`);
}

async function testScenario4_BorrowerCanPayFull() {
  console.log('\n🧪 TEST SCENARIO 4: Borrower can pay in full (No FGR needed)');
  console.log('='.repeat(60));
  
  await cleanupTestData();
  await setupTestUsers();
  
  // Give borrower enough money
  await db('users').where({ user_id: BORROWER_ID }).update({ balance: 150 });
  
  // Create a smaller loan
  const loanResult = await createLoan(BORROWER_ID, LENDER_ID, 100, 5);
  console.log(`📋 Created loan #${loanResult.loan.id}: 100 GC from lender to borrower`);
  
  // Check balances before repayment
  const borrowerBefore = await getUser(BORROWER_ID);
  const lenderBefore = await getUser(LENDER_ID);
  const botBefore = await getUser(BOT_ID);
  
  console.log('\n💰 Balances BEFORE repayment:');
  console.log(`   Borrower: ${borrowerBefore.balance} GC`);
  console.log(`   Lender: ${lenderBefore.balance} GC`);
  console.log(`   Bot: ${botBefore.balance} GC`);
  
  // Attempt repayment
  console.log('\n💸 Processing loan repayment...');
  const paymentResult = await payLoan(loanResult.loan.id, 100, BOT_ID);
  
  console.log('\n📊 Payment Result:');
  console.log(`   Success: ${paymentResult.success}`);
  console.log(`   Borrower paid: ${paymentResult.paid_amount} GC`);
  console.log(`   FGR bailout: ${paymentResult.fgr_bailout}`);
  
  // Check balances after repayment
  const borrowerAfter = await getUser(BORROWER_ID);
  const lenderAfter = await getUser(LENDER_ID);
  const botAfter = await getUser(BOT_ID);
  
  console.log('\n💰 Balances AFTER repayment:');
  console.log(`   Borrower: ${borrowerAfter.balance} GC (change: ${borrowerAfter.balance - borrowerBefore.balance})`);
  console.log(`   Lender: ${lenderAfter.balance} GC (change: ${lenderAfter.balance - lenderBefore.balance})`);
  console.log(`   Bot: ${botAfter.balance} GC (change: ${botAfter.balance - botBefore.balance})`);
  
  // Verify expected outcomes
  console.log('\n✅ VERIFICATION:');
  console.log(`   ✓ No FGR bailout needed: ${!paymentResult.fgr_bailout ? 'PASS' : 'FAIL'}`);
  console.log(`   ✓ Borrower paid full amount: ${paymentResult.paid_amount === 100 ? 'PASS' : 'FAIL'}`);
  console.log(`   ✓ Bot balance unchanged: ${botAfter.balance === botBefore.balance ? 'PASS' : 'FAIL'}`);
}

async function checkTransactionRecords() {
  console.log('\n📋 CHECKING TRANSACTION RECORDS:');
  console.log('='.repeat(40));
  
  // Get FGR bailout transactions  
  const fgrTransactions = await db('transactions')
    .where('transaction_type', 'fgr_loan_bailout')
    .orWhere('sending_user_id', 'fgr')
    .whereIn('receiving_user_id', [LENDER_ID]); // Only test transactions
  
  console.log(`Found ${fgrTransactions.length} FGR bailout transactions:`);
  fgrTransactions.forEach(tx => {
    console.log(`   ${tx.sending_user_id} → ${tx.receiving_user_id}: ${tx.amount} GC (${tx.transaction_type})`);
  });
  
  // Get loan payment transactions
  const loanPayments = await db('transactions')
    .where('transaction_type', 'loan_payment');
  
  console.log(`\nFound ${loanPayments.length} loan payment transactions:`);
  loanPayments.forEach(tx => {
    console.log(`   ${tx.sending_user_id} → ${tx.receiving_user_id}: ${tx.amount} GC (${tx.transaction_type})`);
  });
}

async function runAllTests() {
  console.log('🚀 STARTING FGR LOAN BAILOUT TESTS');
  console.log('='.repeat(60));
  
  try {
    await testScenario1_PureFGRGrant();
    await testScenario2_BotHasSomeMoney();
    await testScenario3_BotHasEnoughMoney();
    await testScenario4_BorrowerCanPayFull();
    await checkTransactionRecords();
    
    console.log('\n🎉 ALL TESTS COMPLETED!');
    console.log('Check the results above to verify FGR bailout system is working correctly.');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    console.error(error.stack);
  } finally {
    await cleanupTestData();
    await db.destroy();
  }
}

// Run tests if called directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testScenario1_PureFGRGrant,
  testScenario2_BotHasSomeMoney,
  testScenario3_BotHasEnoughMoney,
  testScenario4_BorrowerCanPayFull
};