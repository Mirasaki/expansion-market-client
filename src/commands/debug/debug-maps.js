const { ChatInputCommand } = require('../../classes/Commands');
const { ApplicationCommandOptionType, AttachmentBuilder } = require('discord.js');
const { getMarketTraderMapByName } = require('../../lib/requests.js');
const { MARKET_TRADER_MAPS_AUTOCOMPLETE_OPTION } = require('../../constants');
const { getClientErrorEmbed } = require('../../lib/client');
const { marketServerOption, hasValidMarketServer } = require('../../lib/helpers/marketServers');

module.exports = new ChatInputCommand({
  global: true,
  cooldown: {
    type: 'guild',
    usages: 2,
    duration: 20
  },
  permLevel: 'Administrator',

  data: {
    description: 'Get an overview of available/configured Market trader-maps',
    options: [
      {
        name: MARKET_TRADER_MAPS_AUTOCOMPLETE_OPTION,
        description: `The ${ MARKET_TRADER_MAPS_AUTOCOMPLETE_OPTION } to query`,
        type: ApplicationCommandOptionType.String,
        autocomplete: true,
        required: true
      },
      marketServerOption
    ]
  },

  run: async (client, interaction) => {
    // Destructuring
    const { options } = interaction;

    // Deferring our reply
    await interaction.deferReply();

    // Check has valid market config option
    const server = await hasValidMarketServer(interaction);
    if (server === false) return;

    // Declarations
    const files = [];
    const embeds = [];

    // Check OPTIONAL auto-complete enabled "map" option
    const map = options.getString(MARKET_TRADER_MAPS_AUTOCOMPLETE_OPTION);


    // A MARKET_TRADER_MAPS_AUTOCOMPLETE_OPTION map has been provided
    // Receives the identifier
    // { name: map.identifier, value: map.traderName }
    const mapResponse = await getMarketTraderMapByName(server, map);

    // Handle errors - Most likely map couldn't be found
    if (mapResponse.status !== 200) {
      embeds.push(getClientErrorEmbed(mapResponse));
    }

    // 200 - OK - Trader Query Success
    else {
      const { data } = mapResponse;

      // Create a new file attachment of the trader JSON
      files.push(
        new AttachmentBuilder(
          Buffer.from(
            JSON.stringify(data, null, 2)
          )
        ).setName(`${ data.identifier }.json`)
      );
    }

    // Reply to the command - no matter of logic
    interaction.editReply({
      embeds,
      files
    }).catch(() => { /* Void */ });
  }
});
