const { ComponentCommand } = require('../../classes/Commands');
const { MARKET_SERVER_CONFIGURATION_OPTION } = require('../../constants');
const { getMarketTraderZones } = require('../../lib/requests.js');

module.exports = new ComponentCommand({
  run: async (client, interaction, query) => {
    const serverId = interaction.options.getString(MARKET_SERVER_CONFIGURATION_OPTION);
    const traderZones = await getMarketTraderZones(serverId); // Cached in back-end

    // Return nothing if there's no trader-zone configuration
    if (!('data' in traderZones) || !traderZones.data[0]) return [];

    // Getting our search query's results
    const queryResult = traderZones.data.filter(
      (traderZone) =>
        // Filtering matches by m_DisplayName
        traderZone.m_DisplayName.toLowerCase().indexOf(query) >= 0
        // Filtering matches by zoneName
        || traderZone.zoneName.toLowerCase().indexOf(query) >= 0
    );

    // Structuring our result for Discord's API
    return queryResult
      .map(trader => ({ name: trader.m_DisplayName, value: trader.zoneName }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
});