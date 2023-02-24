const { ComponentCommand } = require('../../classes/Commands');
const { hasValidMarketServerAutoComplete } = require('../../lib/helpers/marketServers');
const { getMarketTraderMaps } = require('../../lib/requests.js');

module.exports = new ComponentCommand({ run: async (client, interaction, query) => {
  const server = await hasValidMarketServerAutoComplete(interaction);
  if (server === false) return;
  const traderMaps = await getMarketTraderMaps(server); // Cached in back-end

  // Return nothing if there's no trader-zone configuration
  if (!('data' in traderMaps) || !traderMaps.data[0]) return [];

  // Getting our search query's results
  const queryResult = traderMaps.data.filter(
    // Filtering matches by m_DisplayName
    (traderMap) => traderMap.identifier.toLowerCase().indexOf(query) >= 0
  );

  // Structuring our result for Discord's API
  return queryResult
    .map((trader) => ({
      name: trader.identifier, value: trader.identifier
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
} });
