/**
 * Read-only audit of missed Wordle rewards.
 *
 * Ground truth is Discord itself: every user listed in a Wordle-bot results message
 * should appear in a GarryCoin reply (winner / unsolved / cheater lines all @mention
 * the user). A user listed by Wordle but absent from every reply is a "miss".
 *
 * Usage:
 *   node src/wordle_audit.js [--since YYYY-MM-DD] [--json out.json] [--verbose]
 *
 * Env (from .env): PROD_DISCORD_TOKEN, PROD_APP_ID (bot user id), PIMP_CATS_SERVER_ID (guild),
 *                  WORDLE_BOT_IDS. Nothing is written to Discord or the database.
 */
require('dotenv').config();
const fs = require('fs');
const { parseWordleResults } = require('./wordle_handler');

const API = 'https://discord.com/api/v10';
const TRIGGER = 'Your group is on a';
const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;
const DISCORD_EPOCH = 1420070400000n;

const token = process.env.PROD_DISCORD_TOKEN;
const botId = process.env.PROD_APP_ID;
const guildId = process.env.PIMP_CATS_SERVER_ID;
const wordleBotIds = (process.env.WORDLE_BOT_IDS || '').split(',').filter(Boolean);

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true);
}

async function api(path) {
  for (;;) {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bot ${token}` } });
    if (res.status === 429) {
      const { retry_after } = await res.json();
      await new Promise(r => setTimeout(r, (retry_after + 0.1) * 1000));
      continue;
    }
    if (!res.ok) {
      const err = new Error(`${res.status} ${path}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }
}

function snowflakeFromDate(date) {
  return ((BigInt(date.getTime()) - DISCORD_EPOCH) << 22n).toString();
}

/** All messages in a channel at/after `since`, oldest first. */
async function fetchSince(channelId, since) {
  const floor = BigInt(snowflakeFromDate(since));
  const out = [];
  let before = null;
  for (;;) {
    const page = await api(`/channels/${channelId}/messages?limit=100${before ? `&before=${before}` : ''}`);
    if (page.length === 0) break;
    for (const m of page) if (BigInt(m.id) >= floor) out.push(m);
    before = page[page.length - 1].id;
    if (BigInt(before) < floor) break;
  }
  return out.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
}

function mentionedIds(content) {
  return [...content.matchAll(/<@!?(\d+)>/g)].map(m => m[1]);
}

function isWordleResult(m) {
  return wordleBotIds.includes(m.author.id) && m.content.includes(TRIGGER);
}

/** Wordle-bot messages that look like results but would not trigger the handler. */
function looksLikeUnmatchedResult(m) {
  return wordleBotIds.includes(m.author.id) && !m.content.includes(TRIGGER) && /\d\/6|X\/6/.test(m.content) && /<@!?\d+>/.test(m.content);
}

function auditChannel(channel, messages, names) {
  const rows = [];
  const unmatched = [];
  const allGarry = messages.filter(m => m.author.id === botId);
  // Only messages shaped like the Wordle report; other bot replies that @mention users must not count
  const garryReplies = allGarry.filter(m => /solved the Wordle in|knew too many words|Cheating detected/.test(m.content) && mentionedIds(m.content).length > 0);

  const wordleMsgs = messages.filter(isWordleResult);
  for (const m of messages) {
    for (const u of m.mentions || []) names[u.id] = u.global_name || u.username;
    if (looksLikeUnmatchedResult(m)) unmatched.push({ channel: channel.name, id: m.id, timestamp: m.timestamp, content: m.content });
  }

  wordleMsgs.forEach((m, i) => {
    const t = Date.parse(m.timestamp);
    const next = wordleMsgs[i + 1] ? Date.parse(wordleMsgs[i + 1].timestamp) : Infinity;
    const end = Math.min(next, t + REPLY_WINDOW_MS);

    const mentions = new Map((m.mentions || []).map(u => [u.id, u]));
    const parsed = Object.keys(parseWordleResults(m.content, mentions));
    const listed = [...new Set(mentionedIds(m.content))];

    const replies = garryReplies.filter(r => {
      const rt = Date.parse(r.timestamp);
      return rt >= t && rt < end;
    });
    const reported = new Set(replies.flatMap(r => mentionedIds(r.content)));
    const prevBot = [...allGarry].reverse().find(r => Date.parse(r.timestamp) < t);
    const nextBot = allGarry.find(r => Date.parse(r.timestamp) > t);

    rows.push({
      channel: channel.name,
      messageId: m.id,
      timestamp: m.timestamp,
      edited: !!m.edited_timestamp,
      listed,
      parsed,
      unparsed: listed.filter(id => !parsed.includes(id)),
      replyCount: replies.length,
      prevBotMsgAt: prevBot ? prevBot.timestamp : null,
      nextBotMsgAt: nextBot ? nextBot.timestamp : null,
      missed: parsed.filter(id => !reported.has(id)),
    });
  });
  return { rows, unmatched };
}

