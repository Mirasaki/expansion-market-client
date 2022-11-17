const { ChatInputCommand } = require('../../classes/Commands');
const { ApplicationCommandOptionType, AttachmentBuilder } = require('discord.js');
const { getMarketTraderZones, getMarketTraderZoneByName } = require('../../lib/requests.js');
const { MARKET_TRADER_ZONES_AUTOCOMPLETE_OPTION } = require('../../constants');
const { colorResolver, getRuntime } = require('../../util');
const { stripIndents } = require('common-tags/lib');
const { getClientErrorEmbed } = require('../../lib/client');
const { resolveSellPricePercent, resolveBuyPricePercent } = require('../../lib/helpers/market-trader-zones');

module.exports = new ChatInputCommand({
  cooldown: {
    type: 'guild',
    usages: 2,
    duration: 20
  },

  data: {
    description: 'Get an overview of available Market trader-zones',
    options: [
      {
        name: MARKET_TRADER_ZONES_AUTOCOMPLETE_OPTION,
        description: `The ${MARKET_TRADER_ZONES_AUTOCOMPLETE_OPTION} to query`,
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

    // Check OPTIONAL auto-complete enabled "traderZone" option
    const traderZone = options.getString(MARKET_TRADER_ZONES_AUTOCOMPLETE_OPTION);

    // Return a list of all trader-zones if no argument is provided
    if (!traderZone) {
      // Fetching from database
      const traderZoneResponse = await getMarketTraderZones(guild.id); // [DEV]

      // Check data availability
      if (!('data' in traderZoneResponse) || !traderZoneResponse.data[0]) {
        interaction.editReply({
          content: `${emojis.error} ${member}, you currently don't have any trader-zones configured, use **/set-market-zones** before you can use this.`
        });
        return; // Escape the command early
      }

      // Traders variables
      const { data } = traderZoneResponse;
      console.dir(data, { depth: 1 });

      const traderZoneWithMostStock = data.reduce((p, c) => Object.values(p.stock).length > Object.values(c.stock).length ? p : c);
      const mostStockOutputLen = `${Object.values(traderZoneWithMostStock.stock).length}`.length;

      const longestTraderZoneNameLen = Math.max(...data.map(traderZone => traderZone.m_DisplayName.length));
      const emptyTraderZones = data.filter((traderZone) => Object.keys(traderZone.stock).length === 0);

      // Calculate totals
      const totalStock = data.reduce(
        (accumulator, currValue) => accumulator += Object.values(currValue.stock).length, 0
      );

      // Create an overview string from our data array
      const overviewString = data
        .sort((a, b) => a.m_DisplayName.localeCompare(b.m_DisplayName)) // Sort by displayName
        .map((traderZone) => `${emojis.separator} \`${traderZone.m_DisplayName}${
          ' '.repeat(longestTraderZoneNameLen - traderZone.m_DisplayName.length)
        }\` - **${Object.keys(traderZone.stock).length}**${
          ' '.repeat(mostStockOutputLen - `${Object.keys(traderZone.stock).length}`.length)
        } stock`) // Mapping our desired output
        .join('\n'); // Joining everything together

      // Create an empty-traderZone string overview
      const emptyTraderZoneString = emptyTraderZones.length > 0
        ? '\n' + emptyTraderZones
          .map((traderZone) => ` ${emojis.separator} ${traderZone.m_DisplayName}`)
          .slice(0, 10) // Only display the first 10
          .join('\n')
        : 'None';

      // Create a new file holding the quick traderZone overview
      files.push(
        new AttachmentBuilder(
          Buffer.from(overviewString.replace(/[*`]/g, ''))
        ).setName('trader-zones-overview.txt')
      );

      // Statistics and overviewString if not uploaded as file instead
      embeds.push({
        color: colorResolver(),
        title: `Trader Zones for ${guild.name}`,
        description: stripIndents`
          __**Statistics:**__
          **Trader Zones:** ${data.length}
          **Total Items in Stock:** ${totalStock}

          **Highest Stock Zone:** ${traderZoneWithMostStock.m_DisplayName} (${Object.values(traderZoneWithMostStock.stock).length} items in stock)
          **Empty Trader Zones:** ${emptyTraderZoneString}

          **Created:** <t:${Math.round(new Date(data[0].createdAt).getTime() / 1000)}>
          **Updated:** <t:${Math.round(new Date(data[0].updatedAt).getTime() / 1000)}:R>
        `,
        footer: {
          text: `Analyzed ${data.length} trader-zones in ${getRuntime(runtimeStart).ms} ms`
        }
      });
    }

    // A MARKET_TRADER_ZONES_AUTOCOMPLETE_OPTION traderZone has been provided
    // Receives the FILE NAME
    // { name: traderZone.m_DisplayName, value: traderZone.zoneName }
    else {
      const traderZoneResponse = await getMarketTraderZoneByName(guild.id, traderZone);

      // Handle errors - Most likely traderZone couldn't be found
      if (traderZoneResponse.status !== 200) {
        embeds.push(getClientErrorEmbed(traderZoneResponse));
      }

      // 200 - OK - Trader Zone Query Success
      else {
        const { data } = traderZoneResponse;

        // Trader Zone details
        embeds.push({
          color: colorResolver(),
          title: data.m_DisplayName,
          description: stripIndents`
              __**Statistics:**__
              **Items in Stock:** ${Object.keys(data.stock).length}
              
              **Radius:** ${data.radius}m
              **Position:** ${data.position.join(` ${emojis.separator} `)}

              **Buy Price:** ${resolveBuyPricePercent(data.buyPricePercent)}%
              **Sell Price:** ${resolveSellPricePercent(data.sellPricePercent)}%
  
              **Created:** <t:${Math.round(new Date(data.createdAt).getTime() / 1000)}>
              **Updated:** <t:${Math.round(new Date(data.updatedAt).getTime() / 1000)}:R>
            `,
          footer: {
            text: stripIndents`
              File: ${data.zoneName}.json
              Completed in ${getRuntime(runtimeStart).ms} ms
            `
          }
        });

        // Create a new file attachment if the traderZone has stock configured
        if (Object.entries(data.stock)[0]) {
          files.push(
            new AttachmentBuilder(
              Buffer.from(
                JSON.stringify(data.stock, null, 2)
              )
            ).setName(`${data.zoneName}-stock.json`)
          );
        }
      }
    }


    // Reply to the command - no matter of logic
    interaction.editReply({
      embeds,
      files
    });
  }
});
