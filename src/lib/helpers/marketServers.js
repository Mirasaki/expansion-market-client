const { ApplicationCommandOptionType } = require('discord.js');
const { MARKET_SERVER_CONFIGURATION_OPTION, MARKET_SERVER_CONFIGURATION_DESCRIPTION } = require('../../constants');
const { getAllMarketServers } = require('../requests');
const emojis = require('../../config/emojis.json');

const marketServerOption = {
  name: MARKET_SERVER_CONFIGURATION_OPTION,
  description: MARKET_SERVER_CONFIGURATION_DESCRIPTION,
  type: ApplicationCommandOptionType.String,
  required: false,
  autocomplete: true
};

const requiredMarketServerOption = {
  name: MARKET_SERVER_CONFIGURATION_OPTION,
  description: MARKET_SERVER_CONFIGURATION_DESCRIPTION,
  type: ApplicationCommandOptionType.String,
  required: true,
  autocomplete: true
};


const hasValidMarketServer = async (interaction) => {
  const {
    guild, options, member
  } = interaction;

  // Assign server variables
  const servers = await getGuildMarketServerArr(guild.id);
  const server = options.getString(MARKET_SERVER_CONFIGURATION_OPTION);
  const activeServer = server
    ? server
    : servers[0]
      ? servers[0].value
      : null;

  // Check valid server was supplied
  if (!activeServer) {
    interaction.editReply({ content: `${ emojis.error } ${ member }, invalid server configuration provided.` }).catch(() => { /* Void */ });
    return false;
  }

  // Is OK
  else return activeServer;
};

const hasValidMarketServerAutoComplete = async (interaction) => {
  const { guild, options } = interaction;

  // Assign server variables
  const servers = await getGuildMarketServerArr(guild.id);
  const server = options.getString(MARKET_SERVER_CONFIGURATION_OPTION);
  const activeServer = server
    ? server
    : servers[0]
      ? servers[0].value
      : null;

  // Check valid server was supplied
  if (!activeServer) return false;
  else return activeServer;
};

const getGuildMarketServerArr = async (id) => {
  const clientRes = await getAllMarketServers(id);
  if (
    clientRes.status === 200
    && 'data' in clientRes
  ) return clientRes.data.map(({ name, id }) => ({
    name, value: id
  }));
  else return [];
};

module.exports = {
  marketServerOption,
  requiredMarketServerOption,
  hasValidMarketServer,
  hasValidMarketServerAutoComplete,
  getGuildMarketServerArr
};
