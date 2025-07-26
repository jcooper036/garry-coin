const { db, transfer, grant } = require('./db');

const REWARD_STRUCTURE = {
    1: 100,
    2: 10,
    3: 5,
    4: 2,
    5: 1,
    6: 1,
};
const CHEAT_PENALTY = 5;
const CHEAT_CHANCE = 0.2;

async function handleWordleMessage(message) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // 1. Check if today's Wordle has already been processed for any user mentioned.
    // This prevents processing the same message multiple times if the bot restarts.
    const mentionedUserIds = [...message.mentions.users.keys()];
    const existingRecord = await db('wordle_rewards')
        .where('reward_date', today)
        .whereIn('user_id', mentionedUserIds)
        .first();

    if (existingRecord) {
        console.log(`Wordle results for ${today} have already been processed. Skipping.`);
        return;
    }

    // 2. Parse the message to get user scores
    const results = parseWordleResults(message.content, message.mentions.users);
    if (Object.keys(results).length === 0) {
        console.log('Could not parse any user scores from the Wordle message.');
        return;
    }

    // 3. Process each user's result
    const reportLines = [];
    for (const userId in results) {
        const { tries } = results[userId];
        const isCheater = Math.random() < CHEAT_CHANCE;

        let finalAmount = 0;
        let transactionType = '';
        let reportString = '';
        let finalTries = tries;

        if (isCheater) {
            finalAmount = -CHEAT_PENALTY;
            transactionType = 'wordle_cheat_fine';
            reportString = `🕵️ <@${userId}> was caught trying to cheat the Wordle and has been fined ${CHEAT_PENALTY} GC!`;
        } else if (tries) { // Solved
            finalAmount = REWARD_STRUCTURE[tries] || 0;
            transactionType = 'wordle_reward';
            reportString = `🎉 <@${userId}> solved the Wordle in ${tries} tries and gets ${finalAmount} GC!`;
        } else { // Unsolved (X/6)
            finalAmount = 0;
            finalTries = 10; // Set tries to 10 for unsolved
            transactionType = 'wordle_unsolved';
            reportString = `🧐 <@${userId}> didn't solve the Wordle today. Better luck next time!`;
        }

        // Always record the event in the database
        await processWordleTransaction(userId, finalTries, finalAmount, isCheater, transactionType);
        
        reportLines.push(reportString);
    }

    // 4. Send the public report
    if (reportLines.length > 0) {
        await message.channel.send(reportLines.join('\n'));
    }
}

function parseWordleResults(content, mentions) {
    const results = {};
    const lines = content.split('\n').slice(1); // Skip the first line

    // Use the mentions collection to get a set of all valid, mentioned user IDs.
    const validUserIds = new Set(mentions.keys());

    for (const line of lines) {
        const parts = line.split(':');
        if (parts.length < 2) continue;

        const scorePart = parts[0];
        const usersPart = parts[1];

        const triesMatch = scorePart.match(/(\d+|X)\/6/);
        if (!triesMatch) continue;

        const tries = triesMatch[1] === 'X' ? null : parseInt(triesMatch[1], 10);

        // Regex to find all full user ID mentions, e.g., <@123456789012345678>
        const userIdMentions = usersPart.match(/<@!?(\d+)>/g) || [];

        for (const mention of userIdMentions) {
            // Extract just the numeric ID from the mention string
            const userId = mention.replace(/<@!?/, '').replace('>', '');

            // If the extracted ID is in the set of valid mentions, add it to the results.
            if (validUserIds.has(userId)) {
                results[userId] = { tries };
            }
        }
    }
    return results;
}

async function processWordleTransaction(userId, tries, amount, isCheater, transactionType) {
    const today = new Date().toISOString().slice(0, 10);

    return db.transaction(async trx => {
        // Update user balance
        if (amount > 0) {
            await trx('users').where({ user_id: userId }).increment('balance', amount);
        } else if (amount < 0) {
            await trx('users').where({ user_id: userId }).decrement('balance', Math.abs(amount));
        }

        // Record in transactions table
        await trx('transactions').insert({
            sending_user_id: isCheater ? userId : 'wordle_bot',
            receiving_user_id: isCheater ? 'wordle_bot' : userId,
            amount: Math.abs(amount),
            transaction_type: transactionType,
        });

        // Record in wordle_rewards table
        await trx('wordle_rewards').insert({
            user_id: userId,
            reward_date: today,
            tries: tries,
            reward_amount: amount,
            was_caught_cheating: isCheater,
        });
    });
}


module.exports = { handleWordleMessage };
