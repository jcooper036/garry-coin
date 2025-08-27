const { getTopUsersByBalance } = require('../db');
const { formatApproxGC } = require('../number_formatter');

module.exports = {
  name: 'garryfatcats',
  async execute(interaction, client) {
    const options = interaction.data?.options || [];
    const countOption = options.find(opt => opt.name === 'count');
    let count = countOption?.value || 5;

    // Validate count is positive
    if (count <= 0) {
      return {
        content: 'Count must be a positive number!',
        ephemeral: true,
      };
    }

    try {
      const topUsers = await getTopUsersByBalance(count);
      
      if (!topUsers || topUsers.length === 0) {
        return {
          content: 'No users found with balances!',
          ephemeral: true,
        };
      }

      // Adjust count if we got fewer users than requested
      const actualCount = topUsers.length;
      const requestedCount = count;

      let content = `💰 **GarryCoin Fat Cats** 💰\n`;
      content += `_The richest users in the server_\n`;
      
      if (actualCount < requestedCount) {
        content += `_(Showing all ${actualCount} users)_\n`;
      }
      content += `\n`;

      const medals = ['🥇', '🥈', '🥉'];
      
      topUsers.forEach((user, index) => {
        const medal = index < 3 ? medals[index] : `${index + 1}.`;
        const mention = `<@${user.user_id}>`;
        const balance = user.balance;
        const balanceEmoji = balance >= 1000 ? '💎' : balance >= 500 ? '💰' : balance >= 100 ? '🟡' : '🪙';
        
        content += `${medal} ${mention} - ${balanceEmoji} ${formatApproxGC(balance)} GC\n`;
      });

      content += `\n_Living the high life! 🎩_`;

      return {
        content,
        ephemeral: false,
      };
    } catch (error) {
      console.error('Error fetching top users by balance:', error);
      return {
        content: 'Failed to fetch the rich list. Please try again later.',
        ephemeral: true,
      };
    }
  },
};