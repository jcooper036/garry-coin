const { processWordleTransaction } = require('./db');
const { structuredLog } = require('./logger');

const REWARD_STRUCTURE = {
    1: 100,
    2: 10,
    3: 5,
    4: 2,
    5: 1,
    6: 1,
};
const CHEAT_PENALTY = 4;
const CHEAT_CHANCE = 0.2;

const CHEATER_EMOJIS = ['<:scumbagcharles:707302898869993523>', '🚔', '🚨', '👮', '⚖️', '<:urfuckendeadkiddo:706647683183411362>', '<:buaGarry:705932743158005771>', '<:megacoop:707305419348901919>', '🙅‍♂️'];
const WINNER_EMOJIS = ['<:garryhulkhands:712745242272464966>', '<:hellya:707655186423742514>', '🎊', '✨', '🏆', '👑', '<:HereForTheWholeFoodsPizza:712742427001356370>', '<:WhenSheTastesLikeGolf:707671469328564235>', '<:supgirl:706640451524100148>', '<:pewpew:707669761969881172>', '☑️', '😎', '✨', '🎰'];
const UNSOLVED_EMOJIS = ['<:whengarrymissesthecannonminion:707799305892790412>', '<:jacobmid:707672458127474710>', '<:slowgarry:707668416281968700>', '😿', '<:oopskips:707287012054663231>', '<:killme:707447664748527627>', '🇫', '🦽', '🚑', '🤡'];

function getRandomEmoji(emojiList) {
    return emojiList[Math.floor(Math.random() * emojiList.length)];
}

async function handleWordleMessage(message) {
    structuredLog.wordle('Processing potential Wordle message');
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // 1. Check if today's Wordle has already been processed for any user mentioned.
    const mentionedUserIds = [...message.mentions.users.keys()];
    if (mentionedUserIds.length === 0) {
        structuredLog.wordle('No mentioned users found, skipping');
        return;
    }

    structuredLog.wordle('Processing new results for today', { date: today });
    // 2. Parse the message to get user scores
    const results = parseWordleResults(message.content, message.mentions.users);
    if (Object.keys(results).length === 0) {
        structuredLog.wordle('Could not parse any user scores from message');
        return;
    }
    structuredLog.wordle('Parsed user results', {
        userCount: Object.keys(results).length
    });

    // 3. Process each user's result and group them
    const winnersByTries = {};
    const unsolved = [];
    const cheaters = [];

    for (const userId in results) {
        const { tries } = results[userId];
        const isCheater = Math.random() < CHEAT_CHANCE;

        let finalAmount = 0;
        let transactionType = '';
        let finalTries = tries;

        if (isCheater) {
            finalAmount = -CHEAT_PENALTY;
            transactionType = 'wordle_cheat_fine';
            cheaters.push(userId);
            structuredLog.wordle('User flagged as cheater', {
                userId,
                penalty: CHEAT_PENALTY
            });
        } else if (tries) { // Solved
            finalAmount = REWARD_STRUCTURE[tries] || 0;
            transactionType = 'wordle_reward';
            if (!winnersByTries[tries]) {
                winnersByTries[tries] = [];
            }
            winnersByTries[tries].push(userId);
            structuredLog.wordle('User solved Wordle', {
                userId,
                tries,
                reward: finalAmount
            });
        } else { // Unsolved (X/6)
            finalAmount = 0;
            finalTries = 10; // Set tries to 10 for unsolved
            transactionType = 'wordle_unsolved';
            unsolved.push(userId);
            structuredLog.wordle('User did not solve Wordle', {
                userId
            });
        }

        // Always record the event in the database
        await processWordleTransaction(userId, finalTries, finalAmount, isCheater, transactionType);
        structuredLog.wordle('Transaction recorded', {
            userId,
            amount: finalAmount,
            transactionType
        });
    }

    // 4. Construct the public report
    const reportLines = [];
    // Batch winners by score
    for (const tries in winnersByTries) {
        const userMentions = winnersByTries[tries].map(id => `<@${id}>`).join(', ');
        const reward = REWARD_STRUCTURE[tries] || 0;
        reportLines.push(`${userMentions} ${getRandomEmoji(WINNER_EMOJIS)} solved the Wordle in ${tries} tries for ${reward} GC`);
    }

    // Unsolved are grouped
    if (unsolved.length > 0) {
        const userMentions = unsolved.map(id => `<@${id}>`).join(', ');
        reportLines.push(`${userMentions} ${getRandomEmoji(UNSOLVED_EMOJIS)} knew too many words today`);
    }

    // Cheaters are grouped
    if (cheaters.length > 0) {
        const userMentions = cheaters.map(id => `<@${id}>`).join(', ');
        reportLines.push(`${getRandomEmoji(CHEATER_EMOJIS)} ${userMentions}  Cheating detected by GarrycOinTuringCHeatAudit (GOTCHA) - offenders have been finded ${CHEAT_PENALTY} GC`);
    }

    // 5. Send the public report
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


module.exports = { handleWordleMessage };
