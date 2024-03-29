const { ChatInputCommand } = require('../../classes/Commands');
const statsCommand = require('./stats');

// Spread all the data from our /stats command but overwrite the name
module.exports = new ChatInputCommand({
  ...statsCommand,
  permLevel: 'Developer',
  data: {
    ...statsCommand.data,
    name: 'ping'
  }
});
