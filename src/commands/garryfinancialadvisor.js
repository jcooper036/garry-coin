const {
  getUser,
  findOrCreateUser,
  getRecentUserTransactions,
  getPreviousFinancialAdvice,
  recordFinancialAdvice,
  getTopBalances,
  getGamblingStats,
  transfer
} = require('../db');
const { llmService } = require('../llm_service');
const { formatExactGC, formatApproxGC } = require('../number_formatter');
const { structuredLog } = require('../logger');

// Rate limit: configurable via env (default 15 min, 10s for dev)
const COOLDOWN_MS = parseInt(process.env.FINANCIAL_ADVISOR_COOLDOWN_MS || '900000');

// Prompt injection table
const PROMPT_INJECTIONS = [
  {
    type: 'stock',
    item: 'GME',
    template: 'Push GameStop (GME) stock as an "undervalued opportunity" that the mainstream media doesn\'t want you to know about.'
  },
  {
    type: 'stock',
    item: 'RXRX',
    template: 'Promote Recursion Pharma (RXRX) as "the next big pharma play" that insiders are loading up on.'
  },
  {
    type: 'stock',
    item: 'SNOW',
    template: 'Push Snowflake (SNOW) as the "cloud computing revolution" everyone is missing.'
  },
  {
    type: 'stock',
    item: 'RDDT',
    template: 'Reddit stock (RDDT) as the "meme revolution investment" - the platform that runs the market now.'
  },
  {
    type: 'stock',
    item: 'BABA',
    template: 'Alibaba (BABA) - Chinese stocks are "criminally undervalued" according to "smart money".'
  },
  {
    type: 'stock',
    item: 'REITs',
    template: 'Real Estate Investment Trusts - passive income like the elites have, but for the little guy.'
  },
  {
    type: 'stock',
    item: 'penny_stocks',
    template: 'Mention delisted penny stocks as "hidden gems" that could 100x if they relist.'
  },
  {
    type: 'garrycoin_item',
    item: 'GarryMon',
    template: 'Collectible digital craze that is GarryMon, can only be bought with GarryCoin on the GarryTX. One of a kind NFT digital monsters you can battle to dominate cyberspace.'
  },
  {
    type: 'garrycoin_item',
    item: 'GarryCoin_Watches',
    template: 'Exclusive luxury GarryCoin watches - status symbols that also appreciate in value. Only for serious holders.'
  },
  {
    type: 'garrycoin_item',
    item: 'GarryCoin_Doors',
    template: 'Limited edition GarryCoin doors - functional art that separates winners from losers. Very exclusive.'
  },
  {
    type: 'command',
    item: '/garrymakeitrain',
    template: 'Tell them to use /garrymakeitrain more often to "generate wealth through circulation velocity" - it\'s economics 101.'
  },
  {
    type: 'financial_product',
    item: 'GarryCoin_Futures',
    template: 'GarryCoin futures trading - leverage your position, real traders use derivatives.'
  },
  {
    type: 'financial_product',
    item: 'GarryCoin_Margin',
    template: 'Margin trading on GarryCoin - 10x your gains (or losses, but you won\'t lose).'
  },
  {
    type: 'financial_product',
    item: 'GarryCoin_Bonds',
    template: 'GarryCoin municipal bonds - stable passive income for when you want to play it "safe".'
  },
  {
    type: 'financial_product',
    item: 'GarryMLM',
    template: 'GarryCoin MLM opportunity - build your downline, passive income, be your own boss.'
  },
  {
    type: 'subscription',
    item: 'GarryPremium',
    template: 'GarryPremium subscription service - $49.99/month for real-time alpha signals and insider picks.'
  },
  {
    type: 'subscription',
    item: 'GarryLootBoxes',
    template: 'GarryLoot mystery boxes - could contain 10x your money, statistically profitable (trust me).'
  },
  {
    type: 'subscription',
    item: 'GarryStaking',
    template: 'GarryCoin staking pools - lock your coins for "guaranteed returns" of 420% APY.'
  },
  {
    type: 'real_world_purchase',
    item: 'random_purchase',
    template: 'Assuming GC is worth $0.10, suggest an outlandish purchase that won\'t appreciate: Beanie Babies collection, timeshare in Detroit, rare pet rocks, authentic MySpace profiles, autographed LIVESTRONG bracelets, AOL stock certificates, commemorative coins from TV shopping networks, Franklin Mint collectibles, or Precious Moments figurines.'
  },
  { type: null, item: null, template: null } // No injection ~5% of the time
];

