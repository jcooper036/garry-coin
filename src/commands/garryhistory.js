const { db, findOrCreateUser } = require('../db');

function getTransactionReason(transactionType) {
  const reasonMap = {
    // Game types
    'heist_win': 'heist victory 💰',
    'heist_loss': 'heist attempt 🦹',
    'heist_cover_loan': 'heist financing 🎭💸',
    'rtb_wager': 'ride the bus wager 🚌',
    'rtb_win_end_of_line': 'ride the bus jackpot 🎰',
    'rtb_refund_cancel': 'ride the bus refund ❌🚌',
    'wavelength_wager': 'wavelength wager 📻',
    'wavelength_win': 'wavelength victory 🎯',
    // System types
    'lottery_grant': 'lottery winnings 🎲',
    'wordle_reward': 'wordle puzzle reward 🧩',
    'rain_distribution': 'rain shower 🌧️',
    'house_grant': 'house generosity 🏛️💝',
    'loan_disbursement': 'loan disbursement 🏦',
    'loan_payment': 'loan repayment 💳',
    'fgr_loan_bailout': 'FGR bailout assistance 🏛️',
    // Manual transfers
    'user_to_user_slash_command': 'direct transfer 💸',
    'user_to_user_make_it_rain': 'make it rain 🌧️💰',
    'manual_transfer': 'direct transfer 💸',
    'admin_grant': 'admin grant 👑',
    'transfer': 'transfer 💸'
  };
  
  // Handle RTB cash out variants
  if (transactionType?.startsWith('rtb_win_cash_out_')) {
    const position = transactionType.replace('rtb_win_cash_out_', '');
    return `ride the bus cash out (${position}) 🚌💰`;
  }
  
  return reasonMap[transactionType] || `${transactionType || 'unknown'} 🤔`;
}

module.exports = {
  name: 'garryhistory',
  async execute(interaction) {
    const userId = interaction.member.user.id;
    await findOrCreateUser(userId);
    const transactions = await db('transactions')
      .where({ sending_user_id: userId })
      .orWhere({ receiving_user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(10)
      .select('*');

    if (transactions.length === 0) {
      return {
        content: '📜 **Transaction History** 📜\n\n*No transactions found. Your wallet is pristine!* ✨',
        ephemeral: true,
      };
    }

    const history = transactions.map(t => {
      const isSending = t.sending_user_id === userId;
      const direction = isSending ? 'sent' : 'received';
      const preposition = isSending ? 'to' : 'from';
      const otherUserId = isSending ? t.receiving_user_id : t.sending_user_id;
      const reason = getTransactionReason(t.transaction_type);
      const emoji = isSending ? '📤' : '📥';
      const amount = t.amount.toLocaleString();
      
      // Handle system transactions (lottery, house, etc.)
      let otherUserDisplay;
      if (otherUserId === 'lottery') {
        otherUserDisplay = 'The Lottery 🎲';
      } else if (otherUserId === 'house') {
        otherUserDisplay = 'The House 🏛️';
      } else {
        otherUserDisplay = `<@${otherUserId}>`;
      }
      
      return `${emoji} **${direction}** ${amount} GC ${preposition} ${otherUserDisplay} for *${reason}*`;
    }).join('\n');

    return {
      content: `📜 **Your Transaction History** 📜\n\n${history}\n\n*Showing your last ${transactions.length} transaction${transactions.length === 1 ? '' : 's'}*`,
      ephemeral: true,
    };
  },
};