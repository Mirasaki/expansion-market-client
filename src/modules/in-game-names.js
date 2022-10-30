const logger = require('@mirasaki/logger');
const { default: axios } = require('axios');

const {
  BACKEND_URL,
  DEBUG_ITEM_LIST_REQUESTS
} = process.env;

const getItemList = async (id) => {
  let clientResponse;
  try {
    const res = await axios({
      method: 'GET',
      url: `${BACKEND_URL}/api/in-game-names/${id}`
    });
    clientResponse = {
      status: res.status,
      statusText: res.statusText,
      data: res.data
    };
  } catch (err) {
    clientResponse = {
      status: err.response.status,
      statusText: err.response.statusText,
      data: err.response.data
    };
  }

  if (DEBUG_ITEM_LIST_REQUESTS === 'true') {
    logger.startLog('[GET] Item List Request');
    console.dir(clientResponse, { depth: 1 });
    logger.endLog('[GET] Item List Request');
  }

  return clientResponse;
};

const putItemList = async (id, itemList) => {
  let clientResponse;
  try {
    const res = await axios({
      method: 'PUT',
      url: `${BACKEND_URL}/api/in-game-names/${id}`,
      headers: { 'Content-Type': 'application/json' },
      data: { item_list: itemList }
    });
    clientResponse = {
      status: res.status,
      statusText: res.statusText,
      data: res.data
    };
  } catch (err) {
    clientResponse = {
      status: err.response.status,
      statusText: err.response.statusText,
      data: err.response.data
    };
  }

  if (DEBUG_ITEM_LIST_REQUESTS === 'true') {
    logger.startLog('[PUT] Item List Request');
    console.dir(clientResponse, { depth: 1 });
    logger.endLog('[PUT] Item List Request');
  }

  return clientResponse;
};

module.exports = {
  getItemList,
  putItemList
};
