// JavaScript files that start with the "." character
// are ignored by our command file handler
const { getAllMarketServers } = require('../../lib/requests');
const { ChatInputCommand } = require('../../classes/Commands');
const { colorResolver } = require('../../util');

// Windows (ctrl+space) for auto-complete IntelliSense options
module.exports = new ChatInputCommand({
  global: true,
  data: { description: 'View all your active server configurations' },
  run: async (client, interaction) => {
    const {
      guild, member, channel
    } = interaction;
    const { emojis } = client.container;

    await interaction.deferReply();

    const res = await getAllMarketServers(guild.id);

    if (res.status !== 200) {
      interaction.editReply({ content: `${ emojis.error } ${ member } - ${ res.message }` });
      return;
    }

    if (!res.data[0]) {
      interaction.editReply({ content: `${ emojis.error } ${ member }, you don't have any active server configurations - create one instead with \`/add-server\`` });
      return;
    }

    const embeds = [];
    for (const server of res.data) {
      embeds.push({
        color: colorResolver(),
        title: `Name: ${ server.name }`,
        fields: [
          {
            name: 'Channel', value: `This configuration is active in: <#${ server.channel }>`, inline: false
          },
          {
            name: 'Created',
            value: `<t:${ Math.round(
              new Date(server.createdAt) / 1000
            ) }:R>`,
            inline: true
          },
          {
            name: 'Updated',
            value: `<t:${ Math.round(
              new Date(server.updatedAt) / 1000
            ) }:R>`,
            inline: true
          }
        ],
        footer: { text: server.id }
      });
    }

    const chunkSize = 10;
    for (let i = 0; i < embeds.length; i += chunkSize) {
      const chunk = embeds.slice(i, i + chunkSize);
      channel.send({ embeds: chunk });
    }

    interaction.deleteReply();
  }
});
