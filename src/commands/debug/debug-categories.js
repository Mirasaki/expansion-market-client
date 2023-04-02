const { ChatInputCommand } = require('../../classes/Commands');
const { ApplicationCommandOptionType, AttachmentBuilder } = require('discord.js');
const { getMarketCategoryByName } = require('../../lib/requests.js');
const { MARKET_CATEGORIES_AUTOCOMPLETE_OPTION } = require('../../constants');
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
    description: 'Get an overview of available Market categories',
    options: [
      {
        name: MARKET_CATEGORIES_AUTOCOMPLETE_OPTION,
        description: `The ${ MARKET_CATEGORIES_AUTOCOMPLETE_OPTION } to query`,
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

    // Check OPTIONAL auto-complete enabled "category" option
    const category = options.getString(MARKET_CATEGORIES_AUTOCOMPLETE_OPTION);

    // A MARKET_CATEGORY_AUTOCOMPLETE_OPTION category has been provided
    // Receives the FILE NAME
    // { name: cat.displayName, value: cat.categoryName }
    const categoryResponse = await getMarketCategoryByName(server, category);

    // Handle errors - Most likely category couldn't be found
    if (categoryResponse.status !== 200) {
      embeds.push(getClientErrorEmbed(categoryResponse));
    }

    // 200 - OK - Category Query Success
    else {
      const { data } = categoryResponse;

      // Create a new file attachment if the category has items configured
      files.push(
        new AttachmentBuilder(
          Buffer.from(
            JSON.stringify(data, null, 2)
          )
        ).setName(`${ data.categoryName }.json`)
      );
    }

    // Reply to the command - no matter of logic
    interaction.editReply({
      embeds,
      files
    }).catch(() => { /* Void */ });
  }
});
