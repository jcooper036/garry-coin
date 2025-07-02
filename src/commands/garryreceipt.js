const { db, findOrCreateUser } = require('../db');

module.exports = {
  name: 'garryreceipt',
  async execute(interaction) {
    const targetUserId = interaction.data.options[0].value;
    const targetUser = interaction.data.resolved.users[targetUserId];

    await findOrCreateUser(targetUserId);
    const transactions = await db('transactions')
      .where({ sending_user_id: targetUserId })
      .orWhere({ receiving_user_id: targetUserId })
      .orderBy('created_at', 'desc')
      .limit(10);

    if (transactions.length === 0) {
      return {
        content: `User ${targetUser.username} has no transaction history.`,
        ephemeral: false,
      };
    }

    const history = transactions.map(t => {
      const direction = t.sending_user_id === targetUserId ? 'sent to' : 'received from';
      const otherUserId = direction === 'sent to' ? t.receiving_user_id : t.sending_user_id;
      return `${new Date(t.created_at).toLocaleString()}: ${t.amount} GC ${direction} <@${otherUserId}>`;
    }).join('\n');

    return {
      content: `Last 10 transactions for ${targetUser.username}:\n${history}`,
      ephemeral: false,
    };
  },
};