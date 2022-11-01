const { ChatInputCommand } = require('../../classes/Commands');
const { ApplicationCommandOptionType, AttachmentBuilder } = require('discord.js');
const { getMarketCategories, getMarketCategoryByName } = require('../../lib/requests/marketCategories');
const { EMBED_DESCRIPTION_MAX_LENGTH } = require('../../constants');
const { colorResolver, getRuntime } = require('../../util');
const { stripIndents } = require('common-tags/lib');
const { getClientErrorEmbed } = require('../../lib/client');

const CATEGORY_AUTOCOMPLETE_OPTION = 'category';

module.exports = new ChatInputCommand({
  cooldown: {
    type: 'guild',
    usages: 2,
    duration: 30
  },

  data: {
    description: 'Browse all items from a specific category',
    options: [
      {
        name: CATEGORY_AUTOCOMPLETE_OPTION,
        description: 'The category to query',
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

    // Check OPTIONAL auto-complete enabled "category" option
    const category = options.getString(CATEGORY_AUTOCOMPLETE_OPTION);

    // Return a list of all categories if no argument is provided
    if (!category) {
      // Fetching from database
      const categoriesResponse = await getMarketCategories(guild.id);

      // Check data availability
      if (!('data' in categoriesResponse) || !categoriesResponse.data[0]) {
        interaction.editReply({
          content: `${emojis.error} ${member}, you currently don't have any categories configured, use **/set-market-categories** before you can use this.`
        });
        return; // Escape the command early
      }

      // Categories variables
      const { data } = categoriesResponse;
      const categoryWithMostItems = data.reduce((p, c) => p.items.length > c.items.length ? p : c);
      const longestCategoryNameLen = Math.max(...data.map(cat => cat.displayName.length));
      const longestItemOutputLen = `${categoryWithMostItems.items.length}`.length;
      const emptyCategories = data.filter((cat) => cat.items.length === 0);
      const totalItems = data.reduce(
        (accumulator, currValue) => accumulator += currValue.items.length,
        0 // Initial accumulator
      );

      // Create an overview string from our data array
      const overviewString = data
        .sort((a, b) => a.displayName.localeCompare(b.displayName)) // Sort by displayName
        .map((cat) => `${emojis.separator} \`${cat.displayName}${
          ' '.repeat(longestCategoryNameLen - cat.displayName.length)
        }\` - **${cat.items.length}**${
          ' '.repeat(longestItemOutputLen - `${cat.items.length}`.length)
        } items`) // Mapping our desired output
        .join('\n'); // Joining everything together

      // Create an empty-category string overview
      const emptyCategoryString = emptyCategories.length > 0
        ? '\n' + emptyCategories
          .map((cat) => ` ${emojis.separator} ${cat.displayName}`)
          .slice(0, 10) // Only display the first 10
          .join('\n')
        : 'None';

      // Create a new file if we're over character limit
      if (overviewString.length > EMBED_DESCRIPTION_MAX_LENGTH) {
        files.push(
          new AttachmentBuilder(
            Buffer.from(overviewString.replace(/[*`]/g, ''))
          ).setName('categories-overview.txt')
        );
      }

      // Statistics and overviewString if not uploaded as file instead
      embeds.push({
        color: colorResolver(),
        title: `Categories for ${guild.name}`,
        description: overviewString.length <= EMBED_DESCRIPTION_MAX_LENGTH
          ? overviewString
          : stripIndents`
            __**Statistics:**__
            **Categories:** ${data.length}
            **Items:** ${totalItems}

            **Category with most items:** ${categoryWithMostItems.displayName} (${categoryWithMostItems.items.length} items)
            **Empty Categories:** ${emptyCategoryString}

            **Created:** <t:${Math.round(new Date(data[0].createdAt).getTime() / 1000)}>
            **Updated:** <t:${Math.round(new Date(data[0].updatedAt).getTime() / 1000)}:R>
          `,
        footer: {
          text: `Analyzed ${data.length} categories in ${getRuntime(runtimeStart).ms} ms`
        }
      });
    }

    // A CATEGORY_AUTOCOMPLETE_OPTION category has been provided
    // Receives the FILE NAME
    // { name: cat.displayName, value: cat.categoryName }
    else {
      const categoryResponse = await getMarketCategoryByName(guild.id, category);

      // Handle errors - Most likely category couldn't be found
      if (categoryResponse.status !== 200) {
        embeds.push(getClientErrorEmbed(categoryResponse));
      }

      // 200 - OK - Category Query Success
      else {
        const { data } = categoryResponse;

        // Category details
        embeds.push({
          color: colorResolver(`#${data.color.slice(0, 6)}`),
          title: data.displayName,
          description: stripIndents`
              __**Statistics:**__
              **Items:** ${data.items.length}
              **Initial Stock:** ${data.initStockPercent}%
              
  
              **Created:** <t:${Math.round(new Date(data.createdAt).getTime() / 1000)}>
              **Updated:** <t:${Math.round(new Date(data.updatedAt).getTime() / 1000)}:R>
            `,
          footer: {
            text: stripIndents`
              File: ${data.categoryName}.json
              Completed in ${getRuntime(runtimeStart).ms} ms
            `
          }
        });

        // Create a new file attachment if the category has items configured
        if (data.items[0]) {
          files.push(
            new AttachmentBuilder(
              Buffer.from(
                JSON.stringify(data.items, null, 2)
              )
            ).setName(`${data.categoryName}-items.json`)
          );
        }
      }
      console.log(categoryResponse)


      embeds.push({
        color: colorResolver(),
        description: 'in-dev'
      })

    }


    // Reply to the command - no matter of logic
    interaction.editReply({
      embeds,
      files
    });
  }
});
