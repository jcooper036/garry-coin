const { getGamblingLeaderboard } = require('../db');

module.exports = {
  name: 'garrygamblingboard',
  async execute(interaction, client) {
    const options = interaction.data?.options || [];
    const typeOption = options.find(opt => opt.name === 'type');
    const boardType = typeOption?.value || 'profit';

    try {
      const leaderboard = await getGamblingLeaderboard(boardType);
      
      if (!leaderboard || leaderboard.length === 0) {
        return {
          content: 'No gambling data found! Start playing some games to see the leaderboard.',
          ephemeral: true,
        };
      }

      let title, description;
      
      if (boardType === 'profit') {
        title = '💰 Gambling Profit Leaderboard';
        description = 'Users ranked by net gambling profit/loss';
      } else if (boardType === 'volume') {
        title = '🎰 Gambling Volume Leaderboard';
        description = 'Users ranked by total games played';
      } else if (boardType === 'winrate') {
        title = '🏆 Gambling Win Rate Leaderboard';
        description = 'Users ranked by win percentage (min 10 games)';
      }

      let content = `🎲 **${title}** 🎲\n`;
      content += `_${description}_\n\n`;

      const medals = ['🥇', '🥈', '🥉'];
      
      leaderboard.forEach((user, index) => {
        const medal = index < 3 ? medals[index] : `${index + 1}.`;
        const mention = `<@${user.user_id}>`;
        
        if (boardType === 'profit') {
          const profitSymbol = user.net_profit >= 0 ? '📈' : '📉';
          content += `${medal} ${mention} - ${profitSymbol} ${user.net_profit >= 0 ? '+' : ''}${user.net_profit} GC (${user.games_played} games)\n`;
        } else if (boardType === 'volume') {
          content += `${medal} ${mention} - ${user.games_played} games (${user.total_wagered} GC wagered)\n`;
        } else if (boardType === 'winrate') {
          content += `${medal} ${mention} - ${user.win_rate}% win rate (${user.wins}/${user.games_played})\n`;
        }
      });

      // Add some flavor text based on the board type
      if (boardType === 'profit') {
        content += `\n_Who's beating the house? 🏠_`;
      } else if (boardType === 'volume') {
        content += `\n_Who has the gambling addiction? 🎰_`;
      } else if (boardType === 'winrate') {
        content += `\n_Who's got the golden touch? ✨_`;
      }

      return {
        content,
        ephemeral: false,
      };
    } catch (error) {
      console.error('Error fetching gambling leaderboard:', error);
      return {
        content: 'Failed to fetch gambling leaderboard. Please try again later.',
        ephemeral: true,
      };
    }
  },
};