# GarryCoin Loan System Architecture Plan

## Overview
Implementing a comprehensive loan system for GarryCoin with `/garryloan` and `/garrycreditreport` commands. This system will integrate with the existing Federal GarryCoin Reserve (FGR) for interest rate policy.

## Database Schema

### New Table: `loans`
```sql
CREATE TABLE loans (
  id SERIAL PRIMARY KEY,
  borrower_user_id VARCHAR(255) NOT NULL,
  lender_user_id VARCHAR(255) NOT NULL,  -- 'garry_bot' for bot loans
  amount INTEGER NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL,   -- e.g., 5.50 for 5.5%
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  due_date TIMESTAMP NOT NULL,           -- Environment dependent: 5 minutes (dev) or 3 days (prod)
  status VARCHAR(50) DEFAULT 'active',   -- 'active', 'paid', 'defaulted'
  amount_paid INTEGER DEFAULT 0,
  went_into_debt BOOLEAN DEFAULT FALSE   -- for credit score calculation
);
```

### Updated Table: `users`
```sql
ALTER TABLE users ADD COLUMN credit_score INTEGER DEFAULT 500; -- FICO-style 300-850 range
```

## Credit Score Calculation

### Base Formula:
- **Current Balance Factor** (40%): `(balance / 100) * 10` (capped at 100 points)
- **Gambling Win Rate Factor** (30%): `win_rate * 3` (0-100% win rate = 0-300 points)
- **Loan History Factor** (30%): Based on loan repayment history

### Loan History Scoring:
- **Perfect Repayment History**: +150 points
- **Some Debt Events**: +75 points (went into debt but paid)
- **Multiple Debt Events**: +25 points
- **No Loan History**: +100 points (neutral)

### Score Range: 300-850 (standard FICO scale)

## Loan Logic

### Bot Loan Decision Algorithm:
```javascript
function botLoanDecision(userId, amount) {
  const user = getUser(userId);
  const botBalance = getBotBalance();
  const creditScore = calculateCreditScore(userId);
  
  // Always approve small loans
  if (amount <= 10) return { approved: true, rate: getCurrentInterestRate() };
  
  // Never approve loans > 50% of bot wealth
  if (amount > botBalance * 0.5) return { approved: false, reason: 'exceeds_capacity' };
  
  // Risk assessment based on credit score and loan amount
  const riskScore = calculateRiskScore(creditScore, amount, botBalance);
  const approvalThreshold = 0.3; // 30% minimum approval chance
  
  return {
    approved: Math.random() < Math.max(approvalThreshold, riskScore),
    rate: adjustInterestRate(getCurrentInterestRate(), creditScore)
  };
}
```

### Risk Calculation:
- Credit score impact: Higher score = lower risk
- Amount impact: Larger amounts = higher risk  
- Bot wealth ratio: Smaller percentage of bot wealth = lower risk

### Interest Rate Adjustment:
- **Excellent Credit (750+)**: Base rate - 1%
- **Good Credit (650-749)**: Base rate
- **Fair Credit (550-649)**: Base rate + 1%
- **Poor Credit (300-549)**: Base rate + 2%

## Command Specifications

### `/garryloan`
**Parameters:**
- `amount` (required): Loan amount requested
- `lender` (optional): Target lender user (defaults to bot)

**Behavior:**
- Check loan request eligibility (1 loan per lender per day, max 10 total active loans)
- For bot loans: Apply approval algorithm with credit score evaluation
- For user loans: Auto-approve if lender has sufficient funds
- Create loan record with environment-dependent due date
- Apply current FGR interest rate with credit score adjustment
- Transfer funds immediately upon approval

**Rate Limiting:**
- One loan per lender per user per day (allows multiple loans from different lenders)
- Maximum of 10 active loans per user total
- Users can take 1 loan from GarryCoin Bot and 1 loan from each other user per day
- Error messages distinguish between daily limit per lender vs. maximum total loans

### `/garrycreditreport`
**Parameters:**
- `user` (optional): Target user (defaults to self)

**Display:**
- Current credit score with breakdown
- Outstanding loans (amount, due date, lender)
- Loan history summary (total loans, defaults, on-time payments)
- Credit score factors explanation

## Integration Points

### FGR Integration:
- Use existing FGR policies table to store base interest rate
- Add `base_interest_rate` policy with default 5.0%
- FGR events can adjust base rate through policy announcements
- `/garryreservevote` results influence rate adjustments