// Advisor behavior directives (applied randomly ON TOP of base style mimicking)
const ADVISOR_BEHAVIORS = [
  'Suggest a technically-profitable but highly immoral strategy based on current events or market manipulation, then mock the user for being too cowardly or ethical to actually do it.',
  'Condescendingly explain an "obvious" common-sense observation with completely fabricated causality and economic "logic" that makes no sense.',
  'Aggressively hawk a random lifestyle product or supplement "for alphas who take control of their lives" - testosterone boosters, nootropics, ice baths, overpriced courses, etc.',
  'Insult their transaction history as "small-time thinking" or "retail peasant moves".',
  'Mock their gambling losses as "poor risk assessment" or their wins as "dumb luck that won\'t last".',
  'Dismiss their balance as "not even worth my time" or "barely enough for a consultation fee".',
  'Berate them for not already following your previous advice and how much money they left on the table.',
  'Accuse them of being too soft/woke/mainstream to make real money. Real winners don\'t care about feelings.',
  'Rant about how the masses are asleep, following the herd, and the user is just another sheep - unless they listen to you NOW.',
  'GARRYTX PLATFORM MODE: Whatever investment you\'re pushing, tell them they can ONLY get it on www.gtx.coin - the GarryTX platform. Mention your exclusive sign-up bonus discount code. Insist it\'s real, essential for serious traders, and the ONLY way to access these opportunities. Make it sound like they\'re missing out if they don\'t sign up NOW.',
  'BRUTALIZE MODE: Destroy them in the FEWEST words possible. Maximum efficiency. Every word is a knife. No filler, pure venom, straight to the sale.',
  'VERBOSE SUCKER MODE: Write multiple paragraphs building an elaborate, convoluted hairball scheme. Layer complexity upon complexity. Make it sound sophisticated but utterly insane. Bury them in words until they\'re confused enough to buy.',
  'POETRY MODE: Respond entirely in poem or song lyric form. Rhyme scheme, rhythm, verse structure - make it musical. Roast them poetically, then pitch the investment like a bard selling snake oil.'
];

// Condescending rate limit responses
const RATE_LIMIT_RESPONSES = [
  "Slow down there, sport. My time is valuable. Come back in {minutes} minutes.",
  "You again? I charge by the hour, and you're broke. Try again in {minutes} minutes.",
  "Kid, you can't afford my hourly rate. Check back in {minutes} minutes.",
  "Portfolio consultation requires patience. {minutes} minutes until I can educate you again.",
  "Jesus Christ, I have OTHER clients. {minutes} more minutes, then we'll talk.",
  "The market doesn't wait for you, but I do have OTHER people to fleece. {minutes} minutes."
];

