require('dotenv').config();
const { 
  calculateCreditScore, 
  createLoan, 
  getUserLoans,
  getAllActiveLoans,
  payLoan,
  createFGRPolicy,
  getFGRPolicy,
  updateFGRPolicy
} = require('./db');
const { structuredLog } = require('./logger');

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  try {
    switch (command) {
      case 'credit-score':
        await testCreditScore(args[0]);
        break;
      case 'create-loan':
        await testCreateLoan(args[0], args[1], args[2], args[3]);
        break;
      case 'list-active-loans':
        await listActiveLoans(args[0]);
        break;
      case 'pay-loan':
        await testPayLoan(args[0]);
        break;
      case 'set-interest-rate':
        await setInterestRate(args[0]);
        break;
      case 'get-interest-rate':
        await getInterestRate();
        break;
      case 'test-all':
        await runAllTests();
        break;
      default:
        console.log('GarryCoin Loan System CLI');
        console.log('Usage: node loan_cli.js <command> [args...]');
        console.log('');
        console.log('Commands:');
        console.log('  credit-score <userId>                     - Calculate credit score for user');
        console.log('  create-loan <borrower> <lender> <amount> <rate> - Create a test loan');
        console.log('  list-active-loans [userId]                - List active loans (all or for user)');
        console.log('  pay-loan <loanId>                         - Manually process loan payment');
        console.log('  set-interest-rate <rate>                  - Set FGR base interest rate');
        console.log('  get-interest-rate                         - Get current base interest rate');
        console.log('  test-all                                  - Run comprehensive test suite');
        console.log('');
        console.log('Examples:');
        console.log('  node loan_cli.js credit-score 123456789');
        console.log('  node loan_cli.js create-loan 123456789 garry_bot 100 5.5');
        console.log('  node loan_cli.js set-interest-rate 4.25');
    }
  } catch (error) {
    console.error('Error:', error.message);
    structuredLog.loan('Loan CLI error', { 
      command, 
      args, 
      error: error.message 
    });
  } finally {
    process.exit(0);
  }
}

async function testCreditScore(userId) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  console.log(`\\n=== CREDIT SCORE CALCULATION FOR ${userId} ===`);
  
  const creditScore = await calculateCreditScore(userId);
  console.log(`Credit Score: ${creditScore}`);
  
  // Get detailed breakdown
  const { getUser, getGamblingStats, getLoanHistory } = require('./db');
  const user = await getUser(userId);
  const gamblingStats = await getGamblingStats(userId);
  const loanHistory = await getLoanHistory(userId);
  
  if (!user) {
    console.log('User not found in database');
    return;
  }
  
  console.log(`\\nBreakdown:`);
  console.log(`- Current Balance: ${user.balance} GC`);
  console.log(`- Gambling Win Rate: ${gamblingStats.overall.winRate?.toFixed(1) || 0}%`);
  console.log(`- Games Played: ${gamblingStats.overall.gamesPlayed}`);
  console.log(`- Total Loans: ${loanHistory.totalLoans}`);
  console.log(`- Debt Events: ${loanHistory.debtEvents}`);
  console.log(`- On-Time Payments: ${loanHistory.onTimePayments}`);
}

async function testCreateLoan(borrowerId, lenderId, amount, rate) {
  if (!borrowerId || !lenderId || !amount) {
    throw new Error('borrowerId, lenderId, and amount are required');
  }

  const loanAmount = parseInt(amount);
  const interestRate = parseFloat(rate || '5.0');

  console.log(`\\n=== CREATING LOAN ===`);
  console.log(`Borrower: ${borrowerId}`);
  console.log(`Lender: ${lenderId}`);
  console.log(`Amount: ${loanAmount} GC`);
  console.log(`Interest Rate: ${interestRate}%`);

  const result = await createLoan(borrowerId, lenderId, loanAmount, interestRate);
  
  if (result.success) {
    console.log(`✅ Loan created successfully!`);
    console.log(`Loan ID: ${result.loan.id}`);
    console.log(`Due Date: ${result.loan.due_date}`);
  } else {
    console.log(`❌ Loan creation failed: ${result.message}`);
  }
}

