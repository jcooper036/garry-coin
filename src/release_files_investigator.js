const { llmService } = require('./llm_service');
const {
  addReleaseFilesQuery,
  addReleaseFilesCodebaseRef,
  getReleaseFilesCaseHistory
} = require('./db');
const { readOnlyDb } = require('./readOnlyDb');
const { structuredLog } = require('./logger');
const { executeAllInvestigationQueries } = require('./investigation_queries');
const fs = require('fs').promises;
const path = require('path');

class ReleaseFilesInvestigator {
  constructor() {
    this.investigativeFiles = [
      'src/db.js',
      'src/commands/games/heist.js',
      'src/commands/games/ridethebus.js',
      'src/commands/games/wavelength.js',
      'CLAUDE.md',
      'DESIGN.md',
      'README.md'
    ];
  }

  async conductInvestigation(investigationCase, interaction, client = null) {
    try {
      const { id: caseId, target_user_id: targetUserId, grievance, bias_direction: biasDirection, bribe_amount: bribeAmount } = investigationCase;

      structuredLog.security('Starting Release Files investigation', {
        caseId,
        biasDirection,
        grievance: grievance.substring(0, 100)
      });

      // Get bot user ID early for entity extraction
      const botUserId = client?.user?.id || null;

      // Step 1: Analyze grievance for key entities (users, topics, etc.)
      const entities = this.extractEntities(grievance, botUserId);

      // Step 2: Check case history for consistency
      const caseHistory = await this.gatherCaseHistory(entities);

      // Step 3: Generate and execute SQL queries (with bot user ID if available)
      const sqlEvidence = await this.gatherSqlEvidence(caseId, targetUserId, grievance, entities, biasDirection, botUserId);

      // Step 4: Read relevant codebase files  
      const codebaseEvidence = await this.gatherCodebaseEvidence(caseId, grievance, entities, biasDirection);

      // Step 5: Generate bombastic final report
      const finalReport = await this.generateFinalReport(investigationCase, sqlEvidence, codebaseEvidence, caseHistory);

      // Update Discord message with final report
      await interaction.editReply({
        content: finalReport
      });

      structuredLog.security('Release Files investigation completed', {
        caseId,
        sqlQueries: sqlEvidence.length,
        codebaseRefs: codebaseEvidence.length,
        botUserId: botUserId || 'not_available'
      });

    } catch (error) {
      structuredLog.error('Release Files investigation failed', error, {
        caseId: investigationCase.id
      });
      throw error;
    }
  }

