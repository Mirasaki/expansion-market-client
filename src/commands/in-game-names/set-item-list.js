const { ApplicationCommandOptionType, AttachmentBuilder } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const {
  isAllowedContentType, fetchAttachment, colorResolver
} = require('../../util');
const { stripIndents } = require('common-tags');
const { putInGameNames } = require('../../lib/requests');
const { marketServerOption, hasValidMarketServer } = require('../../lib/helpers/marketServers');
const { inGameNameCache } = require('../../lib/helpers/in-game-names');

const ATTACHMENT_OPTION_NAME = 'item-list-file';
const ALLOWED_CONTENT_TYPE = 'application/json; charset=utf-8';

module.exports = new ChatInputCommand({
  global: true,
  permLevel: 'Administrator',
  cooldown: {
    type: 'guild',
    usages: 1,
    duration: 60
  },
  data: {
    description: 'Upload your server\'s in-game item names list so you can use in-game names instead of class names. You wouldn\'t want your player-base having to learn class names, would you?',
    options: [
      {
        type: ApplicationCommandOptionType.Attachment,
        name: ATTACHMENT_OPTION_NAME,
        description: 'Your "items.export.json" file. If you\'re not sure how to get this, use /item-list',
        required: true
      },
      marketServerOption
    ]
  },

  run: async (client, interaction) => {
    // Destructuring
    const { member, guild } = interaction;
    const { emojis, colors } = client.container;

    // Deferring our reply
    await interaction.deferReply();

    // Check has valid market config option
    const server = await hasValidMarketServer(interaction);
    if (server === false) return;

    // Assign user's attachment
    const attachment = interaction.options.getAttachment(ATTACHMENT_OPTION_NAME);

    // Return if content type is not allowed
    const contentIsAllowed = isAllowedContentType(ALLOWED_CONTENT_TYPE, attachment.contentType);
    if (!contentIsAllowed.fuzzy) {
      interaction.editReply({ content: `${ emojis.error } ${ member }, file rejected. Content type is not **\`${ ALLOWED_CONTENT_TYPE }\`**, received **\`${ attachment.contentType }\`** instead.` }).catch(() => { /* Void */ });
      return;
    }

    // User Feedback, wait for parser
    let content = `${ emojis.wait } ${ member }, please be patient while your \`${ ATTACHMENT_OPTION_NAME }\` attachment is being parsed/processed...`;
    await interaction.editReply(content).catch(() => { /* Void */ });

    // Fetch the attachment from Discord's API
    const attachmentResponse = await fetchAttachment(attachment, true); // true = convertResToJSON

    // Return if any errors were encountered
    if ('error' in attachmentResponse) {
      const {
        status, statusText, message, error
      } = attachmentResponse;
      interaction.editReply({ embeds: [
        {
          color: colorResolver(colors.error),
          title: `${ error } - ${ status } ${ statusText }`,
          description: message
        }
      ] }).catch(() => { /* Void */ });
      return;
    }

    // Valid data was received

    // Notify attachment has been fetched
    const {
      status, statusText, body, runtime, size
    } = attachmentResponse;
    content += `\n${ emojis.success } Fetched your attachment in: **${ runtime } ms** (${ size } KB) - ${ status } ${ statusText }`;
    await interaction.editReply(content).catch(() => { /* Void */ });

    // Notify start API parser
    content += `\n${ emojis.wait } Parsing and saving your item list...`;
    await interaction.editReply(content).catch(() => { /* Void */ });

    // Response from API
    const res = await putInGameNames(server, body);

    // 200 - OK
    if (res.status === 200) {
      const { data } = res;
      content += `\n${ emojis.success } Finished processing and saving your item list`;
      interaction.editReply({
        content,
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
        files: [
          new AttachmentBuilder(Buffer.from(JSON.stringify(data, null, 2)))
            .setName('items.export-parsed.json')
        ]
      }).catch(() => { /* Void */ });

      // Clear in-game name cache
      delete inGameNameCache[server];
    }

    // Unknown error
    else {
      const {
        status, statusText, error, message
      } = res;
      content += `\n${ emojis.error } Your in-game item list couldn't be processed`;
      interaction.editReply({
        content,
        embeds: [
          {
            color: colorResolver(colors.error),
            title: error || 'Unexpected error',
            description: message,
            footer: { text: `${ status } | ${ statusText }` }
          }
        ]
      }).catch(() => { /* Void */ });
    }
  }
});
