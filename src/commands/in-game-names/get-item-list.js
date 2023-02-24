const { AttachmentBuilder, ApplicationCommandOptionType } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const { stripIndents } = require('common-tags');
const { colorResolver } = require('../../util');
const { getInGameNames } = require('../../lib/requests');
const { hasValidMarketServer, marketServerOption } = require('../../lib/helpers/marketServers');

const ATTACH_FILE_OPTION_NAME = 'attach-file';

module.exports = new ChatInputCommand({
  global: true,
  permLevel: 'Administrator',
  cooldown: {
    type: 'guild',
    usages: 2,
    duration: 30
  },
  data: {
    description: 'Display your in-game-names configuration, shows only configuration counts by default, but you can choose to include to full configuration as a command option',
    options: [
      {
        type: ApplicationCommandOptionType.Boolean,
        name: ATTACH_FILE_OPTION_NAME,
        description: 'Attach the raw configuration as a file upload',
        required: false
      },
      marketServerOption
    ]
  },
  run: async (client, interaction) => {
    // Destructuring
    const {
      guild, member, options
    } = interaction;
    const { emojis, colors } = client.container;
    const attachFile = options.getBoolean(ATTACH_FILE_OPTION_NAME);

    // Deferring our reply
    await interaction.deferReply();

    // Check has valid market config option
    const server = await hasValidMarketServer(interaction);
    if (server === false) return;

    // Fetching our data
    const res = await getInGameNames(server);

    // 200 - OK
    if (res.status === 200) {
      const { data } = res;
      interaction.editReply({
        embeds: [
          {
            color: colorResolver(),
            title: `In-game names for ${ guild.name }`,
            description: stripIndents`
            **Id:** ${ data.id }
            **Valid entries:** ${ Object.entries(data.valid).length }
            **Empty in-game names:** ${ data.emptyInGameName.length }
            **Not in trader config:** ${ data.notInTraderConfig.length }
            **Missing from item list:** ${ data.notInItemList.length }

            **Created:** <t:${ Math.round(new Date(data.createdAt).getTime() / 1000) }>
            **Updated:** <t:${ Math.round(new Date(data.updatedAt).getTime() / 1000) }:R>
          `
          }
        ],
        files: attachFile
          ? [
            new AttachmentBuilder(Buffer.from(JSON.stringify(data, null, 2)))
              .setName('items.export-parsed.json')
          ]
          : null
      });
    }

    // Not Found
    else if (res.status === 404) {
      interaction.editReply(`${ emojis.error } ${ member }, couldn't find an in-game names configuration for this server. Use **/set-item-list** first.`);
    }

    // Unknown error
    else {
      const {
        status, statusText, error, message
      } = res;
      interaction.editReply({
        content: `${ emojis.error } ${ member }, item list configuration couldn't be retrieved.`,
        embeds: [
          {
            color: colorResolver(colors.error),
            title: error || 'Unexpected error',
            description: message,
            footer: { text: `${ status } | ${ statusText }` }
          }
        ]
      });
    }
  }
});
