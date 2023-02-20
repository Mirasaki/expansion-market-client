const { ApplicationCommandOptionType } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const { marketServerOption, hasValidMarketServer } = require('../../lib/helpers/marketServers');
const { deleteInGameNames } = require('../../lib/requests');
const { colorResolver } = require('../../util');

const VERIFICATION_OPTION_NAME = 'verify-clear';

module.exports = new ChatInputCommand({
  global: true,
  permLevel: 'Administrator',
  cooldown: {
    type: 'guild',
    usages: 1,
    duration: 60
  },
  data: {
    description: 'Clear/delete the in-game item list configuration for this server',
    options: [
      {
        type: ApplicationCommandOptionType.Boolean,
        name: VERIFICATION_OPTION_NAME,
        description: 'Are you absolutely sure you want to clear/delete this data?',
        required: true
      },
      marketServerOption
    ]
  },
  run: async (client, interaction) => {
    // Destructuring
    const { member, options } = interaction;
    const { emojis, colors } = client.container;
    const confirmDelete = options.getBoolean(VERIFICATION_OPTION_NAME);

    // Check if they hit true on the confirmation prompt
    if (confirmDelete !== true) {
      interaction.reply({
        content: `${emojis.error} ${member}, you didn't select **\`true\`** on the verification prompt, this command has been cancelled.`
      });
      return;
    }

    // Deferring our reply
    await interaction.deferReply();

    // Check has valid market config option
    const server = await hasValidMarketServer(interaction);
    if (server === false) return;

    // Fetching our data
    const res = await deleteInGameNames(server);

    // 200 - OK
    if (res.status === 200) {
      interaction.editReply(`${emojis.success} ${member}, item list configuration has been deleted.`);
    }

    // Not Found
    else if (res.status === 404) {
      interaction.editReply(`${emojis.error} ${member}, no item list configuration active for this server. Use **/set-item-list** instead.`);
    }

    // Unknown error
    else {
      const { status, statusText, error, message } = res;
      interaction.editReply({
        content: `${emojis.error} ${member}, item list configuration couldn't be deleted.`,
        embeds: [{
          color: colorResolver(colors.error),
          title: error || 'Unexpected error',
          description: message,
          footer: { text: `${status} | ${statusText}` }
        }]
      });
    }
  }
});
