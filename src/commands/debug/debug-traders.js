const { ChatInputCommand } = require('../../classes/Commands');
const { ApplicationCommandOptionType, AttachmentBuilder } = require('discord.js');
const { getMarketTraderByName } = require('../../lib/requests.js');
const { MARKET_TRADERS_AUTOCOMPLETE_OPTION } = require('../../constants');
const { getClientErrorEmbed } = require('../../lib/client');
const { hasValidMarketServer, marketServerOption } = require('../../lib/helpers/marketServers');

module.exports = new ChatInputCommand({
  global: true,
  cooldown: {
    type: 'guild',
    usages: 2,
    duration: 20
  },
  permLevel: 'Administrator',

  data: {
    description: 'Get an overview of available Market traders',
    options: [
      {
        name: MARKET_TRADERS_AUTOCOMPLETE_OPTION,
        description: `The ${ MARKET_TRADERS_AUTOCOMPLETE_OPTION } to query`,
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

    // Check OPTIONAL auto-complete enabled "trader" option
    const trader = options.getString(MARKET_TRADERS_AUTOCOMPLETE_OPTION);

    // A MARKET_TRADERS_AUTOCOMPLETE_OPTION trader has been provided
    // Receives the FILE NAME
    // { name: trader.displayName, value: trader.traderName }
    const traderResponse = await getMarketTraderByName(server, trader);

    // Handle errors - Most likely trader couldn't be found
    if (traderResponse.status !== 200) {
      embeds.push(getClientErrorEmbed(traderResponse));
    }

    // 200 - OK - Trader Query Success
    else {
      const { data } = traderResponse;

      // Create a new file attachment of the trader JSON
      files.push(
        new AttachmentBuilder(
          Buffer.from(
            JSON.stringify(data, null, 2)
          )
        ).setName(`${ data.traderName }.json`)
      );
    }


    // Reply to the command - no matter of logic
    interaction.editReply({
      embeds,
      files
    });
  }
});
