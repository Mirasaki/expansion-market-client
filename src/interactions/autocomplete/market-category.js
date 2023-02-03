const { ComponentCommand } = require('../../classes/Commands');
const { MARKET_SERVER_CONFIGURATION_OPTION } = require('../../constants');
const { getMarketCategories } = require('../../lib/requests.js');

module.exports = new ComponentCommand({
  run: async (client, interaction, query) => {
    const serverId = interaction.options.getString(MARKET_SERVER_CONFIGURATION_OPTION);
    const categories = await getMarketCategories(serverId); // Cached in back-end

    // Return nothing if there's no category configuration
    if (!('data' in categories) || !categories.data[0]) return [];

    // Getting our search query's results
    const queryResult = categories.data.filter(
      (category) =>
        // Filtering matches by displayName
        category.displayName.toLowerCase().indexOf(query) >= 0
        // Filtering matches by categoryName
        || category.categoryName.toLowerCase().indexOf(query) >= 0
    );

    // Structuring our result for Discord's API
    return queryResult
      .map(category => ({ name: category.displayName, value: category.categoryName }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
});