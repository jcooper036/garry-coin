const { executeReadOnlyQuery, formatQueryResults } = require('../readOnlyDb');
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
    
    structuredLog.database('User executing SQL query', {
      userId,
      isPublic,
      queryLength: sql.length,
      queryPreview: sql.substring(0, 50) + (sql.length > 50 ? '...' : ''),
      fullQuery: sql
    });
    
    try {
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