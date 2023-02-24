const { ChatInputCommand } = require('../../classes/Commands');
const { ApplicationCommandOptionType, AttachmentBuilder } = require('discord.js');
const { getMarketTraderZoneByName } = require('../../lib/requests.js');
const { MARKET_TRADER_ZONES_AUTOCOMPLETE_OPTION } = require('../../constants');
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
    description: 'Get an overview of available Market trader-zones',
    options: [
      {
        name: MARKET_TRADER_ZONES_AUTOCOMPLETE_OPTION,
        description: `The ${ MARKET_TRADER_ZONES_AUTOCOMPLETE_OPTION } to query`,
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

    // Check OPTIONAL auto-complete enabled "traderZone" option
    const traderZone = options.getString(MARKET_TRADER_ZONES_AUTOCOMPLETE_OPTION);

    // A MARKET_TRADER_ZONES_AUTOCOMPLETE_OPTION traderZone has been provided
    // Receives the FILE NAME
    // { name: traderZone.m_DisplayName, value: traderZone.zoneName }
    const traderZoneResponse = await getMarketTraderZoneByName(server, traderZone);

    // Handle errors - Most likely traderZone couldn't be found
    if (traderZoneResponse.status !== 200) {
      embeds.push(getClientErrorEmbed(traderZoneResponse));
    }

    // 200 - OK - Trader Zone Query Success
    else {
      const { data } = traderZoneResponse;

      // Create a new file attachment if the traderZone has stock configured
      files.push(
        new AttachmentBuilder(
          Buffer.from(
            JSON.stringify(data, null, 2)
          )
        ).setName(`${ data.zoneName }.json`)
      );
    }

    // Reply to the command - no matter of logic
    interaction.editReply({
      embeds,
      files
    });
  }
});
