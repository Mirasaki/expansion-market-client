// Import from packages
const logger = require('@mirasaki/logger');
const { AxiosError } = require('axios');
const FormData = require('form-data');
const { createWriteStream, createReadStream } = require('node:fs');
const { pipeline } = require('node:stream');
const { promisify } = require('node:util');
const { join } = require('path');

// Import from local files
const { titleCase } = require('../util');
const BackendClient = require('./client');

// Destructure from env
const {
  NODE_ENV,
  DEBUG_FILE_UPLOAD_REQUESTS,
  DEBUG_BASE_REQUESTS
} = process.env;

// Base request
const clientRequest = async (method, url, axiosConfig) => {
  let clientResponse;
  axiosConfig = { method, url, ...axiosConfig };

  // Try to make the request
  try {
    const res = await BackendClient(axiosConfig);
    clientResponse = BackendClient.getClientResponse(res);
  } catch (err) {
    if (err instanceof AxiosError) clientResponse = BackendClient.getClientResponse(err.response);

    // Extensive logging as this is a client-side problem
    else {
      logger.syserr('Client side error encountered while performing request:');
      console.dir(axiosConfig);
      console.error(err);

      // Building the client response depending on environment
      clientResponse = {
        error: 'Error encountered while fetching data',
        message: NODE_ENV === 'production'
          ? 'This problem has been logged to the developers, please try again later.'
          : err.stack
      };
    }
  }

  // Conditional debug logging
  if (DEBUG_BASE_REQUESTS === 'true') {
    const endpointDebugTag = titleCase(url.replace(/-/g, ' '));
    const debugTag = `[${method.toUpperCase()}] ${endpointDebugTag} Request`;
    logger.startLog(debugTag);
    console.dir(clientResponse, { depth: 1 });
    logger.endLog(debugTag);
  }

  // Return the response
  return clientResponse;
};

// File Upload request, PUT
const fileUploadRequest = async ({
  id,
  readStream,
  endpoint,
  extension
}) => {
  let clientResponse;
  // Get our current temporary working directory for file downloads
  const endpointTag = endpoint.replace(/\//g, '-');
  const fileName = `${endpointTag}.${extension}`;
  const workDir = `data/${id}/`;

  // Piping the file to a temporary dir
  const filePath = join(workDir, fileName);
  const streamPipeLine = promisify(pipeline);
  await streamPipeLine(readStream, createWriteStream(filePath));

  // Create our request formData
  const formData = new FormData();
  formData.append('file', createReadStream(filePath));

  // Create our axios request config
  const config = {
    method: 'PUT',
    url: `${endpoint}/${id}`,
    headers: {
      ...formData.getHeaders()
    },
    data: formData
  };

  // Try to make the request
  try {
    const res = await BackendClient(config);
    clientResponse = BackendClient.getClientResponse(res);
  } catch (err) {
    if (err instanceof AxiosError) clientResponse = BackendClient.getClientResponse(err.response);

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
        error: `Error encountered while uploading file "${fileName}"`,
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
    const debugTag = `[PUT] ${endpointDebugTag} File Upload Request`;
    logger.startLog(debugTag);
    console.dir(clientResponse, { depth: 1 });
    logger.endLog(debugTag);
  }

  // Return our client response data
  return clientResponse;
};

/*
 * In-Game Names
 * Item-List
 */
const getInGameNames = async (id) =>
  await clientRequest('GET', `in-game-names/${id}`);
const getInGameNameByClass = async (id, name) =>
  await clientRequest('GET', `in-game-names/${id}/${name}`);
const deleteInGameNames = async (id) =>
  await clientRequest('DELETE', `in-game-names/${id}`);
const putInGameNames = async (id, itemList) =>
  await clientRequest('PUT', `in-game-names/${id}`, { data: { item_list: itemList } });



/*
 * Market
 * Categories
 */
const getMarketCategories = async (id) =>
  await clientRequest('GET', `market/categories/${id}`);
const getMarketCategoryByName = async (id, name) =>
  await clientRequest('GET', `market/categories/${id}/${name}`);
const deleteMarketCategories = async (id) =>
  await clientRequest('DELETE', `market/categories/${id}`);
const putMarketCategories = async (id, readStream) =>
  await fileUploadRequest({
    id,
    readStream,
    endpoint: 'market/categories',
    extension: 'zip',
    workDir: BackendClient.tmpDir
  });














module.exports = {
  clientRequest,
  fileUploadRequest,

  getInGameNames,
  getInGameNameByClass,
  deleteInGameNames,
  putInGameNames,

  getMarketCategories,
  getMarketCategoryByName,
  deleteMarketCategories,
  putMarketCategories
};
