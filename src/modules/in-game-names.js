const { default: axios } = require('axios');

const { BACKEND_URL } = process.env;

const getItemList = async (id) => {
  try {
    const res = await axios({
      method: 'GET',
      url: `${BACKEND_URL}/api/in-game-names/${id}`
    });
    return {
      status: res.status,
      statusText: res.statusText,
      data: res.data
    };
  } catch (err) {
    return {
      status: err.response.status,
      statusText: err.response.statusText,
      data: err.response.data
    };
  }
};

const putItemList = async (id, itemList) => {
  try {
    const res = await axios({
      method: 'PUT',
      url: `${BACKEND_URL}/api/in-game-names/${id}`,
      headers: { 'Content-Type': 'application/json' },
      data: { item_list: itemList }
    });
    return {
      status: res.status,
      statusText: res.statusText,
      data: res.data
    };
  } catch (err) {
    return {
      status: err.response.status,
      statusText: err.response.statusText,
      data: err.response.data
    };
  }
};

module.exports = {
  getItemList,
  putItemList
};
