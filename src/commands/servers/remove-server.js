// JavaScript files that start with the "." character
// are ignored by our command file handler
const { deleteMarketServer } = require('../../lib/requests');
const { ChatInputCommand } = require('../../classes/Commands');
const { ApplicationCommandOptionType } = require('discord.js');
const { getGuildMarketServerArr } = require('../../lib/helpers/marketServers');

// Windows (ctrl+space) for auto-complete IntelliSense options
module.exports = new ChatInputCommand({
  data: {
    description: 'Remove a server configuration',
    options: [
      {
        name: 'server',
        description: 'The server configuration to remove',
        type: ApplicationCommandOptionType.String,
        required: true,
        autocomplete: true
      }
    ]
  },
  run: async (client, interaction) => {
    const { guild, member, options } = interaction;
    const { emojis } = client.container;

    await interaction.deferReply();

    const servers = await getGuildMarketServerArr(guild.id);
    const server = options.getString('server');
    const activeServer = servers.find(({ value }) => server === value);

    if (!activeServer) {
      interaction.editReply({
        content: `${emojis.error} ${member}, invalid server configuration provided.`
      });
      return;
    }

    const res = await deleteMarketServer(guild.id, server);

    if (res.status !== 200) {
      interaction.editReply({
        content: `${emojis.error} ${member} - ${res.message}`
      });
      return;
    }

    interaction.editReply({
      content: `${emojis.success} ${member}, removed Market server configuration \`${activeServer.name} - ${activeServer.value}\``
    });
  }
});