async function main() {
  if (!token || !botId || !guildId || wordleBotIds.length === 0) {
    throw new Error('Need PROD_DISCORD_TOKEN, PROD_APP_ID, PIMP_CATS_SERVER_ID, WORDLE_BOT_IDS in env');
  }
  const since = new Date(arg('since') || '2025-07-26');
  const channels = (await api(`/guilds/${guildId}/channels`)).filter(c => c.type === 0);

  const names = {};
  const rows = [];
  const unmatched = [];
  for (const channel of channels) {
    let messages;
    try {
      messages = await fetchSince(channel.id, since);
    } catch (e) {
      if (e.status === 403) continue; // bot cannot see this channel
      throw e;
    }
    if (!messages.some(isWordleResult) && !messages.some(looksLikeUnmatchedResult)) continue;
    console.error(`#${channel.name}: ${messages.length} messages scanned`);
    const res = auditChannel(channel, messages, names);
    rows.push(...res.rows);
    unmatched.push(...res.unmatched);
  }

  // Per-user tally
  const tally = {};
  const bump = (id, key) => {
    tally[id] = tally[id] || { expected: 0, missed: 0, unparsed: 0 };
    tally[id][key]++;
  };
  for (const r of rows) {
    r.parsed.forEach(id => bump(id, 'expected'));
    r.missed.forEach(id => bump(id, 'missed'));
    r.unparsed.forEach(id => bump(id, 'unparsed'));
  }

  const noReply = rows.filter(r => r.replyCount === 0);
  const multiReply = rows.filter(r => r.replyCount > 1);
  const partial = rows.filter(r => r.replyCount > 0 && r.missed.length > 0);
  const totalMissed = rows.reduce((n, r) => n + r.missed.length, 0);
  const totalExpected = rows.reduce((n, r) => n + r.parsed.length, 0);

  console.log(`\nWordle result messages: ${rows.length} (since ${since.toISOString().slice(0, 10)})`);
  console.log(`  no GarryCoin reply at all : ${noReply.length}`);
  console.log(`  reply but players missing : ${partial.length}`);
  console.log(`  multiple replies (edits?) : ${multiReply.length}`);
  console.log(`  edited by Wordle bot      : ${rows.filter(r => r.edited).length}`);
  console.log(`  looked like results, did not match trigger: ${unmatched.length}`);
  console.log(`  player-days expected ${totalExpected}, missed ${totalMissed} (${totalExpected ? ((totalMissed / totalExpected) * 100).toFixed(1) : 0}%)`);
  console.log(`  listed in message but dropped by parser: ${rows.reduce((n, r) => n + r.unparsed.length, 0)}`);

  console.log('\nPer-user tally (missed / expected):');
  Object.entries(tally)
    .sort((a, b) => b[1].missed - a[1].missed || b[1].expected - a[1].expected)
    .forEach(([id, t]) => {
      console.log(`  ${(names[id] || id).padEnd(28)} ${String(t.missed).padStart(4)} / ${String(t.expected).padEnd(4)} ${(t.expected ? (t.missed / t.expected) * 100 : 0).toFixed(0).padStart(3)}%${t.unparsed ? `  (+${t.unparsed} unparsed)` : ''}`);
    });

  if (arg('verbose')) {
    console.log('\nMessages with misses:');
    rows.filter(r => r.missed.length).forEach(r => {
      console.log(`  ${r.timestamp.slice(0, 10)} #${r.channel} msg ${r.messageId} replies=${r.replyCount} edited=${r.edited} missed=${r.missed.map(id => names[id] || id).join(', ')}`);
    });
  }

  const jsonPath = arg('json');
  if (typeof jsonPath === 'string') {
    fs.writeFileSync(jsonPath, JSON.stringify({ since, rows, unmatched, tally, names }, null, 2));
    console.error(`wrote ${jsonPath}`);
  }
}

if (require.main === module) {
  main().catch(e => {
    console.error(e.message);
    process.exit(1);
  });
}
