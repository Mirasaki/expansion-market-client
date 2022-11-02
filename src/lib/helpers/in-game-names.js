const { MISSING_IN_GAME_NAME_STATE_TAG } = require('../../constants');
const { titleCase } = require('../../util');
const { getInGameNameByClass, getInGameNameByClassBulk } = require('../requests');

// Do what we can with the base class name
// pretty it up as much as possible
const prettifyClassName = (className, applyTag = true) => {
  const prettyClassName = titleCase(className.replaceAll(/[-_]/g, ' '));
  return applyTag
    ? applyMissingInGameNameTag(prettyClassName)
    : prettifyClassName;
};

const applyMissingInGameNameTag = (str) => `${str} ${MISSING_IN_GAME_NAME_STATE_TAG}`;

const resolveInGameName = async (id, className, prettifyUnresolved = true) => {
  const clientRes = await getInGameNameByClass(id, className);
  if (
    clientRes.status === 200
    && 'data' in clientRes
  ) return clientRes.data;
  else return prettifyUnresolved
    ? prettifyClassName(className)
    : className;
};

const bulkResolveInGameNames = async (id, items, prettifyUnresolved = true) => {
  const clientRes = await getInGameNameByClassBulk(id, items);
  if (
    clientRes.status === 200
    && 'data' in clientRes
    && 'resolved' in clientRes.data
  ) {
    if (prettifyUnresolved) clientRes.data.unresolved = clientRes.data.unresolved.map((item) => prettifyClassName(item));
    return clientRes.data;
  }
  else return prettifyUnresolved
    ? items.map((item) => prettifyClassName(item))
    : items;
};

// This function takes the items queried to the bulk resolve endpoint
// and the response, and with that builds a new array (instead of object response)
// that replaces input with the output > IF < it's resolved
// API "data" response matches characters (upper/lower- case), so no need to do any conversions
const matchResolvedInGameNameArray = (items, data, prettifyUnresolved = true) => {
  const newArr = [];
  for (const className of items) {
    if (className in data.resolved) newArr.push(data.resolved[className]);
    else newArr.push(prettifyUnresolved ? prettifyClassName(className) : className);
  }
  return newArr;
};

module.exports = {
  prettifyClassName,
  resolveInGameName,
  bulkResolveInGameNames,
  matchResolvedInGameNameArray
};
