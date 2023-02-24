const { ComponentCommand } = require('../../classes/Commands');
const { getGuildMarketServerArr } = require('../../lib/helpers/marketServers');

module.exports = new ComponentCommand({ run: async (client, interaction, query) => {
  const { guild } = interaction;

  // Construct server array
  const serverArr = await getGuildMarketServerArr(guild.id);

  // Getting our search query's results
  const queryResult = serverArr.filter(
    ({ name }) => name.toLowerCase().indexOf(query) >= 0
  );

  // Structuring our result for Discord's API
  return queryResult
    .sort((a, b) => a.name.localeCompare(b.name));
} });
