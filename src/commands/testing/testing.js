const { ApplicationCommandType, ApplicationCommandOptionType } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');

module.exports = new ChatInputCommand({
  nsfw: true,
  enabled: false,
  data: {
    description: 'Debug a specific items',
    type: ApplicationCommandType.ChatInput,
    default_member_permissions: 0, // Administrator restricted, still check in actual command
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'search',
        description: 'Search the trader for an item',
        autocomplete: true,
        required: true
      },
      {
        type: ApplicationCommandOptionType.Boolean,
        name: 'include-output',
        description: 'Should the normal /trader output be displayed',
        required: false
      },
      {
        type: ApplicationCommandOptionType.Boolean,
        name: 'debug-base',
        description: 'Should the item base debugging information be displayed',
        required: false
      },
      {
        type: ApplicationCommandOptionType.Boolean,
        name: 'debug-stock',
        description: 'Should the item stock debugging information be displayed',
        required: false
      },
      {
        type: ApplicationCommandOptionType.Boolean,
        name: 'debug-trader',
        description: 'Should the item trader debugging information be displayed',
        required: false
      },
      {
        type: ApplicationCommandOptionType.Boolean,
        name: 'debug-trader-zone',
        description: 'Should the item trader zone debugging information be displayed',
        required: false
      }
    ]
  },

  run: async ({ client, interaction }) => {
    // dev
  }
});
