const { processWordleTransaction, getUser, findOrCreateUser } = require('./db');
const { structuredLog } = require('./logger');
const { formatExactGC } = require('./number_formatter');

const REWARD_STRUCTURE_PERCENT = {
    1: 20,
    2: 10,
    3: 5,
    4: 2,
    5: 1,
    6: 1,
};
const CHEAT_PENALTY_PERCENT = 4;
const CHEAT_CHANCE = 0.2;

const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 1000;

const CHEATER_EMOJIS = ['<:scumbagcharles:707302898869993523>', '🚔', '🚨', '👮', '⚖️', '<:urfuckendeadkiddo:706647683183411362>', '<:buaGarry:705932743158005771>', '<:megacoop:707305419348901919>', '🙅‍♂️'];
const WINNER_EMOJIS = ['<:garryhulkhands:712745242272464966>', '<:hellya:707655186423742514>', '🎊', '✨', '🏆', '👑', '<:HereForTheWholeFoodsPizza:712742427001356370>', '<:WhenSheTastesLikeGolf:707671469328564235>', '<:supgirl:706640451524100148>', '<:pewpew:707669761969881172>', '☑️', '😎', '✨', '🎰'];
const UNSOLVED_EMOJIS = ['<:whengarrymissesthecannonminion:707799305892790412>', '<:jacobmid:707672458127474710>', '<:slowgarry:707668416281968700>', '😿', '<:oopskips:707287012054663231>', '<:killme:707447664748527627>', '🇫', '🦽', '🚑', '🤡'];

function getRandomEmoji(emojiList) {
    return emojiList[Math.floor(Math.random() * emojiList.length)];
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Pay (or fine) one user for one Wordle message. Safe to retry: the database
 * records (user, source message) once, so a repeat never pays twice.
 * Returns an outcome object, or { duplicate: true } if already processed.
 */
async function processUserResult(userId, tries, sourceMessageId) {
    const isCheater = Math.random() < CHEAT_CHANCE;

    await findOrCreateUser(userId);
    const user = await getUser(userId);
    const actualBalance = user?.balance || 0;
    // Always treat users as having minimum 10 GC for Wordle calculations
    const calculationBalance = Math.max(actualBalance, 10);

    let finalAmount;
    let transactionType;
    let finalTries = tries;
    let kind;

    if (isCheater) {
        // 4% penalty of calculation balance (minimum 10), rounded up
        finalAmount = -Math.ceil(calculationBalance * (CHEAT_PENALTY_PERCENT / 100));
        transactionType = 'wordle_cheat_fine';
        kind = 'cheater';
    } else if (tries) { // Solved
        // Percentage of calculation balance (minimum 10) reward, rounded up
        finalAmount = Math.ceil(calculationBalance * ((REWARD_STRUCTURE_PERCENT[tries] || 0) / 100));
        transactionType = 'wordle_reward';
        kind = 'winner';
    } else { // Unsolved (X/6)
        finalAmount = 0;
        finalTries = 10; // Set tries to 10 for unsolved
        transactionType = 'wordle_unsolved';
        kind = 'unsolved';
    }

    const { applied } = await processWordleTransaction(userId, finalTries, finalAmount, isCheater, transactionType, sourceMessageId);
    if (!applied) {
        return { duplicate: true };
    }

    structuredLog.wordle('Transaction recorded', {
        userId,
        kind,
        tries,
        actualBalance,
        calculationBalance,
        amount: finalAmount,
        transactionType,
        sourceMessageId
    });
    return { kind, userId, tries, amount: finalAmount };
}

async function processUserWithRetry(userId, tries, sourceMessageId) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            return await processUserResult(userId, tries, sourceMessageId);
        } catch (error) {
            lastError = error;
            structuredLog.error('Wordle payout attempt failed', {
                userId,
                sourceMessageId,
                attempt,
                maxAttempts: MAX_ATTEMPTS,
                error: error.message,
                category: 'wordle'
            });
            if (attempt < MAX_ATTEMPTS) {
                await sleep(RETRY_BACKOFF_MS * attempt);
            }
        }
    }
    throw lastError;
}

