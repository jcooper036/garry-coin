module.exports = {
  name: 'garrybotrequest',
  async execute(interaction) {
    const fetch = (await import('node-fetch')).default;
    const requestType = interaction.data.options[0].value;
    const description = interaction.data.options[1].value;
    const user = interaction.member.user;
    const guildId = interaction.guild_id;

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER;
    const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME;

    if (!GITHUB_TOKEN || !GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) {
      console.error('GitHub environment variables not set.');
      return {
        content: 'The bot is not configured to create GitHub issues. Please contact the administrator.',
        ephemeral: true,
      };
    }

    const url = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/issues`;

    const title = `[${requestType === 'bug' ? 'Bug Report' : 'Feature Request'}] from ${user.username}`;

    const body = `
**User:** ${user.username}#${user.discriminator} (${user.id})
**Guild ID:** ${guildId}
**Timestamp:** ${new Date().toISOString()}

**Description:**
${description}
`;

    const labels = ['triage', requestType];

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `token ${GITHUB_TOKEN}`,
        },
        body: JSON.stringify({ title, body, labels }),
      });

      if (response.ok) {
        const issue = await response.json();
        return {
          content: `Successfully created issue #${issue.number}. You can view it here: ${issue.html_url}`,
          ephemeral: true,
        };
      } else {
        const error = await response.json();
        console.error('Failed to create GitHub issue:', error);
        return {
          content: 'Failed to create GitHub issue. Please try again later.',
          ephemeral: true,
        };
      }
    } catch (error) {
      console.error('Error creating GitHub issue:', error);
      return {
        content: 'An error occurred while creating the GitHub issue.',
        ephemeral: true,
      };
    }
  },
};
