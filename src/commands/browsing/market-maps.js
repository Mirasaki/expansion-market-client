const { ChatInputCommand } = require('../../classes/Commands');
const { ApplicationCommandOptionType, AttachmentBuilder } = require('discord.js');
const { getMarketTraderMaps, getMarketTraderMapByName } = require('../../lib/requests.js');
const { MARKET_TRADER_MAPS_AUTOCOMPLETE_OPTION, EMBED_DESCRIPTION_MAX_LENGTH } = require('../../constants');
const { colorResolver, getRuntime } = require('../../util');
const { stripIndents } = require('common-tags/lib');
const { getClientErrorEmbed } = require('../../lib/client');
const { marketServerOption, hasValidMarketServer } = require('../../lib/helpers/marketServers');
const emojis = require('../../config/emojis.json');

const getMapsDetails = (data) => {
  const longestTraderClass = data.reduce((p, c) => p.traderClass.length > c.traderClass.length ? p : c);
  const longestTrader = data.reduce((p, c) => p.trader.length > c.trader.length ? p : c);

  // Create an overview string from our data array
  const overviewString = data
    .sort((a, b) => a.identifier.localeCompare(b.identifier)) // Sort by identifier
    .map((map) => `${ emojis.separator } \`${ map.traderClass }${
      ' '.repeat(longestTraderClass.traderClass.length - map.traderClass.length)
    }     >     ${ map.trader }${
      ' '.repeat(longestTrader.trader.length - map.trader.length)
    }\``) // Mapping our desired output
    .join('\n'); // Joining everything together

  return {
    longestTraderClass,
    longestTrader,
    overviewString
  };
};

module.exports = new ChatInputCommand({
  global: true,
  cooldown: {
    type: 'guild',
    usages: 2,
    duration: 20
  },

  data: {
    description: 'Get an overview of available/configured Market trader-maps',
    options: [
      {
        name: MARKET_TRADER_MAPS_AUTOCOMPLETE_OPTION,
        description: `The ${ MARKET_TRADER_MAPS_AUTOCOMPLETE_OPTION } to query`,
        type: ApplicationCommandOptionType.String,
        autocomplete: true,
        required: false
      },
      marketServerOption
    ]
  },

  run: async (client, interaction) => {
    // Destructuring
    const {
      member, guild, options
    } = interaction;
    const { emojis } = client.container;

    // Deferring our reply
    await interaction.deferReply();

    // Check has valid market config option
    const server = await hasValidMarketServer(interaction);
    if (server === false) return;

    // Declarations
    const runtimeStart = process.hrtime.bigint();
    const files = [];
    const embeds = [];

    // Check OPTIONAL auto-complete enabled "map" option
    const map = options.getString(MARKET_TRADER_MAPS_AUTOCOMPLETE_OPTION);

    // Return a list of all maps if no argument is provided
    if (!map) {
      // Fetching from database
      const tradersResponse = await getMarketTraderMaps(server);

      // Check data availability
      if (!('data' in tradersResponse) || !tradersResponse.data[0]) {
        interaction.editReply({ content: `${ emojis.error } ${ member }, you currently don't have any trader-maps configured, use **/set-maps** before you can use this.` });
        return; // Escape the command early
      }

      // Maps variables
      const { data } = tradersResponse;
      const { overviewString } = getMapsDetails(data);

      // Attach as a file instead if the overview is too long
      if (overviewString.length > EMBED_DESCRIPTION_MAX_LENGTH) {
        // Create a new file holding the quick map overview
        files.push(
          new AttachmentBuilder(
            Buffer.from(overviewString.replace(/[*`]/g, ''))
          ).setName('trader-maps-overview.txt')
        );
      }

      // Statistics and overviewString if not uploaded as file instead
      embeds.push({
        color: colorResolver(),
        title: `Traders for ${ guild.name }`,
        description: overviewString.length > EMBED_DESCRIPTION_MAX_LENGTH
          ? 'Output has too many characters, uploaded as a file instead'
          : overviewString,
        footer: { text: `Completed in ${ getRuntime(runtimeStart).ms } ms` }
      });
    }

    // A MARKET_TRADER_MAPS_AUTOCOMPLETE_OPTION map has been provided
    // Receives the identifier
    // { name: map.identifier, value: map.traderName }
    else {
      const mapResponse = await getMarketTraderMapByName(server, map);

      // Handle errors - Most likely map couldn't be found
      if (mapResponse.status !== 200) {
        embeds.push(getClientErrorEmbed(mapResponse));
      }

      // 200 - OK - Trader Query Success
      else {
        const { data } = mapResponse;

        // Trader details
        embeds.push({
          color: colorResolver(),
          title: data.identifier,
          description: stripIndents`
              __**Statistics:**__
              **NPC:** ${ data.traderClass }
              **Trader:** ${ data.trader }.json
              **Position:** ${ data.coords.join(` ${ emojis.separator } `) }
              
              **Created:** <t:${ Math.round(new Date(data.createdAt).getTime() / 1000) }>
              **Updated:** <t:${ Math.round(new Date(data.updatedAt).getTime() / 1000) }:R>
            `,
          footer: { text: stripIndents`
              Completed in ${ getRuntime(runtimeStart).ms } ms
            ` }
        });
      }
    }


    // Reply to the command - no matter of logic
    interaction.editReply({
      embeds,
      files
    });
  }
});
