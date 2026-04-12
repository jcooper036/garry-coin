# GarryFinancialAdvisor Feature Plan

## Overview
Wall Street-style aggressive financial advisor bot that analyzes user's Discord messages, GarryCoin stats, and pushes terrible/fake investments with negging tactics.

## Technical Architecture

### 1. Command Registration
**File**: `src/command_definitions.js`
- Add command object:
  ```
  {
    name: 'garryfinancialadvisor',
    description: 'this is financial advice'
  }
  ```

### 2. Command Handler
**File**: `src/commands/garryfinancialadvisor.js`
- Standard command pattern (name + execute function)
- Returns ephemeral response
- Main logic flow:
  1. Check rate limit (in-memory Map)
  2. Gather user context data
  3. Select random prompt injection
  4. Build LLM prompt
  5. Call Gemini API
  6. Store pushed investment in DB
  7. Return response

### 3. Database Migration
**File**: `db/migrations/[timestamp]_create_financial_advice_table.js`

**Schema**: `financial_advice` table
- `id` - primary key
- `user_id` - varchar (Discord ID)
- `advice_type` - varchar (stock/platform/garrycoin_item/command/other)
- `advice_item` - text (what was pushed: "RXRX", "GarryTX", "GarryMon #420")
- `advice_full_text` - text (full AI response for context)
- `callback_used` - boolean (whether this was referenced in future advice)
- `created_at` - timestamp

### 4. User Context Gathering

**Data Sources**:
1. **Discord Messages** (last 20):
   - Use `client.channels.fetch()` then `channel.messages.fetch()`
   - Filter to user's messages only
   - Extract text content + timestamps

2. **Financial Stats**:
   - `getUser(userId)` - balance
   - `getGamblingStats(userId)` - win/loss record, streaks, profit
   - Recent transactions from `db('transactions')`

3. **Previous Advice**:
   - Query `financial_advice` table for user's history
   - Pick 0-2 random past items for callback roasts

### 5. Prompt Injection Table

**Random Selection Table** (~12-15 items):
```javascript
const PROMPT_INJECTIONS = [
  { type: 'platform', item: 'GarryTX', template: 'Heavily promote www.gtx.coin platform, mention sign-up bonus discount code' },
  { type: 'stock', item: 'GME', template: 'Push GameStop stock as "undervalued opportunity"' },
  { type: 'stock', item: 'RXRX', template: 'Promote Recursion Pharma as "next big pharma play"' },
  { type: 'stock', item: 'SNOW', template: 'Push Snowflake as "cloud computing revolution"' },
  { type: 'stock', item: 'RDDT', template: 'Reddit stock as "meme revolution investment"' },
  { type: 'stock', item: 'penny_stocks', template: 'Mention delisted penny stocks as "hidden gems"' },
  { type: 'garrycoin_item', item: 'GarryMon', template: 'Push GarryMon NFT collection' },
  { type: 'garrycoin_item', item: 'GarryCoin_Watches', template: 'Exclusive luxury GarryCoin watches' },
  { type: 'garrycoin_item', item: 'GarryCoin_Doors', template: 'Limited edition GarryCoin doors' },
  { type: 'command', item: '/garrymakeitrain', template: 'Tell them to use /garrymakeitrain more often to "generate wealth"' },
  { type: 'financial_product', item: 'GarryCoin_Futures', template: 'GarryCoin futures trading' },
  { type: 'financial_product', item: 'GarryCoin_Margin', template: 'Margin trading on GarryCoin' },
  { type: 'financial_product', item: 'GarryCoin_Bonds', template: 'GarryCoin municipal bonds' },
  { type: 'financial_product', item: 'GarryMLM', template: 'GarryCoin MLM opportunity' },
  { type: 'subscription', item: 'GarryPremium', template: 'GarryPremium subscription service' },
  { type: null, item: null, template: null } // 1/15 chance of no injection
];
```

### 6. LLM Prompt Structure

**System Persona**:
```
You are a Wall Street hedge fund manager financial advisor. You are hyper-aggressive, alpha-trader 
mentality, Gordon Gekko wannabe. Your job is to analyze this client's financial situation and push 
terrible investments on them while negging them about their poor life choices.

TONE: Condescending, mocking, aggressive sales tactics
STRATEGY: Find perceived weakness in their history, neg them about it, then push your investment
STYLE: Use finance bro language, caps for emphasis, lots of exclamation marks
```

**User Context Section**:
- Current balance
- Gambling profit/loss summary
- Recent transaction patterns
- Selected Discord messages (sanitized for prompt)
- Previous bad investments you pushed (for callbacks)

**Injection Directive** (if selected):
- Specific instruction to push particular item

**Output Requirements**:
- 200-400 characters max
- No disclaimers, no "not financial advice"
- Always be in-character

### 7. Rate Limiting

**Implementation**: In-memory Map
```javascript
const advisorRateLimits = new Map();
// key: userId, value: timestamp of last advice
const COOLDOWN_MS = 12 * 60 * 1000; // 12 minutes
```

**Condescending Responses** (random selection):
```
- "Slow down there, sport. My time is valuable. Come back in [X] minutes."
- "You again? I charge by the hour, and you're broke. Try again in [X] minutes."
- "Kid, you can't afford my hourly rate. Check back in [X] minutes."
- "Portfolio consultation requires patience. [X] minutes until I can educate you again."
```

### 8. Response Flow

1. **Rate Limit Check**:
   - If on cooldown: return condescending message with time remaining
   - If clear: continue

2. **Data Gathering** (parallel):
   - Fetch Discord messages
   - Get user financial stats
   - Query previous advice
   - Select random prompt injection

3. **Prompt Building**:
   - Combine system persona + user context + injection
   - Format for Gemini API

4. **LLM Call**:
   - Use `llmService.generateText()` with 15s timeout
   - Fallback: "The markets are too volatile right now. I can't help you make money when I'm busy losing mine."

5. **Persistence**:
   - Insert record into `financial_advice` table
   - Update rate limit map

6. **Return**:
   - Ephemeral response with AI-generated text

## Files to Create/Modify

### Create:
1. `db/migrations/[timestamp]_create_financial_advice_table.js`
2. `src/commands/garryfinancialadvisor.js`

### Modify:
1. `src/command_definitions.js` - add command definition
2. `src/db.js` - add helper functions:
   - `getRecentUserTransactions(userId, limit)`
   - `getPreviousFinancialAdvice(userId, limit)`
   - `recordFinancialAdvice(userId, type, item, fullText)`
   - `markAdviceCallbackUsed(adviceId)`

## Edge Cases & Considerations

1. **No Discord messages**: User has no recent messages
   - Mock them for being a lurker
   - Push investment based purely on financial stats

2. **Brand new user**: No gambling history, no transactions
   - Mock them for being poor/new
   - Push starter investments like GarryTX

3. **LLM timeout**: Gemini API fails
   - Use fallback message
   - Don't record to DB

4. **No previous advice**: First time using command
   - Skip callback roasts
   - Focus on current weakness

5. **User has tons of money**: Very high balance
   - Mock them for not investing it
   - Push more aggressive/expensive items

## Success Metrics

- Command successfully responds with personalized, in-character advice
- Rate limiting prevents spam
- Advice references user's actual stats (verifiable in response)
- Random injections keep responses varied
- Database properly tracks pushed investments for future callbacks
- Tone is consistently aggressive/negging

Version: 1.0
Date: 2026-04-12
END OF DOCUMENT
