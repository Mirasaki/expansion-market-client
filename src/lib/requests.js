// Import from packages
const logger = require('@mirasaki/logger');
const { AxiosError } = require('axios');
const FormData = require('form-data');
const {
  createWriteStream, createReadStream, existsSync, mkdirSync, rmSync
} = require('node:fs');
const { Agent } = require('node:http');
const { Agent: HTTPSAgent } = require('node:https');
const { pipeline } = require('node:stream');
const { promisify } = require('node:util');
const { join } = require('path');

// Import from local files
const { titleCase } = require('../util');
const BackendClient = require('./client');
const { MS_IN_ONE_HOUR } = require('../constants');

// Destructure from env
const {
  NODE_ENV,
  DEBUG_FILE_UPLOAD_REQUESTS,
  DEBUG_BASE_REQUESTS
} = process.env;
const APPLICATION_JSON = 'application/json';

// Base request
const clientRequest = async (method, url, axiosConfig) => {
  let clientResponse;
  axiosConfig = {
    method,
    url,
    ...axiosConfig,
    httpAgent: new Agent({ keepAlive: true }),
    httpsAgent: new HTTPSAgent({ keepAlive: true })
  };

  // Try to make the request
  try {
    const res = await BackendClient(axiosConfig);
    clientResponse = BackendClient.getClientResponse(res);
  }
  catch (err) {
    if (
      err instanceof AxiosError
      && err.response
    ) clientResponse = BackendClient.getClientResponse(err.response);

    // Extensive logging as this is a client-side problem
    else {
      logger.syserr('Client side error encountered while performing request:');
      console.dir(axiosConfig);
      console.error(err);

      // Building the client response depending on environment
      clientResponse = {
        error: 'Error encountered while fetching data',
        message: NODE_ENV === 'production'
          ? 'An unexpected error has occurred, this problem has been logged to the developers, please try again later.'
          : err.stack
      };
    }
  }

  // Conditional debug logging
  if (DEBUG_BASE_REQUESTS === 'true') {
    const debugTag = `[${ method.toUpperCase() }] ${ url } Request`;
    logger.startLog(debugTag);
    console.dir(clientResponse, { depth: Array.isArray(clientResponse.data) ? 2 : 1 });
    logger.endLog(debugTag);
  }

  // Return the response
  return clientResponse;
};

