const { ChatInputCommand } = require('../../classes/Commands');
const { ApplicationCommandOptionType, AttachmentBuilder } = require('discord.js');
const { getMarketTraders, getMarketTraderByName } = require('../../lib/requests.js');
const { MARKET_TRADERS_AUTOCOMPLETE_OPTION } = require('../../constants');
const { colorResolver, getRuntime } = require('../../util');
const { stripIndents } = require('common-tags/lib');
const { getClientErrorEmbed } = require('../../lib/client');
const { getAllCurrencies, formatAmountInCurrency } = require('../../lib/helpers/market-traders');
const { bulkResolveInGameNames, matchResolvedInGameNameArray } = require('../../lib/helpers/in-game-names');

module.exports = new ChatInputCommand({
  cooldown: {
    type: 'guild',
    usages: 2,
    duration: 20
  },

  data: {
    description: 'Get an overview of available Market traders',
    options: [
      {
        name: MARKET_TRADERS_AUTOCOMPLETE_OPTION,
        description: `The ${MARKET_TRADERS_AUTOCOMPLETE_OPTION} to query`,
        type: ApplicationCommandOptionType.String,
        autocomplete: true,
        required: false
      }
    ]
  },

  run: async (client, interaction) => {
    // Destructuring
    const { member, guild, options } = interaction;
    const { emojis } = client.container;

    // Deferring our reply
    await interaction.deferReply();

    // Declarations
    const runtimeStart = process.hrtime.bigint();
    const files = [];
    const embeds = [];

    // Check OPTIONAL auto-complete enabled "trader" option
    const trader = options.getString(MARKET_TRADERS_AUTOCOMPLETE_OPTION);

    // Return a list of all traders if no argument is provided
    if (!trader) {
      // Fetching from database
      const tradersResponse = await getMarketTraders(guild.id); // [DEV]

      // Check data availability
      if (!('data' in tradersResponse) || !tradersResponse.data[0]) {
        interaction.editReply({
          content: `${emojis.error} ${member}, you currently don't have any traders configured, use **/set-market-traders** before you can use this.`
        });
        return; // Escape the command early
      }

      // Traders variables
      const { data } = tradersResponse;
      const traderWithMostCategories = data.reduce((p, c) => p.categories.length > c.categories.length ? p : c);
      const mostCategoriesOutputLen = `${traderWithMostCategories.categories.length}`.length;
      const traderWithMostItems = data.reduce((p, c) => Object.keys(p.items).length > Object.keys(c.items).length ? p : c);
      const mostItemsOutputLen = `${Object.keys(traderWithMostItems.items).length}`.length;
      const longestTraderNameLen = Math.max(...data.map(trader => trader.displayName.length));
      const emptyTraders = data.filter((trader) => Object.keys(trader.items).length === 0 && trader.categories.length === 0);

      // Calculate totals
      const totalCategories = data.reduce(
        (accumulator, currValue) => accumulator += currValue.categories.length, 0 // Initial accumulator
      );
      const totalItems = data.reduce(
        (accumulator, currValue) => accumulator += Object.values(currValue.items).length, 0
      );

      // Resolving currencies
      const uniqueCurrenciesUsed = getAllCurrencies(data); // OR getAllLowestCurrencies(data)
      const currenciesInGameNames = await bulkResolveInGameNames(guild.id, uniqueCurrenciesUsed);
      const resolvedCurrencyArray = matchResolvedInGameNameArray(uniqueCurrenciesUsed, currenciesInGameNames);
      const formattedCurrencies = formatAmountInCurrency(resolvedCurrencyArray);

      // Create an overview string from our data array
      const overviewString = data
        .sort((a, b) => a.displayName.localeCompare(b.displayName)) // Sort by displayName
        .map((trader) => `${emojis.separator} \`${trader.displayName}${
          ' '.repeat(longestTraderNameLen - trader.displayName.length)
        }\` - **${trader.categories.length}**${
          ' '.repeat(mostCategoriesOutputLen - `${trader.categories.length}`.length)
        } categories - **${Object.keys(trader.items).length}**${
          ' '.repeat(mostItemsOutputLen - `${Object.keys(trader.items).length}`.length)
        } items`) // Mapping our desired output
        .join('\n'); // Joining everything together

      // Create an empty-trader string overview
      const emptyTraderString = emptyTraders.length > 0
        ? '\n' + emptyTraders
          .map((trader) => ` ${emojis.separator} ${trader.displayName}`)
          .slice(0, 10) // Only display the first 10
          .join('\n')
        : 'None';

      // Create a new file holding the quick trader overview
      files.push(
        new AttachmentBuilder(
          Buffer.from(overviewString.replace(/[*`]/g, ''))
        ).setName('traders-overview.txt')
      );

      // Statistics and overviewString if not uploaded as file instead
      embeds.push({
        color: colorResolver(),
        title: `Traders for ${guild.name}`,
        description: stripIndents`
          __**Statistics:**__
          **Traders:** ${data.length}
          **Categories Configured:** ${totalCategories}
          **Trader-Specific Items Configured:** ${totalItems}

          **Category with most categories:** ${traderWithMostCategories.displayName} (${traderWithMostCategories.categories.length} categories)
          **Category with most items:** ${traderWithMostItems.displayName} (${Object.keys(traderWithMostItems.items).length} items)

          **Empty Traders:** ${emptyTraderString}

          **Currencies Used:**
          ${formattedCurrencies.join('\n')}

          **Created:** <t:${Math.round(new Date(data[0].createdAt).getTime() / 1000)}>
          **Updated:** <t:${Math.round(new Date(data[0].updatedAt).getTime() / 1000)}:R>
        `,
        footer: {
          text: `Analyzed ${data.length} traders in ${getRuntime(runtimeStart).ms} ms`
        }
      });
    }

    // A MARKET_TRADERS_AUTOCOMPLETE_OPTION trader has been provided
    // Receives the FILE NAME
    // { name: trader.displayName, value: trader.traderName }
    else {
      const traderResponse = await getMarketTraderByName(guild.id, trader);

      // Handle errors - Most likely trader couldn't be found
      if (traderResponse.status !== 200) {
        embeds.push(getClientErrorEmbed(traderResponse));
      }

      // 200 - OK - Trader Query Success
      else {
        const { data } = traderResponse;

        // Resolving currencies
        const currenciesInGameNames = await bulkResolveInGameNames(guild.id, data.currencies);
        const resolvedCurrencyArray = matchResolvedInGameNameArray(data.currencies, currenciesInGameNames);
        const formattedCurrencies = formatAmountInCurrency(resolvedCurrencyArray);

        // Trader details
        embeds.push({
          color: colorResolver(),
          title: data.displayName,
          description: stripIndents`
              __**Statistics:**__
              **Categories Configured:** ${data.categories.length}
              **Items Configured:** ${Object.values(data.items).length}

              **Required Humanity:** ${data.minRequiredHumanity} - ${data.maxRequiredHumanity}

              **Currencies Used:**
              ${formattedCurrencies.join('\n')}
              
              **Created:** <t:${Math.round(new Date(data.createdAt).getTime() / 1000)}>
              **Updated:** <t:${Math.round(new Date(data.updatedAt).getTime() / 1000)}:R>
            `,
          footer: {
            text: stripIndents`
              File: ${data.traderName}.json
              Completed in ${getRuntime(runtimeStart).ms} ms
            `
          }
        });

        // [DEV] - Consider if we want to add this
        // Create a new file attachment if the trader has items configured
        // if (Object.values(data.items)[0]) {
        //   files.push(
        //     new AttachmentBuilder(
        //       Buffer.from(
        //         JSON.stringify(data.items, null, 2)
        //       )
        //     ).setName(`${data.traderName}-items.json`)
        //   );
        // }

        // [DEV] - Consider if we want to add this
        // Create a new file attachment if the trader has items configured
        // if (data.categories[0]) {
        //   files.push(
        //     new AttachmentBuilder(
        //       Buffer.from(
        //         JSON.stringify(data.categories, null, 2)
        //       )
        //     ).setName(`${data.traderName}-categories.json`)
        //   );
        // }
      }
    }


    // Reply to the command - no matter of logic
    interaction.editReply({
      embeds,
      files
    });
  }
});
