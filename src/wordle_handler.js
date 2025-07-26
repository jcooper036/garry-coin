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

        if (isCheater) {
            finalAmount = -CHEAT_PENALTY;
            transactionType = 'wordle_cheat_fine';
            reportString = `🕵️ <@${userId}> was caught trying to cheat the Wordle and has been fined ${CHEAT_PENALTY} GC!`
        } else if (tries) { // tries will be null for X/6 scores
            finalAmount = REWARD_STRUCTURE[tries] || 0;
            transactionType = 'wordle_reward';
            reportString = `🎉 <@${userId}> solved the Wordle in ${tries} tries and gets ${finalAmount} GC!`
        } else {
            // User did not solve (X/6)
            reportString = `🧐 <@${userId}> didn't solve the Wordle today. Better luck next time!`
        }

        // Record the transaction and wordle history
        if (transactionType) { // Only run DB transactions if there was a financial event
            await processWordleTransaction(userId, tries, finalAmount, isCheater, transactionType);
        }
        
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

    const mentionMap = new Map();
    mentions.forEach(user => {
        // Map both global_name and username to user_id for matching
        if (user.global_name) mentionMap.set(user.global_name.toLowerCase(), user.id);
        if (user.username) mentionMap.set(user.username.toLowerCase(), user.id);
    });

    for (const line of lines) {
        const parts = line.split(':');
        if (parts.length < 2) continue;

        const scorePart = parts[0];
        const usersPart = parts[1];

        const triesMatch = scorePart.match(/(\d+|X)\/6/);
        if (!triesMatch) continue;

        const tries = triesMatch[1] === 'X' ? null : parseInt(triesMatch[1], 10);

        const userMentions = usersPart.match(/@(\S+)/g) || [];
        for (const mention of userMentions) {
            const username = mention.substring(1).toLowerCase();
            const userId = mentionMap.get(username);
            if (userId) {
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