const { getGamblingStats, findOrCreateUser } = require('../db');

module.exports = {
  name: 'garrygamblingstats',
  async execute(interaction, client) {
    const options = interaction.data?.options || [];
    const targetUserOption = options.find(opt => opt.name === 'user');
    
    let targetUserId;
    let targetUsername;
    
    if (targetUserOption) {
      targetUserId = targetUserOption.value;
      const targetUserData = interaction.data.resolved.users[targetUserId];
      targetUsername = targetUserData.global_name || targetUserData.username;
    } else {
      targetUserId = interaction.member.user.id;
      targetUsername = interaction.member.user.global_name || interaction.member.user.username;
    }

    // Ensure target user exists in database
    await findOrCreateUser(targetUserId);

    try {
      const stats = await getGamblingStats(targetUserId);
      
      if (stats.overall.gamesPlayed === 0) {
        return {
          content: `${targetUsername} hasn't played any gambling games yet!`,
          ephemeral: true,
        };
      }

      const { overall, byGame } = stats;
      const profitSymbol = overall.netProfit >= 0 ? '📈' : '📉';
      const streakSymbol = overall.currentStreakType === 'win' ? '🔥' : '💸';

      let content = `🎰 **${targetUsername}'s Gambling Stats** 🎰\n\n`;
      
      // Overall Stats
      content += `**📊 Overall Performance**\n`;
      content += `• **Total Wagered:** ${overall.totalWagered} GC\n`;
      content += `• **Total Won:** ${overall.totalWon} GC\n`;
      content += `• **Net Profit:** ${profitSymbol} ${overall.netProfit >= 0 ? '+' : ''}${overall.netProfit} GC\n`;
      content += `• **Games Played:** ${overall.gamesPlayed}\n`;
      content += `• **Win Rate:** ${overall.winRate.toFixed(1)}% (${overall.wins}/${overall.gamesPlayed})\n`;
      content += `• **Avg Wager:** ${overall.avgWager.toFixed(1)} GC\n\n`;
      
      // Advanced Stats
      content += `**🏆 Records & Streaks**\n`;
      content += `• **Biggest Win:** ${overall.biggestWin} GC\n`;
      content += `• **Biggest Loss:** ${overall.biggestLoss} GC\n`;
      content += `• **Current Streak:** ${streakSymbol} ${overall.currentStreak} ${overall.currentStreakType}${overall.currentStreak > 1 ? 's' : ''}\n\n`;
      
      // Per-Game Breakdown
      content += `**🎮 By Game Type**\n`;
      
      for (const [gameName, gameData] of Object.entries(byGame)) {
        if (gameData.games === 0) continue;
        
        const gameDisplayName = {
          'heist': '🔒 Heist',
          'rtb': '🚌 Ride the Bus',
          'wavelength': '🌊 Wavelength'
        }[gameName];
        
        const gameProfit = gameData.won - gameData.wagered;
        const gameWinRate = gameData.games > 0 ? (gameData.wins / gameData.games * 100) : 0;
        const gameProfitSymbol = gameProfit >= 0 ? '📈' : '📉';
        
        content += `${gameDisplayName}\n`;
        content += `  • Games: ${gameData.games} | Win Rate: ${gameWinRate.toFixed(1)}%\n`;
        content += `  • Wagered: ${gameData.wagered} | Won: ${gameData.won}\n`;
        content += `  • Profit: ${gameProfitSymbol} ${gameProfit >= 0 ? '+' : ''}${gameProfit} GC\n\n`;
      }

      // Add a cheeky message if the user is losing badly
      if (overall.netProfit < -100) {
        content += `_Maybe it's time to quit while you're... not as far behind?_ 😅`;
      } else if (overall.netProfit > 100) {
        content += `_Looking good! The house isn't always winning._ 🎉`;
      }

      return {
        content,
        ephemeral: false,
      };
    } catch (error) {
      console.error('Error fetching gambling stats:', error);
      return {
        content: 'Failed to fetch gambling statistics. Please try again later.',
        ephemeral: true,
      };
    }
  },
};