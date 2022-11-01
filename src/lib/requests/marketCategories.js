const logger = require('@mirasaki/logger');
const { AxiosError } = require('axios');
const BackendClient = require('../client');

const {
  NODE_ENV
} = process.env;

const getMarketCategories = async (id) => {
  let clientResponse;
  // Create our axios request config
  const config = {
    method: 'GET',
    url: `market/categories/${id}`
  };

  // Try to make the request
  try {
    const res = await BackendClient(config);
    clientResponse = BackendClient.getClientResponse(res);
  } catch (err) {
    if (err instanceof AxiosError) clientResponse = BackendClient.getClientResponse(err.response);

    // Extensive logging as this is a client-side problem
    else {
      logger.syserr('Client side error encountered while fetching categories:');
      console.dir({
        id,
        axiosConfig: config
      });
      console.error(err);

      // Building the client response depending on environment
      clientResponse = {
        error: 'Error encountered while fetching categories',
        message: NODE_ENV === 'production'
          ? 'This problem has been logged to the developers, please try again later.'
          : err.stack
      };
    }
  }

  // Return the response
  return clientResponse;
};

const getMarketCategoryByName = async (id, name) => {
  let clientResponse;
  // Create our axios request config
  const config = {
    method: 'GET',
    url: `market/categories/${id}/${name}`
  };

  // Try to make the request
  try {
    const res = await BackendClient(config);
    clientResponse = BackendClient.getClientResponse(res);
  } catch (err) {
    if (err instanceof AxiosError) clientResponse = BackendClient.getClientResponse(err.response);

    // Extensive logging as this is a client-side problem
    else {
      logger.syserr('Client side error encountered while fetching categories:');
      console.dir({
        id,
        axiosConfig: config
      });
      console.error(err);

      // Building the client response depending on environment
      clientResponse = {
        error: `Error encountered while fetching "${name}" category`,
        message: NODE_ENV === 'production'
          ? 'This problem has been logged to the developers, please try again later.'
          : err.stack
      };
    }
  }

  // Return the response
  return clientResponse;
};

module.exports = {
  getMarketCategories,
  getMarketCategoryByName
};
