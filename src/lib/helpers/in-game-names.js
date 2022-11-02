const { getInGameNameByClass, getInGameNameByClassBulk } = require('../requests');

// [DEV] - TODO: Prettify parameter
// Integrated into all functions here


const resolveInGameName = async (id, className) => {
  const clientRes = await getInGameNameByClass(id, className);
  if (
    clientRes.status === 200
    && 'data' in clientRes
  ) return clientRes.data;
  else return className;
};

const bulkResolveInGameNames = async (id, items) => {
  const clientRes = await getInGameNameByClassBulk(id, items);
  if (
    clientRes.status === 200
    && 'data' in clientRes
    && 'resolved' in clientRes.data
  ) return clientRes.data;
  else return items;
};

// This function takes the items queried to the bulk resolve endpoint
// and the response, and with that builds a new array (instead of object response)
// that replaces input with the output > IF < it's resolved
// API "data" response matches characters (upper/lower- case), so no need to do any conversions
const matchResolvedInGameNameArray = (items, data) => {
  const newArr = [];
  for (const className of items) {
    if (className in data.resolved) newArr.push(data.resolved[className]);
    else newArr.push(className);
  }
  return newArr;
};

module.exports = {
  resolveInGameName,
  bulkResolveInGameNames,
  matchResolvedInGameNameArray
};
