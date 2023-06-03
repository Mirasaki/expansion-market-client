const { ComponentCommand } = require('../../classes/Commands');
const { NO_MARKET_CONFIG_OPTION_VALUE } = require('../../constants');
const { prettifyClassName } = require('../../lib/helpers/in-game-names');
const { resolveAllPossibleItems } = require('../../lib/helpers/items');
const { hasValidMarketServerAutoComplete } = require('../../lib/helpers/marketServers');
const { getInGameNames, getAllMarketItems } = require('../../lib/requests.js');

module.exports = new ComponentCommand({ run: async (client, interaction, query) => {
  // Check has valid market config option
  const server = await hasValidMarketServerAutoComplete(interaction);
  if (server === false) return;
  const inGameNames = await getInGameNames(server); // Cached in back-end

  // Find all possible combinations of in-game-names
  // and classnames, prettified, of course
  let everything;
  if (inGameNames.status !== 200) {
    const allRawItems = await getAllMarketItems(server);
    if (!allRawItems.data || !allRawItems.data[0]) {
      everything = [
        {
          name: 'No configuration, please use /set-market-config',
          value: NO_MARKET_CONFIG_OPTION_VALUE
        }
      ];
    }
    else everything = allRawItems
      .data
      .map((className) => ({
        name: prettifyClassName(className, false), value: className
      }));
  }
  else everything = resolveAllPossibleItems(inGameNames.data);

  // Return nothing if there's no in-game-name configuration
  if (!everything || !everything[0]) return [];

  // Getting our search query's results
  const queryResult = everything.filter(
    (e) => e.name.toLowerCase().indexOf(query) >= 0
  );

  // Structuring our result for Discord's API
  return queryResult
    .sort((a, b) => a.name.localeCompare(b.name));
} });
