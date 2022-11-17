const { ComponentCommand } = require('../../classes/Commands');
const { getMarketTraderMaps } = require('../../lib/requests.js');

module.exports = new ComponentCommand({
  run: async (client, interaction, query) => {
    const { guild } = interaction;
    const traderMaps = await getMarketTraderMaps(guild.id); // Cached in back-end

    // Return nothing if there's no trader-zone configuration
    if (!('data' in traderMaps) || !traderMaps.data[0]) return [];

    // Getting our search query's results
    const queryResult = traderMaps.data.filter(
      (traderMap) =>
        // Filtering matches by m_DisplayName
        traderMap.identifier.toLowerCase().indexOf(query) >= 0
    );

    // Structuring our result for Discord's API
    return queryResult
      .map(trader => ({ name: trader.identifier, value: trader.identifier }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
});