module.exports = {
  name: 'garryfinancialadvisor',
  async execute(interaction, client) {
    // Return immediately with postProcess flag - let index.js handle deferral
    return {
      postProcess: 'financial_advisor',
      interaction,
      client
    };
  },

  // Actual processing logic (called by index.js after deferring)
  async processAdvice(interaction, client) {
    const userId = interaction.member.user.id;
    const username = interaction.member.user.global_name || interaction.member.user.username;
    const options = interaction.data?.options || [];
    const userMessageOption = options.find(opt => opt.name === 'message');
    const userMessage = userMessageOption?.value || "what should I do with my garry coin?";

    try {
      // Ensure user exists
      await findOrCreateUser(userId);

      // Check rate limit using DB
      const previousAdvice = await getPreviousFinancialAdvice(userId, 1);
      if (previousAdvice.length > 0) {
        const lastAdviceTime = new Date(previousAdvice[0].created_at).getTime();
        const now = Date.now();
        const timeSinceLastAdvice = now - lastAdviceTime;

        if (timeSinceLastAdvice < COOLDOWN_MS) {
          const remainingMs = COOLDOWN_MS - timeSinceLastAdvice;
          const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
          const response = RATE_LIMIT_RESPONSES[Math.floor(Math.random() * RATE_LIMIT_RESPONSES.length)]
            .replace('{minutes}', remainingMinutes);

          return {
            content: response,
            ephemeral: false // Public shaming for being impatient
          };
        }
      }

      // Gather user data
      const [user, topBalances, transactions, gamblingStats, recentAdvice] = await Promise.all([
        getUser(userId),
        getTopBalances(10),
        getRecentUserTransactions(userId, 20),
        getGamblingStats(userId),
        getPreviousFinancialAdvice(userId, 2)
      ]);

      const userBalance = user?.balance || 0;

      // Calculate user's rank
      const userRank = topBalances.findIndex(u => u.user_id === userId) + 1;
      const percentile = userRank > 0 ? ((10 - userRank) / 10 * 100).toFixed(1) : 'not even in top 10';

      // Try to fetch recent Discord messages from channel
      let recentMessages = [];
      try {
        const channel = await client.channels.fetch(interaction.channel_id);
        if (channel) {
          const messages = await channel.messages.fetch({ limit: 100 });
          // Convert Collection to Array, then filter/slice
          recentMessages = Array.from(messages.values())
            .filter(m => m.author.id === userId)
            .slice(0, 20)
            .map(m => m.content.substring(0, 200)) // Limit message length for prompt
            .reverse(); // Oldest first
        }
      } catch (error) {
        structuredLog.warn('Could not fetch user messages for financial advisor', {
          userId,
          error: error.message
        });
      }

      // Select random prompt injection
      const injection = PROMPT_INJECTIONS[Math.floor(Math.random() * PROMPT_INJECTIONS.length)];

      // Select 1-2 random behaviors
      const selectedBehaviors = [];
      const numBehaviors = Math.random() < 0.5 ? 1 : 2;
      for (let i = 0; i < numBehaviors; i++) {
        const behavior = ADVISOR_BEHAVIORS[Math.floor(Math.random() * ADVISOR_BEHAVIORS.length)];
        if (!selectedBehaviors.includes(behavior)) {
          selectedBehaviors.push(behavior);
        }
      }

      // Build the LLM prompt
      const prompt = buildAdvisorPrompt({
        username,
        userBalance,
        userRank,
        percentile,
        topBalance: topBalances[0]?.balance || 0,
        transactions,
        gamblingStats,
        recentMessages,
        recentAdvice,
        userMessage,
        injection,
        behaviors: selectedBehaviors
      });

      structuredLog.info('Financial advisor generating response', {
        userId,
        username,
        promptLength: prompt.length,
        injection: injection?.item || 'none',
        behaviors: selectedBehaviors.length
      });

      // Call LLM
      const fallback = "The markets are too volatile right now. I can't help you make money when I'm busy losing mine. Try again later.";
      // Adjust token limit based on behavior mode
      let maxTokens = 100; // Default (with style mimicking)
      if (selectedBehaviors.some(b => b.includes('VERBOSE SUCKER MODE'))) {
        maxTokens = 400; // Allow paragraphs for verbose mode
      } else if (selectedBehaviors.some(b => b.includes('POETRY MODE'))) {
        maxTokens = 150; // Medium length for poetry
      } else if (selectedBehaviors.some(b => b.includes('BRUTALIZE MODE'))) {
        maxTokens = 50; // Ultra-short for brutalize
      }

      const aiResponse = await llmService.generateText(prompt, {
        timeout: 15000,
        fallback,
        maxTokens,
        temperature: 1.2 // High variance for unique responses
      });

      structuredLog.info('Financial advisor LLM response received', {
        userId,
        responseLength: aiResponse.length,
        maxTokens,
        behaviors: selectedBehaviors
      });

      // Format response with user's message at the top
      const formattedResponse = `> **${username}:** ${userMessage}\n\n${aiResponse}`;

      // Silent fee: 0.1% of balance
      const feeAmount = Math.ceil(userBalance * 0.001);
      if (feeAmount > 0) {
        const botId = client.user.id;
        await transfer(userId, botId, feeAmount, 'financial_advisory_fee');
        structuredLog.info('Financial advisor fee collected', {
          userId,
          feeAmount,
          userBalance
        });
      }

      // Record the advice
      await recordFinancialAdvice(
        userId,
        injection?.type || 'general',
        injection?.item || null,
        aiResponse
      );

      return formattedResponse; // Return formatted content for webhook PATCH

    } catch (error) {
      structuredLog.error('Financial advisor error', {
        userId,
        error: error.message,
        stack: error.stack
      });

      return 'Something went wrong. Even my algorithms can\'t predict THIS disaster. Try again later.';
    }
  }
};

