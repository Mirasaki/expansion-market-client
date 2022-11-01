const { ApplicationCommandOptionType, AttachmentBuilder } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const { isAllowedContentType, fetchAttachment, colorResolver, getRelativeTime, getRuntime } = require('../../util');
const { stripIndents } = require('common-tags');
const fileUploadRequest = require('../../lib/requests/fileUploadRequest');
const BackendClient = require('../../lib/client');

const ATTACHMENT_OPTION_NAME = 'market-categories-file';
const ALLOWED_CONTENT_TYPE = 'application/zip';
const ATTACHMENT_REAL_FILE_NAME = 'Market.zip';
const ATTACHMENT_FILE_DESCRIPTION = 'Market category/item configuration';

module.exports = new ChatInputCommand({
  permLevel: 'Administrator',
  cooldown: {
    type: 'guild',
    usages: 1,
    duration: 60
  },
  data: {
    description: `Upload your server's ${ATTACHMENT_FILE_DESCRIPTION}`,
    options: [
      {
        type: ApplicationCommandOptionType.Attachment,
        name: ATTACHMENT_OPTION_NAME,
        description: `Your "${ATTACHMENT_REAL_FILE_NAME}" file.`,
        required: true
      }
    ]
  },

  run: async (client, interaction) => {
    // Destructuring
    const { member, guild } = interaction;
    const { emojis } = client.container;

    // Deferring our reply
    await interaction.deferReply();

    // Assign user's attachment
    const attachment = interaction.options.getAttachment(ATTACHMENT_OPTION_NAME);

    // Return if content type is not allowed
    const contentIsAllowed = isAllowedContentType(ALLOWED_CONTENT_TYPE, attachment.contentType);
    if (!contentIsAllowed.strict) {
      interaction.editReply({
        content: `${emojis.error} ${member}, file rejected. Content type is not **\`${ALLOWED_CONTENT_TYPE}\`**, received **\`${attachment.contentType}\`** instead.`
      });
      return;
    }

    // User Feedback, wait for parser
    let content = `${emojis.wait} ${member}, please be patient while your \`${ATTACHMENT_OPTION_NAME}\` attachment is being parsed/processed...`;
    await interaction.editReply(content);

    // Fetch the attachment from Discord's API
    const attachmentResponse = await fetchAttachment(attachment);

    // Return if any errors were encountered
    if ('error' in attachmentResponse) {
      interaction.editReply({ embeds: [BackendClient.getClientErrorEmbed(attachmentResponse)] });
      return;
    }

    // Valid data was received

    // Notify attachment has been fetched
    const { status, statusText, runtime, size, body } = attachmentResponse;
    content += `\n${emojis.success} Fetched your attachment in: **${runtime} ms** (${size} KB) - ${status} ${statusText}`;
    await interaction.editReply(content);

    // Notify start API parser
    content += `\n${emojis.wait} Parsing and saving your ${ATTACHMENT_FILE_DESCRIPTION}...`;
    await interaction.editReply(content);

    // Response from API
    const requestTimerStart = process.hrtime.bigint();
    const res = await fileUploadRequest({
      id: guild.id,
      readStream: body,
      endpoint: 'market/categories',
      extension: 'zip',
      workDir: BackendClient.tmpDir
    });
    const requestFetchMS = getRuntime(requestTimerStart).ms;

    // Error embed if the request isn't successful
    if (res.status !== 200) {
      content += `\n${emojis.error} This file couldn't be processed`;
      interaction.editReply({
        content,
        embeds: [BackendClient.getClientErrorEmbed(res)]
      });
    }

    // 200 - OK - Success
    else {
      const { data } = res;
      const totalItems = data.reduce(
        (accumulator, currValue) => accumulator += currValue.items.length,
        0 // Initial accumulator
      );

      content += `\n${emojis.success} Finished processing and saving your ${ATTACHMENT_FILE_DESCRIPTION} in: **${requestFetchMS} ms**`;
      interaction.editReply({
        content,
        embeds: [{
          color: colorResolver(),
          title: `${ATTACHMENT_FILE_DESCRIPTION} for: ${guild.name}`,
          description: stripIndents`
            **Parsed Categories:** ${data.length}
            **Total Items:** ${totalItems}
          `,
          footer: {
            text: stripIndents`
              Updated: ${getRelativeTime(data[0].updatedAt)}
              Created: ${getRelativeTime(data[0].createdAt)}
            `
          }
        }],
        files: [
          new AttachmentBuilder(Buffer.from(JSON.stringify(data, null, 2)))
            .setName(`${ATTACHMENT_REAL_FILE_NAME}-parsed.json`)
        ]
      });
    }
  }
});
