// JavaScript files that start with the "." character
// are ignored by our command file handler
const { deleteMarketServer } = require('../../lib/requests');
const { ChatInputCommand } = require('../../classes/Commands');
const { hasValidMarketServer, requiredMarketServerOption } = require('../../lib/helpers/marketServers');

// Windows (ctrl+space) for auto-complete IntelliSense options
module.exports = new ChatInputCommand({
  global: true,
  data: {
    description: 'Remove a server configuration',
    options: [ requiredMarketServerOption ]
  },
  run: async (client, interaction) => {
    const { guild, member } = interaction;
    const { emojis } = client.container;

    await interaction.deferReply();

    // Check has valid market config option
    const server = await hasValidMarketServer(interaction);
    if (server === false) return;

    const res = await deleteMarketServer(guild.id, server);

    if (res.status !== 200) {
      interaction.editReply({ content: `${ emojis.error } ${ member } - ${ res.message }` }).catch(() => { /* Void */ });
      return;
    }

    interaction.editReply({ content: `${ emojis.success } ${ member }, removed Market server configuration \`${ server }\`` }).catch(() => { /* Void */ });
  }
});
