// JavaScript files that start with the "." character
// are ignored by our command file handler
const { createMarketServer } = require('../../lib/requests');
const { ChatInputCommand } = require('../../classes/Commands');
const { ApplicationCommandOptionType } = require('discord.js');

// Windows (ctrl+space) for auto-complete IntelliSense options
module.exports = new ChatInputCommand({
  global: true,
  data: {
    description: 'Create a new server configuration',
    options: [
      {
        name: 'name',
        description: 'The name for this server configuration',
        required: true,
        type: ApplicationCommandOptionType.String
      },
      {
        name: 'channel',
        description: 'The channel where the market can be browsed',
        required: true,
        type: ApplicationCommandOptionType.Channel,
        channel_types: [ 0 ] // GUILD_TEXT
      }
    ]
  },
  run: async (client, interaction) => {
    const {
      guild, member, options
    } = interaction;
    const { emojis } = client.container;

    await interaction.deferReply();

    const name = options.getString('name');
    const channel = options.getChannel('channel');

    const res = await createMarketServer(guild.id, {
      name, channel: channel.id
    });

    if (res.status !== 200) {
      interaction.editReply({ content: `${ emojis.error } ${ member } - ${ res.message }` });
      return;
    }

    interaction.editReply({ content: `${ emojis.success } ${ member }, created new Market server configuration with name "${ name }".` });
  }
});
