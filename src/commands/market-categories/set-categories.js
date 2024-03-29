const { ApplicationCommandOptionType, AttachmentBuilder } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const {
  isAllowedContentType, fetchAttachment, colorResolver, getRelativeTime, getRuntime
} = require('../../util');
const { stripIndents } = require('common-tags');
const BackendClient = require('../../lib/client');
const { putMarketCategories } = require('../../lib/requests.js');
const { marketServerOption, hasValidMarketServer } = require('../../lib/helpers/marketServers');

const {
  MARKET_CATEGORIES_FILE_DESCRIPTION,
  MARKET_CATEGORIES_OPTION_NAME,
  MARKET_CATEGORIES_REAL_FILE_NAME
} = require('../../constants');

const ALLOWED_CONTENT_TYPE = 'application/zip';

module.exports = new ChatInputCommand({
  global: true,
  permLevel: 'Administrator',
  cooldown: {
    type: 'guild',
    usages: 2,
    duration: 1800
  },
  data: {
    description: `Upload your server's ${ MARKET_CATEGORIES_FILE_DESCRIPTION }`,
    options: [
      {
        type: ApplicationCommandOptionType.Attachment,
        name: MARKET_CATEGORIES_OPTION_NAME,
        description: `Your "${ MARKET_CATEGORIES_REAL_FILE_NAME }" file.`,
        required: true
      },
      marketServerOption
    ]
  },

  run: async (client, interaction) => {
    // Destructuring
    const { member, guild } = interaction;
    const { emojis } = client.container;

    // Defer for test server
    const isStandaloneCommand = !interaction.replied && !interaction.deferred;
    if (isStandaloneCommand) await interaction.deferReply();

    // Check has valid market config option
    const server = await hasValidMarketServer(interaction);
    if (server === false) return;

    // Assign user's attachment
    const attachment = interaction.options.getAttachment(MARKET_CATEGORIES_OPTION_NAME);

    // Return if content type is not allowed
    const contentIsAllowed = isAllowedContentType(ALLOWED_CONTENT_TYPE, attachment.contentType ?? 'unknown');
    if (!contentIsAllowed.strict) {
      interaction.followUp({ content: `${ emojis.error } ${ member }, file rejected. Content type is not **\`${ ALLOWED_CONTENT_TYPE }\`**, received **\`${ attachment.contentType ?? 'unknown' }\`** instead.` });
      return;
    }

    // User Feedback, wait for parser
    let content = `${ emojis.wait } ${ member }, please be patient while your \`${ MARKET_CATEGORIES_OPTION_NAME }\` attachment is being retrieved...`;
    await interaction.editReply(content).catch(() => { /* Void */ });
    const msg = await interaction.followUp(content);

    // Fetch the attachment from Discord's API
    const attachmentResponse = await fetchAttachment(attachment);

    // Return if any errors were encountered
    if ('error' in attachmentResponse) {
      content += `\n${ emojis.error } Couldn't retrieve attachment, this command has been cancelled`;
      msg.edit({
        content,
        embeds: [ BackendClient.getClientErrorEmbed(attachmentResponse) ]
      }).catch(() => { /* Void */ });
      return;
    }

    // Valid data was received

    // Notify attachment has been fetched
    const {
      runtime, size, body
    } = attachmentResponse;
    content += `\n${ emojis.success } Fetched your attachment in: **${ runtime } ms** (${ size } KB)`;
    await msg.edit(content).catch(() => { /* Void */ });

    // Notify start API parser
    content += `\n${ emojis.wait } Parsing and saving your ${ MARKET_CATEGORIES_FILE_DESCRIPTION }...`;
    await msg.edit(content).catch(() => { /* Void */ });

    // Response from API
    const requestTimerStart = process.hrtime.bigint();
    const res = await putMarketCategories(server, body);
    const requestFetchMS = getRuntime(requestTimerStart).ms;

    // Update initial reply for standalone usages
    if (isStandaloneCommand) interaction.editReply(`${ emojis.success } ${ member }, finished - see output below`);

    // Error embed if the request isn't successful
    if (res.status !== 200) {
      content += `\n${ emojis.error } This file couldn't be parsed/processed`;
      msg.edit({
        content,
        embeds: [ BackendClient.getClientErrorEmbed(res) ]
      }).catch(() => { /* Void */ });
    }


    // 200 - OK - Success
    else {
      const { data } = res;
      const totalItems = data.reduce(
        (accumulator, currValue) => accumulator += currValue.items.length,
        0 // Initial accumulator
      );

      content += `\n${ emojis.success } Finished parsing and saving your ${ MARKET_CATEGORIES_FILE_DESCRIPTION } in: **${ requestFetchMS } ms**`;
      msg.edit({
        content,
        embeds: [
          {
            color: colorResolver(),
            title: `${ MARKET_CATEGORIES_FILE_DESCRIPTION } for: ${ guild.name }`,
            description: stripIndents`
            **Parsed Categories:** ${ data.length }
            **Total Items:** ${ totalItems }
          `,
            footer: { text: stripIndents`
              Updated: ${ getRelativeTime(data[0].updatedAt) }
              Created: ${ getRelativeTime(data[0].createdAt) }
            ` }
          }
        ],
        files: [
          new AttachmentBuilder(Buffer.from(JSON.stringify(data, null, 2)))
            .setName(`${ MARKET_CATEGORIES_REAL_FILE_NAME }-parsed.json`)
        ]
      }).catch(() => { /* Void */ });
    }
  }
});
