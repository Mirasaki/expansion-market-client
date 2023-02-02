const { ComponentCommand } = require('../../classes/Commands');
const { prettifyClassName } = require('../../lib/helpers/in-game-names');
const { resolveAllPossibleItems } = require('../../lib/helpers/items');
const { getInGameNames, getAllMarketItems } = require('../../lib/requests.js');

module.exports = new ComponentCommand({
  run: async (client, interaction, query) => {
    const { guild } = interaction;
    const inGameNames = await getInGameNames(guild.id); // Cached in back-end

    // Find all possible combinations of in-game-names
    // and classnames, prettified, of course
    let everything;
    if (inGameNames.status !== 200) everything = (await getAllMarketItems(guild.id))
      .data
      .map((className) => ({ name: prettifyClassName(className, false), value: className }));
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
  }
});