async function handleWordleMessage(message) {
    structuredLog.wordle('Processing potential Wordle message', { sourceMessageId: message.id });

    if (message.mentions.users.size === 0) {
        structuredLog.wordle('No mentioned users found, skipping');
        return;
    }

    // Parse the message to get user scores
    const results = parseWordleResults(message.content, message.mentions.users);
    if (Object.keys(results).length === 0) {
        structuredLog.wordle('Could not parse any user scores from message');
        return;
    }
    structuredLog.wordle('Parsed user results', {
        userCount: Object.keys(results).length,
        sourceMessageId: message.id
    });

    // Process each user independently: one failure must never skip the rest or the report.
    const winnersByTries = {};
    const unsolved = [];
    const cheaters = [];
    const failed = [];

    for (const userId in results) {
        const { tries } = results[userId];
        try {
            const outcome = await processUserWithRetry(userId, tries, message.id);
            if (outcome.duplicate) {
                structuredLog.wordle('Already processed for this message, skipping', { userId, sourceMessageId: message.id });
            } else if (outcome.kind === 'cheater') {
                cheaters.push({ userId, amount: Math.abs(outcome.amount) });
            } else if (outcome.kind === 'winner') {
                (winnersByTries[tries] = winnersByTries[tries] || []).push({ userId, amount: outcome.amount });
            } else {
                unsolved.push(userId);
            }
        } catch (error) {
            failed.push(userId);
            structuredLog.error('Wordle payout failed after all attempts', {
                userId,
                tries,
                sourceMessageId: message.id,
                error: error.message,
                category: 'wordle'
            });
        }
    }

    // Construct the public report
    const reportLines = [];
    // Batch winners by score
    for (const tries in winnersByTries) {
        const winners = winnersByTries[tries];
        const rewardPercent = REWARD_STRUCTURE_PERCENT[tries];

        if (winners.length === 1) {
            const winner = winners[0];
            reportLines.push(`<@${winner.userId}> ${getRandomEmoji(WINNER_EMOJIS)} solved the Wordle in ${tries} tries for ${formatExactGC(winner.amount)} GC (${rewardPercent}% of balance)`);
        } else {
            // Group multiple winners, show individual amounts
            const winnerDetails = winners.map(w => `<@${w.userId}> (${formatExactGC(w.amount)} GC)`).join(', ');
            reportLines.push(`${winnerDetails} ${getRandomEmoji(WINNER_EMOJIS)} solved the Wordle in ${tries} tries (${rewardPercent}% of balance each)`);
        }
    }

    // Unsolved are grouped
    if (unsolved.length > 0) {
        const userMentions = unsolved.map(id => `<@${id}>`).join(', ');
        reportLines.push(`${userMentions} ${getRandomEmoji(UNSOLVED_EMOJIS)} knew too many words today`);
    }

    // Cheaters are grouped with individual penalty amounts
    if (cheaters.length > 0) {
        if (cheaters.length === 1) {
            const cheater = cheaters[0];
            reportLines.push(`${getRandomEmoji(CHEATER_EMOJIS)} <@${cheater.userId}> Cheating detected by GarrycOinTuringCHeatAudit (GOTCHA) - offender has been fined ${formatExactGC(cheater.amount)} GC (${CHEAT_PENALTY_PERCENT}% of balance)`);
        } else {
            const cheaterDetails = cheaters.map(c => `<@${c.userId}> (${formatExactGC(c.amount)} GC)`).join(', ');
            reportLines.push(`${getRandomEmoji(CHEATER_EMOJIS)} ${cheaterDetails} Cheating detected by GarrycOinTuringCHeatAudit (GOTCHA) - offenders have been fined ${CHEAT_PENALTY_PERCENT}% of balance each`);
        }
    }

    // Users we could not pay are named, never silently dropped
    if (failed.length > 0) {
        const failedMentions = failed.map(id => `<@${id}>`).join(', ');
        reportLines.push(`⚠️ ${failedMentions} - the GarryCoin vault jammed and I could not process your Wordle result. Nothing was paid or taken; it is logged for manual settlement.`);
    }

    // Send the public report
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


module.exports = { handleWordleMessage, parseWordleResults };
