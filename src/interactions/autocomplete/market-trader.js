const { ComponentCommand } = require('../../classes/Commands');
const { MARKET_SERVER_CONFIGURATION_OPTION } = require('../../constants');
const { getMarketTraders } = require('../../lib/requests.js');

module.exports = new ComponentCommand({
  run: async (client, interaction, query) => {
    const serverId = interaction.options.getString(MARKET_SERVER_CONFIGURATION_OPTION);
    const traders = await getMarketTraders(serverId); // Cached in back-end

    // Return nothing if there's no trader configuration
    if (!('data' in traders) || !traders.data[0]) return [];

    // Getting our search query's results
    const queryResult = traders.data.filter(
      (trader) =>
        // Filtering matches by displayName
        trader.displayName.toLowerCase().indexOf(query) >= 0
        // Filtering matches by traderName
        || trader.traderName.toLowerCase().indexOf(query) >= 0
    );

    // Structuring our result for Discord's API
    return queryResult
      .map(trader => ({ name: trader.displayName, value: trader.traderName }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
});