### Automated Payment System:
- **Production**: Scheduled job runs every hour checking for due loans, 3-day loan terms
- **Development**: Scheduled job runs every 30 seconds, 5-minute loan terms for rapid testing
- Auto-deduct from borrower account up to loan amount + interest
- Handle insufficient funds by allowing negative balance (debt)
- Update loan status and credit history accordingly
- Send notification messages for successful payments and defaults

## User Experience Flow

### Loan Request Process:
1. User runs `/garryloan amount:50`
2. System checks daily limit
3. System calculates user credit score
4. Bot applies approval algorithm
5. If approved: Creates loan, transfers coins, notifies user
6. If denied: Explains reason (credit score, amount too high, etc.)

### Payment Process:
1. Loan comes due after environment-dependent period (5 min dev / 3 days prod)
2. Automated system attempts payment every 30 seconds (dev) or 1 hour (prod)
3. If successful: Updates loan status, sends notification via DM or channel
4. If insufficient funds: User goes into debt (up to -1000 GC limit), affects credit score
5. Credit report shows updated information with debt events tracked
6. Sends properly formatted notification about loan resolution

## Error Handling

### Edge Cases:
- **User deletes account**: Loans remain active with user ID
- **Bot insufficient funds**: Approval algorithm prevents this scenario
- **Negative balances**: Allow up to -1000 GC debt limit
- **Multiple outstanding loans**: Allow up to 10 active loans per user (more than the daily limit but that's fine)

### Database Integrity:
- Foreign key constraints ensure user exists
- Transaction handling for loan creation and payments
- Proper indexing on user_id and due_date for performance

## Security Considerations

### Anti-Abuse Measures:
- Rate limiting: 1 loan per lender per user per day (prevents spam from single source)
- Credit score-based risk assessment prevents unlimited borrowing
- Maximum 10 active loans per user total
- Debt limit of -1000 GC prevents infinite negative balances
- Comprehensive audit trail in transactions and loans tables

### Data Privacy:
- Credit reports are ephemeral (private) by default
- Loan information not exposed in public commands
- User can view others' credit reports but not detailed history

## Testing Strategy

### Unit Tests:
- Credit score calculation accuracy
- Loan approval algorithm edge cases
- Interest rate adjustments
- Payment processing logic

### Integration Tests:
- End-to-end loan workflow
- FGR interest rate integration
- Database consistency
- Discord command handling

### Load Testing:
- Multiple simultaneous loan requests
- Automated payment system performance
- Database query optimization

## Implementation Status

✅ **Database Migration** - Created loans table with proper indexing, added credit_score column
✅ **Core Functions** - Credit score calculation, loan approval logic with risk assessment
✅ **Commands Implementation** - `/garryloan` and `/garrycreditreport` with postProcess pattern
✅ **FGR Integration** - Interest rate policy management integrated with existing FGR system
✅ **Automated Payments** - LoanScheduler with environment-dependent timing and notifications
✅ **Testing & Validation** - Comprehensive CLI test suite with npm scripts
✅ **Documentation** - Updated README and technical documentation
✅ **Production Deployment** - Commands registered and functional on test server

## Success Metrics

### User Engagement:
- Number of loan requests per day
- Loan approval/denial rates
- Average loan amounts and terms
- User retention after taking loans

### System Health:
- Payment success rates
- Default rates by credit score tier
- FGR interest rate impact on loan volume
- Database performance metrics

---

## Technical Implementation Details

### Discord Integration:
- Commands use project's postProcess pattern for complex operations
- Deferred responses prevent Discord timeout issues
- Proper message formatting with newlines (not escaped \\n)
- Error handling with fallback responses

### Environment Configuration:
- **Development**: 5-minute loan terms, 30-second payment checks for rapid testing
- **Production**: 3-day loan terms, 1-hour payment checks for normal operation
- Automatic environment detection via NODE_ENV

### Database Optimizations:
- Nested transaction handling fixed for grant() function
- Proper connection pooling with retry logic
- Indexed queries for performance on loans and users tables

### Testing Infrastructure:
- CLI commands: `npm run test-loan-*` for all loan operations
- Integration with existing FGR test suite
- Comprehensive logging with structured categories

This architecture provides a robust, scalable loan system that integrates seamlessly with the existing GarryCoin ecosystem while maintaining the project's playful and engaging nature.