async function listActiveLoans(userId) {
  console.log(`\\n=== ACTIVE LOANS ${userId ? `FOR ${userId}` : '(ALL)'} ===`);
  
  let loans;
  if (userId) {
    loans = await getUserLoans(userId, 'active');
  } else {
    loans = await getAllActiveLoans();
  }

  if (loans.length === 0) {
    console.log('No active loans found');
    return;
  }

  loans.forEach(loan => {
    const interestAmount = Math.floor(loan.amount * (loan.interest_rate / 100));
    const totalDue = loan.amount + interestAmount;
    const dueDate = new Date(loan.due_date);
    
    console.log(`\\nLoan #${loan.id}:`);
    console.log(`  Borrower: ${loan.borrower_user_id}`);
    console.log(`  Lender: ${loan.lender_user_id}`);
    console.log(`  Principal: ${loan.amount} GC`);
    console.log(`  Rate: ${loan.interest_rate}%`);
    console.log(`  Total Due: ${totalDue} GC`);
    console.log(`  Due Date: ${dueDate.toISOString()}`);
    console.log(`  Status: ${loan.status}`);
  });
}

async function testPayLoan(loanId) {
  if (!loanId) {
    throw new Error('Loan ID is required');
  }

  console.log(`\\n=== PROCESSING PAYMENT FOR LOAN #${loanId} ===`);
  
  const result = await payLoan(parseInt(loanId));
  
  if (result.success) {
    console.log(`✅ Payment processed successfully!`);
    console.log(`Amount Paid: ${result.paid_amount} GC`);
    console.log(`Total Due: ${result.total_due} GC`);
    console.log(`Went Into Debt: ${result.went_into_debt}`);
    console.log(`Final Status: ${result.status}`);
  } else {
    console.log(`❌ Payment failed: ${result.message}`);
  }
}

async function setInterestRate(rate) {
  if (!rate) {
    throw new Error('Interest rate is required');
  }

  const newRate = parseFloat(rate);
  
  console.log(`\\n=== SETTING BASE INTEREST RATE TO ${newRate}% ===`);
  
  // Check if policy exists
  const existingPolicy = await getFGRPolicy('base_interest_rate');
  
  if (existingPolicy) {
    await updateFGRPolicy('base_interest_rate', {
      policy_data: { rate: newRate }
    });
    console.log(`✅ Updated existing interest rate policy`);
  } else {
    await createFGRPolicy('base_interest_rate', { rate: newRate });
    console.log(`✅ Created new interest rate policy`);
  }
}

async function getInterestRate() {
  console.log(`\\n=== CURRENT BASE INTEREST RATE ===`);
  
  const policy = await getFGRPolicy('base_interest_rate');
  
  if (policy) {
    console.log(`Current Rate: ${policy.policy_data.rate}%`);
    console.log(`Last Updated: ${policy.updated_at}`);
  } else {
    console.log(`No interest rate policy found (default: 5.0%)`);
  }
}

async function runAllTests() {
  console.log('\\n🧪 RUNNING COMPREHENSIVE LOAN SYSTEM TESTS\\n');
  
  const testUserId = '123456789012345678'; // Test user ID
  
  try {
    // Test 1: Credit Score Calculation
    console.log('Test 1: Credit Score Calculation');
    await testCreditScore(testUserId);
    
    // Test 2: Interest Rate Management
    console.log('\\n\\nTest 2: Interest Rate Management');
    await setInterestRate('4.5');
    await getInterestRate();
    
    // Test 3: Loan Creation
    console.log('\\n\\nTest 3: Bot Loan Creation');
    await testCreateLoan(testUserId, 'garry_bot', '50', '4.5');
    
    // Test 4: List Active Loans
    console.log('\\n\\nTest 4: List Active Loans');
    await listActiveLoans(testUserId);
    
    console.log('\\n\\n✅ All tests completed successfully!');
    console.log('\\nNote: To test loan payments, wait 3 days or manually trigger with:');
    console.log('node loan_cli.js pay-loan <loan_id>');
    
  } catch (error) {
    console.log(`\\n\\n❌ Test failed: ${error.message}`);
    throw error;
  }
}

// Handle graceful exit
process.on('SIGINT', () => {
  console.log('\\nExiting...');
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = {
  testCreditScore,
  testCreateLoan,
  listActiveLoans,
  testPayLoan,
  setInterestRate,
  getInterestRate
};