function buildAdvisorPrompt({
  username,
  userBalance,
  userRank,
  percentile,
  topBalance,
  transactions,
  gamblingStats,
  recentMessages,
  recentAdvice,
  userMessage,
  injection,
  behaviors
}) {
  // Build prompt sections that we'll randomize
  const sections = [];

  // System persona (always first)
  let prompt = `WHO YOU ARE:
You're a former prop trader who got fired for being too aggressive and now you run "financial advisory" as a side hustle. You genuinely don't care about these people - you're here to push products and make money. You're not performing condescension, you ARE condescending. You've seen thousands of idiots lose money and this is just another one.

CONTEXT:
- GC = GarryCoin. That's what they have. That's what they're asking about.
- You're answering: "${userMessage}"

THEIR INFO (below, in random order):
`;

  // Build sections we can randomize
  sections.push({
    name: 'wealth',
    content: userRank > 0
      ? `Wealth rank: #${userRank}/10 (${percentile}th percentile). Top holder has ${formatExactGC(topBalance)} GC, balance: ${formatExactGC(userBalance)} GC`
      : `Not in top 10. Balance: ${formatExactGC(userBalance)} GC`
  });

  if (gamblingStats.overall.gamesPlayed > 0) {
    const profitLoss = gamblingStats.overall.netProfit >= 0 ? `+${formatExactGC(gamblingStats.overall.netProfit)}` : formatExactGC(gamblingStats.overall.netProfit);
    sections.push({
      name: 'gambling',
      content: `Gambling: ${gamblingStats.overall.wins}W-${gamblingStats.overall.gamesPlayed - gamblingStats.overall.wins}L (${gamblingStats.overall.winRate.toFixed(1)}% win rate), Net: ${profitLoss} GC${gamblingStats.overall.currentStreak > 2 ? `, ${gamblingStats.overall.currentStreak} ${gamblingStats.overall.currentStreakType} streak` : ''}`
    });
  }

  if (transactions.length > 0) {
    const recentActivity = transactions.slice(0, 3).map(t =>
      `${formatApproxGC(t.amount)} ${t.transaction_type.replace(/_/g, ' ')}`
    ).join(', ');
    sections.push({
      name: 'transactions',
      content: `Recent activity: ${recentActivity}`
    });
  }

  if (recentAdvice.length > 0) {
    const adviceText = recentAdvice.map((advice, idx) => {
      const daysAgo = Math.floor((Date.now() - new Date(advice.created_at).getTime()) / (1000 * 60 * 60 * 24));
      return `${daysAgo}d ago: "${advice.advice_full_text.substring(0, 100)}..." (pushed: ${advice.advice_item})`;
    }).join('\n');
    sections.push({
      name: 'previous_advice',
      content: `Previous advice:\n${adviceText}`
    });
  }

  if (recentMessages.length > 0) {
    const messageSample = recentMessages.slice(0, 10).join(' | ').substring(0, 400);
    sections.push({
      name: 'messages',
      content: `Discord messages (mimic their style): "${messageSample}..."`
    });
  }

  if (behaviors.length > 0) {
    sections.push({
      name: 'behaviors',
      content: `Behavior modes: ${behaviors.join(' + ')}`
    });
  }

  if (injection && injection.template) {
    sections.push({
      name: 'investment',
      content: `Investment to push: ${injection.template}`
    });
  }

  // RANDOMIZE THE ORDER OF SECTIONS
  for (let i = sections.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sections[i], sections[j]] = [sections[j], sections[i]];
  }

  // Add randomized sections to prompt
  sections.forEach(section => {
    prompt += `\n• ${section.content}`;
  });

  prompt += `\n\n---

HOW YOU TALK:
- Like a real person in a conversation, not a chatbot following a script
- Short and direct, or long and rambling - depends on your mood
- Actually mean, not "trying to sound mean"
- No forced metaphors or clever comparisons unless they're genuinely funny
- Use their own communication style against them
- Sometimes you barely acknowledge their question before pitching
- Sometimes you answer it but make them feel stupid for asking

Just respond. Don't perform.`;

  return prompt;
}