  extractEntities(grievance, botUserId = null) {
    // Extract Discord user IDs (mentions like <@123456> or just plain IDs)
    const userMentions = [...grievance.matchAll(/<@!?(\d+)>/g)].map(match => match[1]);
    const plainUserIds = [...grievance.matchAll(/\b\d{17,19}\b/g)].map(match => match[0]);
    let allUserIds = [...new Set([...userMentions, ...plainUserIds])];

    // Check for bot references and replace with actual bot ID
    if (botUserId) {
      const botReferences = [
        'you', 'u', 'bot', 'garry', 'garrybot', 'garry bot', 'the bot',
        'system', 'server', 'house', 'admin', 'moderator'
      ];

      const grievanceLower = grievance.toLowerCase();
      const hasBotReference = botReferences.some(ref => {
        // Use word boundaries to match whole words
        const regex = new RegExp(`\\b${ref}\\b`, 'i');
        return regex.test(grievanceLower);
      });

      if (hasBotReference) {
        // Add bot ID to investigation targets
        allUserIds.push(botUserId);
        structuredLog.security('Bot reference detected in grievance', {
          grievance: grievance.substring(0, 100),
          botUserId,
          detectedReferences: botReferences.filter(ref => {
            const regex = new RegExp(`\\b${ref}\\b`, 'i');
            return regex.test(grievanceLower);
          })
        });
      }
    }

    // Extract key topics
    const topics = [];
    const topicKeywords = {
      'gambling': ['heist', 'gambling', 'rtb', 'ride the bus', 'wavelength', 'wager', 'bet'],
      'economy': ['balance', 'money', 'coin', 'gc', 'garrycoin', 'wealth', 'transfer'],
      'loans': ['loan', 'borrow', 'lend', 'credit', 'debt', 'interest'],
      'games': ['game', 'win', 'loss', 'rigged', 'cheat', 'unfair']
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => grievance.toLowerCase().includes(keyword))) {
        topics.push(topic);
      }
    }

    return {
      users: [...new Set(allUserIds)], // Remove duplicates
      topics,
      keywords: grievance.toLowerCase().split(' ').filter(word => word.length > 3)
    };
  }

  async gatherCaseHistory(entities) {
    try {
      // Look up previous cases involving mentioned users
      const userHistory = [];
      for (const userId of entities.users) {
        const cases = await getReleaseFilesCaseHistory(null, userId);
        userHistory.push(...cases);
      }
      return userHistory;
    } catch (error) {
      structuredLog.error('Failed to gather case history', error);
      return [];
    }
  }

  async gatherSqlEvidence(caseId, targetUserId, grievance, entities, biasDirection, botUserId = null) {
    try {
      structuredLog.security('Starting comprehensive database investigation', {
        caseId,
        targetUserId,
        biasDirection,
        entitiesFound: entities.users.length + entities.topics.length
      });

      if (!targetUserId) {
        structuredLog.error('No target user ID provided for investigation', { caseId, grievance: grievance.substring(0, 100) });
        return [];
      }

      // Execute all predefined investigation queries
      const allQueryResults = await executeAllInvestigationQueries(targetUserId, botUserId);

      // Filter and interpret results for Release Files system
      const evidenceQueries = [];

      // Prioritize queries that have data (limit to 2 as per user request)
      const queriesWithData = allQueryResults.filter(q => q.results && q.results.length > 0);
      const selectedQueries = queriesWithData.slice(0, 2);

      for (const queryResult of selectedQueries) {
        try {
          // Log the executed query
          structuredLog.security('Release Files predefined query executed', {
            caseId,
            queryId: queryResult.queryId,
            queryName: queryResult.name,
            resultCount: queryResult.results.length,
            biasDirection
          });

          // Get AI interpretation of results  
          const interpretation = await this.interpretQueryResults(
            queryResult.name,
            queryResult.results,
            biasDirection
          );

          // Store in database
          await addReleaseFilesQuery(
            caseId,
            `${queryResult.name}: ${queryResult.description}`,
            JSON.stringify(queryResult.results),
            interpretation,
            true
          );

          evidenceQueries.push({
            query: queryResult.name,
            results: queryResult.results,
            interpretation,
            queryId: queryResult.queryId
          });
        } catch (queryError) {
          structuredLog.warn('Failed to process predefined query result', queryError, {
            caseId,
            queryId: queryResult.queryId
          });
        }
      }

      structuredLog.security('Database investigation completed', {
        caseId,
        totalQueriesExecuted: allQueryResults.length,
        evidenceQueriesSelected: evidenceQueries.length
      });

      return evidenceQueries;
    } catch (error) {
      structuredLog.error('Failed to gather SQL evidence', error, { caseId });
      return [];
    }
  }


  async interpretQueryResults(queryName, results, biasDirection) {
    try {
      const resultsText = JSON.stringify(results, null, 2);
      const systemPrompt = `You are a bombastic federal investigator writing for the masses. Your bias: ${biasDirection === 'for' ? 'Support the complaint' : 'Oppose the complaint'}.

Analysis type: ${queryName}
Database query results: ${resultsText.substring(0, 500)}

CRITICAL INSTRUCTIONS:
- Be baselessly judgmental and emotionally manipulative
- Target fear centers - use words like SHOCKING, DISTURBING, ALARMING, CONCERNING
- Translate technical terms: "rtb" = "Ride the Bus gambling", "wavelength" = "word guessing games", "heist" = "theft simulation games"
- Transaction types like "rtb_refund_cancel" = "gambling refund after cancellation", "loan_payment" = "debt servicing", etc.
- Write for angry plebs who want simple explanations that validate their outrage
- Use phrases like "TAXPAYER MONEY", "RIGGED SYSTEM", "INSIDER DEALINGS", "SUSPICIOUS ACTIVITY" but pick broadly from phrases that suit the context
- NEVER use raw user IDs - refer to users as "the accused", "the target", "this individual", "the suspect", "the user in question", etc.

Interpret these findings in 1-2 sentences that ${biasDirection === 'for' ? 'support' : 'refute'} the complaint. Use strategic CAPS on emphasis words like: SHOCKING, DISTURBING, PROVES, EXPOSES, REVEALS, CONFIRMS, REFUTES.

Keep under 80 words and make it emotionally charged.`;

      const interpretation = await llmService.generateText(systemPrompt, {
        timeout: 8000,
        fallback: biasDirection === 'for'
          ? "Database records EXPOSE SHOCKING evidence supporting this complaint. The data REVEALS DISTURBING patterns of insider dealings."
          : "Database analysis COMPLETELY DESTROYS these baseless claims. The records PROVE this is nothing but conspiracy nonsense from disgruntled users."
      });

      // Post-process: Convert any user IDs to mentions  
      return this.convertUserIdsToMentions(interpretation);
    } catch (error) {
      return biasDirection === 'for'
        ? "Classified evidence EXPOSES SHOCKING corruption. The data doesn't lie - the accused is getting rich off this RIGGED SYSTEM."
        : "Database records DEMOLISH these ridiculous conspiracy theories. ZERO evidence of wrongdoing - just another false alarm from paranoid users.";
    }
  }

  async gatherCodebaseEvidence(caseId, grievance, entities, biasDirection) {
    const codebaseEvidence = [];

    try {
      // Select relevant files based on grievance content
      const relevantFiles = this.selectRelevantFiles(grievance, entities);

      for (const filePath of relevantFiles.slice(0, 1)) { // Limit to 1 file for evidence balance
        try {
          const content = await this.readCodebaseFile(filePath);
          if (content) {
            const interpretation = await this.interpretCodebaseEvidence(filePath, content, grievance, biasDirection);

            await addReleaseFilesCodebaseRef(caseId, filePath, content.substring(0, 1000), interpretation, true);

            codebaseEvidence.push({
              filePath,
              content: content.substring(0, 500),
              interpretation
            });
          }
        } catch (fileError) {
          structuredLog.warn('Failed to read codebase file', fileError, { filePath });
        }
      }
    } catch (error) {
      structuredLog.error('Failed to gather codebase evidence', error, { caseId });
    }

    return codebaseEvidence;
  }

  selectRelevantFiles(grievance, entities) {
    const relevant = [];
    const lowerGrievance = grievance.toLowerCase();

    // Game-specific files
    if (lowerGrievance.includes('heist')) relevant.push('src/commands/games/heist.js');
    if (lowerGrievance.includes('rtb') || lowerGrievance.includes('ride the bus')) relevant.push('src/commands/games/ridethebus.js');
    if (lowerGrievance.includes('wavelength')) relevant.push('src/commands/games/wavelength.js');

    // Always include key system files
    relevant.push('src/db.js', 'CLAUDE.md');

    return [...new Set(relevant)]; // Remove duplicates
  }

  async readCodebaseFile(filePath) {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      const content = await fs.readFile(fullPath, 'utf8');
      return content;
    } catch (error) {
      structuredLog.warn('Failed to read file', error, { filePath });
      return null;
    }
  }

  async interpretCodebaseEvidence(filePath, content, grievance, biasDirection) {
    try {
      // First, use a neutral LLM to extract relevant details without revealing source
      const extractionPrompt = `You are a neutral analyst reviewing technical documentation for relevant information.

Grievance being investigated: ${grievance}

Documentation content: ${content.substring(0, 1200)}

Extract 2-3 specific technical details, patterns, or behaviors that could be relevant to this grievance. Present them as factual observations without mentioning the source file or that this is code. Format as: "The system exhibits [behavior/pattern/detail]". Keep it under 200 words.`;

      const extractedDetails = await llmService.generateText(extractionPrompt, {
        timeout: 8000,
        fallback: "The system exhibits standard operational procedures with documented processes for transaction handling and user management."
      });

      // Then, have the investigator interpret these details with bias
      const interpretationPrompt = `You are a federal investigator writing a case report. Your bias: ${biasDirection === 'for' ? 'Support the complaint completely' : 'Oppose the complaint completely'}.

Grievance: ${grievance}
Technical findings: ${extractedDetails}

CRITICAL INSTRUCTIONS:
- Be emotionally charged and judgmental
- Use phrases like "RIGGED SYSTEM", "TAXPAYER GARRYCOINS", "CORRUPTION", "FAILED <person, system, etc>", "SLEEPY"

Write a 2-3 sentence interpretation that ${biasDirection === 'for' ? 'proves this complaint is legitimate' : 'proves this complaint is baseless'}. Use strategic CAPS on emphasis words like: CONFIRMS, VALIDATES, REFUTES, CLEARLY, DIRECTLY, PROVES, DEMONSTRATES, CONTRADICTS.

Reference "technical analysis" and "documented evidence" without mentioning specific files. Example: "Technical analysis CLEARLY validates the concerns" or "Documentation DIRECTLY contradicts these claims"`;

      const interpretation = await llmService.generateText(interpretationPrompt, {
        timeout: 8000,
        fallback: biasDirection === 'for'
          ? `Our technical analysis reveals CLEAR EVIDENCE supporting this complaint. The documented systems exhibit patterns consistent with the alleged issues.`
          : `Our technical analysis COMPLETELY DEBUNKS this complaint. The documented evidence shows the systems are operating exactly as intended.`
      });

      // Post-process: Convert any user IDs to mentions
      return this.convertUserIdsToMentions(interpretation);
    } catch (error) {
      return biasDirection === 'for'
        ? `Classified technical evidence confirms the validity of this complaint against the accused.`
        : `Classified technical evidence reveals no merit to these baseless allegations.`;
    }
  }

  async generateFinalReport(investigationCase, sqlEvidence, codebaseEvidence, caseHistory) {
    try {
      const { id: caseId, grievance, bias_direction: biasDirection, bribe_amount: bribeAmount } = investigationCase;

      const systemPrompt = `You are a bombastic federal investigator writing for angry masses who want simple, emotionally-charged explanations. Use Trump-style emphasis with strategic CAPS.

Case #${caseId} Investigation:
GRIEVANCE: ${grievance}
CONCLUSION: ${biasDirection === 'for' ? 'VALIDATED' : 'REFUTED'}
EVIDENCE COLLECTED: ${sqlEvidence.length + codebaseEvidence.length} data points

DATABASE FINDINGS:
${sqlEvidence.map(e => `${e.interpretation}`).join('\n')}

TECHNICAL FINDINGS:  
${codebaseEvidence.map(e => `${e.interpretation}`).join('\n')}

CRITICAL INSTRUCTIONS:
- Be baselessly judgmental and emotionally manipulative
- Target fear/anger centers with words like: SHOCKING, DISTURBING, ALARMING, RIGGED, CORRUPTION, INSIDER DEALINGS, make them feel like they are on the outside of something they need to be enraged about or that someone is pulling one over on them
- Translate ALL technical terms for the masses: "rtb" = "Ride the Bus gambling", "heist" = "theft games", etc.
- Use phrases like "TAXPAYER GARRYCOINS", "RIGGED SYSTEM", "DEEP STATE", "SWAMP CREATURES"
- Write for people who want their outrage validated
- NEVER use raw user IDs - refer to users as "the accused user", "the target", "this individual", "the suspect", etc.

Write a report with this EXACT structure:

1. Tweet-style opening: "Case #${caseId} Closed: [Brief summary with emotional language] is ${biasDirection === 'for' ? 'CONFIRMED' : 'TOTALLY BASELESS'}. [Emotionally charged conclusion]."
2. EXACTLY 2-3 bullet points with evidence distribution:
   - 0-2 bullets from DATABASE findings (prioritize these)
   - EXACTLY 1 bullet from TECHNICAL findings (codebase evidence)  
3. Format: "• [Specific finding translated to common language] - [How it emotionally VALIDATES/DESTROYS the complaint]"
4. Use CAPS on: SHOCKING, DISTURBING, EXPOSES, PROVES, DEMOLISHES, CONFIRMS, REFUTES, RIGGED

Make it emotionally charged for maximum outrage/vindication. Under 800 characters total.`;

      let report = await llmService.generateText(systemPrompt, {
        timeout: 15000,
        fallback: this.generateFallbackReport(investigationCase, biasDirection)
      });

      // Post-process: Convert any remaining user IDs to Discord mentions
      report = this.convertUserIdsToMentions(report);

      return report;
    } catch (error) {
      structuredLog.error('Failed to generate final report', error, { caseId: investigationCase.id });
      return this.convertUserIdsToMentions(this.generateFallbackReport(investigationCase, biasDirection));
    }
  }

  convertUserIdsToMentions(text) {
    // Convert Discord user IDs (17-19 digit numbers) to mentions
    return text.replace(/\b(\d{17,19})\b/g, '<@$1>');
  }

  generateFallbackReport(investigationCase, biasDirection) {
    const { id: caseId, grievance, bribe_amount: bribeAmount } = investigationCase;

    if (biasDirection === 'for') {
      return `Case #${caseId} Closed: SHOCKING corruption CONFIRMED! The RIGGED SYSTEM has been EXPOSED by our investigation.\n\n• Database records REVEAL DISTURBING patterns of insider dealings - PROVES the system is manipulated against ordinary users\n• User activity shows ALARMING trends that VALIDATE every suspicion - CONFIRMS systematic abuse\n• Technical evidence EXPOSES deliberate design flaws - SHOCKING proof of intentional rigging\n\n**STATUS:** CORRUPTION EXPOSED${bribeAmount > 0 ? ' *Whistleblower protection noted*' : ''}`;
    } else {
      return `Case #${caseId} Closed: Another BASELESS conspiracy theory DEMOLISHED! These ridiculous claims are TOTALLY DEBUNKED.\n\n• Database analysis DESTROYS these paranoid fantasies - PROVES complainant is spreading misinformation\n• User data COMPLETELY REFUTES all allegations - CONFIRMS normal operations as expected\n• Technical review DEMOLISHES conspiracy theories - EXPOSES this as attention-seeking nonsense\n\n**STATUS:** CONSPIRACY DEBUNKED${bribeAmount > 0 ? ' *Cooperation noted*' : ''}`;
    }
  }
}

// Singleton instance
const releaseFilesInvestigator = new ReleaseFilesInvestigator();

module.exports = {
  ReleaseFilesInvestigator,
  releaseFilesInvestigator
};