// File Upload request, POST
const fileUploadRequest = async ({
  id,
  readStream,
  endpoint,
  extension
}) => {
  let clientResponse;
  // Get our current temporary working directory for file downloads
  const endpointTag = endpoint.replace(/\//g, '-');
  const fileName = `${ endpointTag }.${ extension }`;
  if (!existsSync('data')) mkdirSync('data');
  const workDir = `data/${ id ? 'validate' : id }/`;

  // Check if the directory exists
  if (!existsSync(workDir)) mkdirSync(workDir);

  // Piping the file to a temporary dir
  const filePath = join(workDir, fileName);
  const streamPipeLine = promisify(pipeline);
  await streamPipeLine(readStream, createWriteStream(filePath));

  // Create our request formData
  const formData = new FormData();
  formData.append('file', createReadStream(filePath));

  // Create our axios request config
  const appendIdStr = id ? `/${ id }` : '';
  const config = {
    method: 'POST',
    url: `${ endpoint }${ appendIdStr }`,
    headers: { ...formData.getHeaders() },
    data: formData,
    httpAgent: new Agent({ keepAlive: true }),
    httpsAgent: new HTTPSAgent({ keepAlive: true })
  };

  // Try to make the request
  try {
    const res = await BackendClient(config);
    clientResponse = BackendClient.getClientResponse(res);
  }
  catch (err) {
    if (
      err instanceof AxiosError
      && err.response
    ) clientResponse = BackendClient.getClientResponse(err.response);

    // Extensive logging as this is a client-side problem
    else {
      logger.syserr('Client side error encountered while performing file upload request:');
      console.dir({
        id,
        readStream,
        endpoint,
        extension,
        workDir,
        fileName,
        filePath,
        axiosConfig: config
      });
      console.error(err);

      // Building the client response depending on environment
      clientResponse = {
        error: `Error encountered while uploading file "${ fileName }"`,
        message: NODE_ENV === 'production'
          ? 'This problem has been logged to the developers, please try again later.'
          : err.stack
      };

      // Return early to avoid additional debug logging
      return clientResponse;
    }
  }

  // Conditional debug logging
  if (DEBUG_FILE_UPLOAD_REQUESTS === 'true') {
    const endpointDebugTag = titleCase(endpointTag.replace(/-/g, ' '));
    const debugTag = `[POST] ${ endpointDebugTag } File Upload Request`;
    logger.startLog(debugTag);
    console.dir(clientResponse, { depth: 1 });
    logger.endLog(debugTag);
  }

  // Delete the file
  rmSync(filePath);

  // Return our client response data
  return clientResponse;
};

/*
 * Guilds
 */
const settingsCache = new Map();
const getGuildSettings = async (id) => await clientRequest('GET', `guilds/${ id }/settings`);
const getSettingsCache = async (guildId) => {
  let data = settingsCache.get(guildId);
  if (!settingsCache.has(guildId)) {
    const res = await getGuildSettings(guildId);
    if (res.data) {
      data = res.data;
      settingsCache.set(guildId, res.data);
    }
  }
  setTimeout(() => {
    settingsCache.delete(guildId);
  }, MS_IN_ONE_HOUR);
  return data;
};
const putSettings = async (id, data) => await clientRequest('PUT', `guilds/${ id }/settings`, {
  headers: { 'Content-Type': APPLICATION_JSON },
  data
});

/*
 * In-Game Names
 * Item-List
 */
const getInGameNames = async (id) => await clientRequest('GET', `in-game-names/${ id }`);
const getInGameNameByClass = async (id, name) => await clientRequest('GET', `in-game-names/${ id }/${ name }`);
const deleteInGameNames = async (id) => await clientRequest('DELETE', `in-game-names/${ id }`);
const putInGameNames = async (id, itemList) => await clientRequest('POST', `in-game-names/${ id }`, {
  headers: { 'Content-Type': APPLICATION_JSON },
  data: { item_list: itemList }
});
const getInGameNameByClassBulk = async (id, items) => await clientRequest('GET', `in-game-names/${ id }/bulk`, {
  headers: { 'Content-Type': APPLICATION_JSON },
  data: { items }
});


/*
 * Market
 * Categories
 */
const getMarketCategories = async (id) => await clientRequest('GET', `market/categories/${ id }`);
const getMarketCategoryByName = async (id, name) => await clientRequest('GET', `market/categories/${ id }/${ name }`);
const deleteMarketCategories = async (id) => await clientRequest('DELETE', `market/categories/${ id }`);
const putMarketCategories = async (id, readStream) => await fileUploadRequest({
  id,
  readStream,
  endpoint: 'market/categories',
  extension: 'zip'
});


/*
 * Market
 * Traders
 */
const getMarketTraders = async (id) => await clientRequest('GET', `market/traders/${ id }`);
const getMarketTraderByName = async (id, name) => await clientRequest('GET', `market/traders/${ id }/${ name }`);
const deleteMarketTraders = async (id) => await clientRequest('DELETE', `market/traders/${ id }`);
const putMarketTraders = async (id, readStream) => await fileUploadRequest({
  id,
  readStream,
  endpoint: 'market/traders',
  extension: 'zip'
});


/*
 * Market
 * Trader Zones
 */
const getMarketTraderZones = async (id) => await clientRequest('GET', `market/trader-zones/${ id }`);
const getMarketTraderZoneByName = async (id, name) => await clientRequest('GET', `market/trader-zones/${ id }/${ name }`);
const deleteMarketTraderZones = async (id) => await clientRequest('DELETE', `market/trader-zones/${ id }`);
const putMarketTraderZones = async (id, readStream) => await fileUploadRequest({
  id,
  readStream,
  endpoint: 'market/trader-zones',
  extension: 'zip'
});


/*
 * Market
 * Trader Zones
 */
const getMarketTraderMaps = async (id) => await clientRequest('GET', `market/trader-maps/${ id }`);
const getMarketTraderMapByName = async (id, name) => await clientRequest('GET', `market/trader-maps/${ id }/${ name }`);
const deleteMarketTraderMaps = async (id) => await clientRequest('DELETE', `market/trader-maps/${ id }`);
const putMarketTraderMaps = async (id, readStream) => await fileUploadRequest({
  id,
  readStream,
  endpoint: 'market/trader-maps',
  extension: 'zip'
});

/*
 * Market Items
 */
const getAllMarketItems = async (id) => await clientRequest('GET', `market/items/${ id }`);
const getMarketItemByName = async (id, className) => await clientRequest('GET', `market/items/${ id }/${ className }`);

/*
 * Market Server
 */
const getAllMarketServers = async (id) => await clientRequest('GET', `market/servers/${ id }`);
const createMarketServer = async (id, data) => await clientRequest('POST', `market/servers/${ id }`, {
  data,
  headers: new Headers({ 'content-type': APPLICATION_JSON })
});
const deleteMarketServer = async (id, marketServerId) => await clientRequest('DELETE', `market/servers/${ id }/${ marketServerId }`);


/*
 * Validation
 */
const validateTraders = async (readStream) => await fileUploadRequest({
  readStream,
  endpoint: 'validate/traders',
  extension: 'zip'
});
const validateCategories = async (readStream) => await fileUploadRequest({
  readStream,
  endpoint: 'validate/categories',
  extension: 'zip'
});
const validateTraderZones = async (readStream) => await fileUploadRequest({
  readStream,
  endpoint: 'validate/trader/zones',
  extension: 'zip'
});
const validateMaps = async (readStream) => await fileUploadRequest({
  readStream,
  endpoint: 'validate/trader/maps',
  extension: 'zip'
});


module.exports = {
  clientRequest,
  fileUploadRequest,

  settingsCache,
  getGuildSettings,
  getSettingsCache,
  putSettings,

  getInGameNames,
  getInGameNameByClass,
  deleteInGameNames,
  putInGameNames,
  getInGameNameByClassBulk,

  getMarketCategories,
  getMarketCategoryByName,
  deleteMarketCategories,
  putMarketCategories,

  getMarketTraders,
  getMarketTraderByName,
  deleteMarketTraders,
  putMarketTraders,

  getMarketTraderZones,
  getMarketTraderZoneByName,
  deleteMarketTraderZones,
  putMarketTraderZones,

  getMarketTraderMaps,
  getMarketTraderMapByName,
  deleteMarketTraderMaps,
  putMarketTraderMaps,

  getAllMarketItems,
  getMarketItemByName,

  getAllMarketServers,
  createMarketServer,
  deleteMarketServer,

  validateTraders,
  validateCategories,
  validateTraderZones,
  validateMaps
};
