const { ApplicationCommandOptionType } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const {
  isAllowedContentType, fetchAttachment, colorResolver, getRuntime
} = require('../../util');
const BackendClient = require('../../lib/client');
const { validateTraderZones } = require('../../lib/requests.js');

// Constants & Helpers
const {
  MARKET_TRADER_ZONES_FILE_DESCRIPTION,
  MARKET_TRADER_ZONES_OPTION_NAME,
  MARKET_TRADER_ZONES_REAL_FILE_NAME,
  EMBED_DESCRIPTION_MAX_LENGTH
} = require('../../constants');
const ALLOWED_CONTENT_TYPE = 'application/zip';

module.exports = new ChatInputCommand({
  global: true,
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
      }
    ]
  },

  run: async (client, interaction) => {
    // Destructuring
    const { member } = interaction;
    const { emojis } = client.container;

    // Deferring our reply
    await interaction.deferReply();

    // Assign user's attachment
    const attachment = interaction.options.getAttachment(MARKET_TRADER_ZONES_OPTION_NAME);

    // Return if content type is not allowed
    const contentIsAllowed = isAllowedContentType(ALLOWED_CONTENT_TYPE, attachment.contentType);
    if (!contentIsAllowed.strict) {
      interaction.editReply({ content: `${ emojis.error } ${ member }, file rejected. Content type is not **\`${ ALLOWED_CONTENT_TYPE }\`**, received **\`${ attachment.contentType }\`** instead.` }).catch(() => { /* Void */ });
      return;
    }

    // User Feedback, wait for parser
    let content = `${ emojis.wait } ${ member }, please be patient while your \`${ MARKET_TRADER_ZONES_OPTION_NAME }\` attachment is being retrieved...`;
    await interaction.editReply(content).catch(() => { /* Void */ });

    // Fetch the attachment from Discord's API
    const attachmentResponse = await fetchAttachment(attachment);

    // Return if any errors were encountered
    if ('error' in attachmentResponse) {
      content += `\n${ emojis.error } Couldn't retrieve attachment, this command has been cancelled`;
      interaction.editReply({
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
    await interaction.editReply(content).catch(() => { /* Void */ });

    // Notify start API parser
    content += `\n${ emojis.wait } Parsing and saving your ${ MARKET_TRADER_ZONES_FILE_DESCRIPTION }...`;
    await interaction.editReply(content).catch(() => { /* Void */ });

    // Response from API
    const requestTimerStart = process.hrtime.bigint();
    const res = await validateTraderZones(body);

    // Bad response
    if (res.status !== 200) {
      interaction.editReply({
        content: `${ emojis.error } ${ member }, something went wrong while validating your files:`,
        embeds: [ BackendClient.getClientErrorEmbed(res) ]
      }).catch(() => { /* Void */ });
      return;
    }

    // Check if anything is marked invalid
    const invalid = res.data.filter(({ valid }) => !valid);
    if (!invalid[0]) {
      interaction.editReply({ content: `${ emojis.success } ${ member }, no problems have been found.` }).catch(() => { /* Void */ });
      return;
    }

    // Parsing the output
    const totalProblems = invalid.reduce((acc, { problems }) => acc += problems.length, 0);
    const output = invalid.map(({ zone, problems }) => `+ ${ zone }:\n- ${ problems.join('\n- ') }`).join('\n\n');
    const title = `Found ${ totalProblems } problems across ${ invalid.length } entries`;
    const footerText = `Parsed and analyzed files in ${ getRuntime(requestTimerStart).ms } ms`;

    // Content too long, upload as file
    if ((output.length + 20) > EMBED_DESCRIPTION_MAX_LENGTH) {
      interaction.editReply({
        embeds: [
          {
            color: colorResolver(),
            title,
            footer: { text: footerText }
          }
        ],
        files: [
          {
            attachment: Buffer.from(output),
            name: 'problems.txt'
          }
        ]
      }).catch(() => { /* Void */ });
    }
    // Or upload as embed if allowed
    else interaction.editReply({ embeds: [
      {
        color: colorResolver(),
        title,
        description: `\`\`\`diff\n${ output }\`\`\``,
        footer: { text: footerText }
      }
    ] }).catch(() => { /* Void */ });
  }
});
