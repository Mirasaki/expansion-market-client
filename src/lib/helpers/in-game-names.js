const { MISSING_IN_GAME_NAME_STATE_TAG, MS_IN_ONE_HOUR } = require('../../constants');
const { titleCase } = require('../../util');
const { getInGameNameByClass, getInGameNameByClassBulk } = require('../requests');

// Do what we can with the base class name
// pretty it up as much as possible
const prettifyClassName = (className, applyTag = true) => {
  const prettyClassName = titleCase(className.replaceAll(/[-_]/g, ' '));
  return applyTag
    ? applyMissingInGameNameTag(prettyClassName)
    : prettyClassName;
};

const applyMissingInGameNameTag = (str) => `${str} ${MISSING_IN_GAME_NAME_STATE_TAG}`;

const inGameNameCache = {};

/**
 * Should only be used when the TraderCategoryItem object is not
 * directly available, otherwise, use #displayName
 * @param {string} id market-server-id
 * @param {string} className The item's class name
 * @param {boolean} prettifyUnresolved Prettify class name when unresolved
 * @param {boolean} applyTag Apply missing displayName tag
 * @returns
 */
const resolveInGameName = async (id, className, prettifyUnresolved = true, applyTag = true) => {
  let ign;

  // Resolve market-server-config in-game-name cache
  let serverIgnCache = ([id] in inGameNameCache) ? inGameNameCache[id] : null;
  if (!serverIgnCache) {
    inGameNameCache[id] = serverIgnCache = {};
    setTimeout(() => delete inGameNameCache[id], MS_IN_ONE_HOUR);
  }

  // Check item is cached - early escape
  else if (serverIgnCache[className]) return serverIgnCache[className];

  // Resolve in-game name
  const clientRes = await getInGameNameByClass(id, className);
  if (
    clientRes.status === 200
    && 'data' in clientRes
  ) {
    ign = clientRes.data;
  }
  else ign = prettifyUnresolved
    ? prettifyClassName(className, applyTag)
    : className;

  // Set in cache
  serverIgnCache[className] = ign;

  // Return fetched ign
  return ign;
};

const bulkResolveInGameNames = async (id, items, prettifyUnresolved = true, applyTag = true) => {
  const clientRes = await getInGameNameByClassBulk(id, items);
  if (
    clientRes.status === 200
    && 'data' in clientRes
    && 'resolved' in clientRes.data
  ) {
    // Prettify unresolved names if request
    if (prettifyUnresolved) clientRes.data.unresolved = clientRes.data.unresolved.map((item) => prettifyClassName(item, applyTag));
    return clientRes.data; // Or return the default response
  }

  // No Item list configured - build replica response with all unresolved
  else return prettifyUnresolved
    ? { resolved: [], unresolved: items.map((item) => prettifyClassName(item, applyTag)) }
    : { resolved: [], unresolved: items };
};

// This function takes the items queried to the bulk resolve endpoint
// and the response, and with that builds a new array (instead of object response)
// that replaces input with the output > IF < it's resolved
// API "data" response matches characters (upper/lower- case), so no need to do any conversions
const matchResolvedInGameNameArray = (items, data, prettifyUnresolved = true, appendClassInParenthesis = false) => {
  const newArr = [];
  for (const className of items) {
    if (className in data.resolved) newArr.push(`${data.resolved[className]}${appendClassInParenthesis ? ` (${className})` : ''}`);
    else newArr.push(prettifyUnresolved ? prettifyClassName(className) : className);
  }
  return newArr;
};

module.exports = {
  inGameNameCache,
  prettifyClassName,
  resolveInGameName,
  bulkResolveInGameNames,
  matchResolvedInGameNameArray
};
