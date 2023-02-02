const { ComponentCommand } = require('../../classes/Commands');
const { MARKET_SERVER_CONFIGURATION_OPTION } = require('../../constants');
const { getInGameNames } = require('../../lib/requests.js');

module.exports = new ComponentCommand({
  run: async (client, interaction, query) => {
    const serverId = interaction.options.getString(MARKET_SERVER_CONFIGURATION_OPTION);
    const inGameNames = await getInGameNames(serverId); // Cached in back-end

    // Return nothing if there's no in-game-name configuration
    if (
      !('data' in inGameNames)
      || !('valid' in inGameNames.data)
    ) return [];

    // Get object keys/classnames
    const classNameArr = Object.keys(inGameNames.data.valid);

    // Getting our search query's results
    const queryResult = classNameArr.filter(
      (className) => className.toLowerCase().indexOf(query) >= 0
    );

    // Structuring our result for Discord's API
    return queryResult
      .map(className => ({ name: className, value: className }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
});
