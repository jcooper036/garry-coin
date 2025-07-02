const { db, findOrCreateUser } = require('../db');

module.exports = {
  name: 'garryhistory',
  async execute(interaction) {
    const userId = interaction.member.user.id;
    await findOrCreateUser(userId);
    const transactions = await db('transactions')
      .where({ sending_user_id: userId })
      .orWhere({ receiving_user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(10);

    if (transactions.length === 0) {
      return {
        content: 'You have no transaction history.',
        ephemeral: true,
      };
    }

    const history = transactions.map(t => {
      const direction = t.sending_user_id === userId ? 'sent to' : 'received from';
      const otherUserId = direction === 'sent to' ? t.receiving_user_id : t.sending_user_id;
      return `${new Date(t.created_at).toLocaleString()}: ${t.amount} GC ${direction} <@${otherUserId}>`;
    }).join('\n');

    return {
      content: `Your last 10 transactions:\n${history}`,
      ephemeral: true,
    };
  },
};