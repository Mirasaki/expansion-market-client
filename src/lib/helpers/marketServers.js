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
    guild, options, member, channel
  } = interaction;

  // Assign server variables
  const servers = await getGuildMarketServerArr(guild.id);
  const server = options.getString(MARKET_SERVER_CONFIGURATION_OPTION);
  const target = servers.find((e) => e.channelId !== null && typeof e.channelId !== 'undefined' && e.channelId === channel?.id);
  const activeMarketServerId = server
    ? server
    : target
      ? target.value
      : servers[0]
        ? servers[0].value
        : null;

  // Check valid server was supplied
  if (!activeMarketServerId) {
    interaction.editReply({ content: `${ emojis.error } ${ member }, invalid server configuration provided.` }).catch(() => { /* Void */ });
    return false;
  }

  // Is OK
  else return activeMarketServerId;
};

const hasValidMarketServerAutoComplete = async (interaction) => {
  const {
    guild, options, channel
  } = interaction;

  // Assign server variables
  const servers = await getGuildMarketServerArr(guild.id);
  const server = options.getString(MARKET_SERVER_CONFIGURATION_OPTION);
  const target = servers.find((e) => e.channelId !== null && typeof e.channelId !== 'undefined' && e.channelId === channel?.id);
  const activeMarketServerId = server
    ? server
    : target
      ? target.value
      : servers[0]
        ? servers[0].value
        : null;


  // Check valid server was supplied
  if (!activeMarketServerId) return false;
  else return activeMarketServerId;
};

const getGuildMarketServerArr = async (id) => {
  const clientRes = await getAllMarketServers(id);
  if (
    clientRes.status === 200
    && 'data' in clientRes
  ) return clientRes.data.map(({
    name, channel, id
  }) => ({
    name, value: id, channelId: channel
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
