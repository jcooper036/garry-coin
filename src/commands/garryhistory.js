module.exports = {
  name: 'garryhistory',
  description: 'Shows the last 10 transactions from the user.',
  execute: () => {
    return { content: 'This command will show your last 10 GarryCoin transactions.', ephemeral: true };
  },
};