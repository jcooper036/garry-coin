const { executeReadOnlyQuery, formatQueryResults, checkUserSqlBan, issueSqlBan, validateReadOnlyQueryWithDetails } = require('../readOnlyDb');
const { structuredLog } = require('../logger');

module.exports = {
  name: 'garryquerylanguage',
  async execute(interaction) {
    const userId = interaction.member.user.id;

    // Extract options from interaction data
    if (!interaction.data || !interaction.data.options) {
      return {
        content: '❌ No SQL query provided.',
        ephemeral: true,
      };
    }

    const sqlOption = interaction.data.options.find(opt => opt.name === 'sql');
    const publicOption = interaction.data.options.find(opt => opt.name === 'public');

    if (!sqlOption) {
      return {
        content: '❌ SQL query parameter is required.',
        ephemeral: true,
      };
    }

    const sql = sqlOption.value;
    const isPublic = publicOption ? publicOption.value : false;

    // NOTE: Permission checking should be configured via Discord's application command permissions
    // in the Discord Developer Portal to restrict this command to administrators only.

    try {
      // Check if user is currently banned
      const banStatus = await checkUserSqlBan(userId);

      if (banStatus.isBanned) {
        structuredLog.warn('Banned user attempted SQL query', {
          userId,
          banNumber: banStatus.banNumber,
          minutesRemaining: banStatus.minutesRemaining,
          queryPreview: sql.substring(0, 50) + (sql.length > 50 ? '...' : '')
        });

        return {
          content: `🚫 **You are SQL-banned!** ⏰ Time remaining: ${banStatus.minutesRemaining} minutes\n` +
            `This is ban #${banStatus.banNumber}. Each violation doubles your ban time and fine!`,
          ephemeral: true,
        };
      }

      // Validate the query with detailed violation info
      const validation = validateReadOnlyQueryWithDetails(sql);

      if (!validation.valid) {
        // Issue ban and fine for forbidden query
        const banResult = await issueSqlBan(userId, sql, validation.violationType, validation.violationDetails);

        structuredLog.warn('SQL violation detected - ban issued', {
          userId,
          violationType: validation.violationType,
          violationDetails: validation.violationDetails,
          banNumber: banResult.banNumber,
          banDurationMinutes: banResult.banDurationMinutes,
          fineAmount: banResult.fineAmount,
          queryPreview: sql.substring(0, 50) + (sql.length > 50 ? '...' : '')
        });

        // Public shaming message
        return {
          content: `🚨 **SQL VIOLATION DETECTED!** 🚨\n` +
            `<@${userId}> attempted a forbidden query and has been banned from running queries!\n\n` +
            `**Violation:** ${validation.error}\n` +
            `**Ban Duration:** ${banResult.banDurationMinutes} minutes\n` +
            `**Fine:** ${banResult.fineAmount} GarryCoins\n` +
            `**Ban Number:** ${banResult.banNumber} (penalties double each time!)\n\n` +
            `*Attempted Query:* \`${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}\`\n\n` +
            `🔒 Think twice before trying to hack the database! 🔒`,
          ephemeral: false, // Always public for shaming
        };
      }

      structuredLog.database('User executing valid SQL query', {
        userId,
        isPublic,
        queryLength: sql.length,
        queryPreview: sql.substring(0, 50) + (sql.length > 50 ? '...' : ''),
        fullQuery: sql
      });

      // Execute the read-only query
      const result = await executeReadOnlyQuery(sql, {
        maxRows: 100,
        timeoutMs: 30000
      });

      // Format and return results
      return formatQueryResults(result, isPublic);

    } catch (error) {
      structuredLog.dbError('SQL query command failed', error, { userId, sql: sql.substring(0, 100) });

      return {
        content: `❌ An unexpected error occurred: ${error.message}`,
        ephemeral: true,
      };
    }
  },
};