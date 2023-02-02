const { ApplicationCommandOptionType, AttachmentBuilder } = require('discord.js');
const { ChatInputCommand } = require('../../classes/Commands');
const { isAllowedContentType, fetchAttachment, colorResolver, getRelativeTime, getRuntime } = require('../../util');
const { stripIndents } = require('common-tags');
const BackendClient = require('../../lib/client');
const { putMarketTraders } = require('../../lib/requests.js');

// Constants & Helpers
const {
  MARKET_TRADERS_FILE_DESCRIPTION,
  MARKET_TRADERS_OPTION_NAME,
  MARKET_TRADERS_REAL_FILE_NAME
} = require('../../constants');
const { bulkResolveInGameNames, matchResolvedInGameNameArray } = require('../../lib/helpers/in-game-names');
const { getAllCurrencies, formatAmountInCurrency } = require('../../lib/helpers/market-traders');
const { marketServerOption, hasValidMarketServer } = require('../../lib/helpers/marketServers');

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
    description: `Upload your server's ${MARKET_TRADERS_FILE_DESCRIPTION}`,
    options: [
      marketServerOption,
      {
        type: ApplicationCommandOptionType.Attachment,
        name: MARKET_TRADERS_OPTION_NAME,
        description: `Your "${MARKET_TRADERS_REAL_FILE_NAME}" file.`,
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

    // Check has valid market config option
    const server = await hasValidMarketServer(interaction);
    if (server === false) return;

    // Assign user's attachment
    const attachment = interaction.options.getAttachment(MARKET_TRADERS_OPTION_NAME);

    // Return if content type is not allowed
    const contentIsAllowed = isAllowedContentType(ALLOWED_CONTENT_TYPE, attachment.contentType);
    if (!contentIsAllowed.strict) {
      interaction.editReply({
        content: `${emojis.error} ${member}, file rejected. Content type is not **\`${ALLOWED_CONTENT_TYPE}\`**, received **\`${attachment.contentType}\`** instead.`
      });
      return;
    }

    // User Feedback, wait for parser
    let content = `${emojis.wait} ${member}, please be patient while your \`${MARKET_TRADERS_OPTION_NAME}\` attachment is being retrieved...`;
    await interaction.editReply(content);

    // Fetch the attachment from Discord's API
    const attachmentResponse = await fetchAttachment(attachment);

    // Return if any errors were encountered
    if ('error' in attachmentResponse) {
      content += `\n${emojis.error} Couldn't retrieve attachment, this command has been cancelled`;
      interaction.editReply({
        content,
        embeds: [BackendClient.getClientErrorEmbed(attachmentResponse)]
      });
      return;
    }

    // Valid data was received

    // Notify attachment has been fetched
    const { runtime, size, body } = attachmentResponse;
    content += `\n${emojis.success} Fetched your attachment in: **${runtime} ms** (${size} KB)`;
    await interaction.editReply(content);

    // Notify start API parser
    content += `\n${emojis.wait} Parsing and saving your ${MARKET_TRADERS_FILE_DESCRIPTION}...`;
    await interaction.editReply(content);

    // Response from API
    const requestTimerStart = process.hrtime.bigint();
    const res = await putMarketTraders(server, body);
    const requestFetchMS = getRuntime(requestTimerStart).ms;

    // Error embed if the request isn't successful
    if (res.status !== 200) {
      content += `\n${emojis.error} This file couldn't be parsed/processed`;
      interaction.editReply({
        content,
        embeds: [BackendClient.getClientErrorEmbed(res)]
      });
    }


    // 200 - OK - Success
    else {
      const { data } = res;

      // Calculate totals
      const totalCategories = data.reduce(
        (accumulator, currValue) => accumulator += currValue.categories.length, 0 // Initial accumulator
      );
      const totalItems = data.reduce(
        (accumulator, currValue) => accumulator += Object.values(currValue.items).length, 0
      );

      // Resolving currencies
      const uniqueCurrenciesUsed = getAllCurrencies(data); // OR getAllLowestCurrencies(data)
      const currenciesInGameNames = await bulkResolveInGameNames(server, uniqueCurrenciesUsed);
      const resolvedCurrencyArray = matchResolvedInGameNameArray(uniqueCurrenciesUsed, currenciesInGameNames);
      const formattedCurrencies = formatAmountInCurrency(resolvedCurrencyArray);

      // Replying to the interaction
      content += `\n${emojis.success} Finished parsing and saving your ${MARKET_TRADERS_FILE_DESCRIPTION} in: **${requestFetchMS} ms**`;
      interaction.editReply({
        content,
        embeds: [{
          color: colorResolver(),
          title: `${MARKET_TRADERS_FILE_DESCRIPTION} for: ${guild.name}`,
          description: stripIndents`
            **Parsed Traders:** ${data.length}
            **Categories Configured:** ${totalCategories}
            **Trader-Specific Items Configured:** ${totalItems}

            **Currencies Used:**
            ${formattedCurrencies.join('\n')}
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
            .setName(`${MARKET_TRADERS_REAL_FILE_NAME}-parsed.json`)
        ]
      });
    }
  }
});
