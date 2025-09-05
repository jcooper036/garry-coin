const { db } = require('../db');
const { structuredLog } = require('../logger');

module.exports = {
  name: 'garrycatchapredator',
  async execute(interaction) {
    try {
      const query = `
        select
          user_id,
          SUM(was_caught_cheating::int) as total_cheats,
          AVG(was_caught_cheating::int) as cheating_ratio,
          COUNT(*) as total_attempts
        from wordle_rewards
        group by user_id
        order by cheating_ratio desc, total_cheats desc
      `;

      const results = await db.raw(query);
      const rows = results.rows;

      if (rows.length === 0) {
        return {
          content: '🕵️ **PREDATOR PATROL UPDATE**\n\nNo Wordle data found. The streets are clean... for now.',
          ephemeral: false
        };
      }

      // Create the dramatic report
      let content = '🕵️ **WORDLE CHEATING INVESTIGATION COMPLETE** 🕵️\n\n';
      content += '**🚨 PREDATOR PATROL FINDINGS 🚨**\n\n';

      // Sort cheaters first (ratio > 0)
      const cheaters = rows.filter(row => parseFloat(row.cheating_ratio) > 0);
      const cleanPlayers = rows.filter(row => parseFloat(row.cheating_ratio) === 0);

      if (cheaters.length > 0) {
        content += '**🎯 KNOWN CHEATERS:**\n';
        for (const row of cheaters) {
          const ratio = (parseFloat(row.cheating_ratio) * 100).toFixed(1);
          const cheats = parseInt(row.total_cheats);
          const attempts = parseInt(row.total_attempts);
          const emoji = ratio >= 50 ? '🔥' : ratio >= 25 ? '⚠️' : '👀';
          
          content += `${emoji} <@${row.user_id}>: **${ratio}%** cheater (${cheats}/${attempts} attempts)\n`;
        }
        content += '\n';
      }

      if (cleanPlayers.length > 0) {
        content += '**✅ CLEAN RECORD:**\n';
        const topClean = cleanPlayers.slice(0, 10); // Show top 10 clean players
        for (const row of topClean) {
          const attempts = parseInt(row.total_attempts);
          content += `🏆 <@${row.user_id}>: **0%** cheater (0/${attempts} attempts)\n`;
        }
        
        if (cleanPlayers.length > 10) {
          content += `*...and ${cleanPlayers.length - 10} other clean players*\n`;
        }
      }

      content += '\n**📊 INVESTIGATION STATS:**\n';
      content += `• Total players investigated: ${rows.length}\n`;
      content += `• Known cheaters: ${cheaters.length}\n`;
      content += `• Clean records: ${cleanPlayers.length}\n`;
      
      const totalCheats = rows.reduce((sum, row) => sum + parseInt(row.total_cheats), 0);
      const totalAttempts = rows.reduce((sum, row) => sum + parseInt(row.total_attempts), 0);
      const overallRate = totalAttempts > 0 ? ((totalCheats / totalAttempts) * 100).toFixed(2) : '0.00';
      content += `• Overall cheating rate: **${overallRate}%**\n\n`;
      
      content += '🔍 *Remember: Cheaters never prosper... except when they do.*';

      structuredLog.security('Predator patrol executed', {
        userId: interaction.member.user.id,
        totalPlayers: rows.length,
        cheaters: cheaters.length,
        overallRate: overallRate
      });

      return {
        content: content,
        ephemeral: false
      };

    } catch (error) {
      structuredLog.error('Predator patrol error', error, { 
        userId: interaction.member.user.id 
      });
      
      return {
        content: '🚫 **INVESTIGATION ERROR:** The predator patrol database is temporarily corrupted. Our finest investigators are on the case.',
        ephemeral: true
      };
    }
  }
};