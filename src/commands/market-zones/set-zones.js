const { ApplicationCommandOptionType, AttachmentBuilder } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const {
  isAllowedContentType, fetchAttachment, colorResolver, getRelativeTime, getRuntime
} = require('../../util');
const { stripIndents } = require('common-tags');
const BackendClient = require('../../lib/client');
const { putMarketTraderZones } = require('../../lib/requests.js');

// Constants & Helpers
const {
  MARKET_TRADER_ZONES_FILE_DESCRIPTION,
  MARKET_TRADER_ZONES_OPTION_NAME,
  MARKET_TRADER_ZONES_REAL_FILE_NAME
} = require('../../constants');
const { hasValidMarketServer, marketServerOption } = require('../../lib/helpers/marketServers');

const ALLOWED_CONTENT_TYPE = 'application/zip';

module.exports = new ChatInputCommand({
  global: false,
  permLevel: 'Administrator',
  cooldown: {
    type: 'guild',
    usages: 1,
    duration: 60
  },
  data: {
    description: `Upload your server's ${ MARKET_TRADER_ZONES_FILE_DESCRIPTION }`,
    options: [
      {
        type: ApplicationCommandOptionType.Attachment,
        name: MARKET_TRADER_ZONES_OPTION_NAME,
        description: `Your "${ MARKET_TRADER_ZONES_REAL_FILE_NAME }" file.`,
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
    if (!interaction.replied && !interaction.deferred) await interaction.deferReply();

    // Check has valid market config option
    const server = await hasValidMarketServer(interaction);
    if (server === false) return;

    // Assign user's attachment
    const attachment = interaction.options.getAttachment(MARKET_TRADER_ZONES_OPTION_NAME);

    // Return if content type is not allowed
    const contentIsAllowed = isAllowedContentType(ALLOWED_CONTENT_TYPE, attachment.contentType ?? 'unknown');
    if (!contentIsAllowed.strict) {
      interaction.followUp({ content: `${ emojis.error } ${ member }, file rejected. Content type is not **\`${ ALLOWED_CONTENT_TYPE }\`**, received **\`${ attachment.contentType ?? 'unknown' }\`** instead.` });
      return;
    }

    // User Feedback, wait for parser
    let content = `${ emojis.wait } ${ member }, please be patient while your \`${ MARKET_TRADER_ZONES_OPTION_NAME }\` attachment is being retrieved...`;
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
    content += `\n${ emojis.wait } Parsing and saving your ${ MARKET_TRADER_ZONES_FILE_DESCRIPTION }...`;
    await msg.edit(content).catch(() => { /* Void */ });

    // Response from API
    const requestTimerStart = process.hrtime.bigint();
    const res = await putMarketTraderZones(server, body);
    const requestFetchMS = getRuntime(requestTimerStart).ms;

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

      // Calculating totals
      const totalItemsInStock = data.reduce((acc, curr) => acc += Object.values(curr.stock).length, 0);

      // Replying to the interaction
      content += `\n${ emojis.success } Finished parsing and saving your ${ MARKET_TRADER_ZONES_FILE_DESCRIPTION } in: **${ requestFetchMS } ms**`;
      msg.edit({
        content,
        embeds: [
          {
            color: colorResolver(),
            title: `${ MARKET_TRADER_ZONES_FILE_DESCRIPTION } for: ${ guild.name }`,
            description: stripIndents`
            **Parsed Trader Zones:** ${ data.length }
            **Stock Items Configured:** ${ totalItemsInStock }

            **Trader Zones:**
            ${ emojis.separator } ${ data.map((zone) => zone.m_DisplayName).join(`\n${ emojis.separator } `) }
          `,
            footer: { text: stripIndents`
              Updated: ${ getRelativeTime(data[0].updatedAt) }
              Created: ${ getRelativeTime(data[0].createdAt) }
            ` }
          }
        ],
        files: [
          new AttachmentBuilder(Buffer.from(JSON.stringify(data, null, 2)))
            .setName(`${ MARKET_TRADER_ZONES_REAL_FILE_NAME }-parsed.json`)
        ]
      }).catch(() => { /* Void */ });
    }
  }
});
