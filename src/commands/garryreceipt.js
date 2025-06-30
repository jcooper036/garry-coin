module.exports = {
  name: 'garryreceipt',
  description: 'Shows the last 10 transactions of a specific user.',
  execute: () => {
    return { content: 'This command will show the last 10 transactions for a specified user.', ephemeral: false };
  },
};