/**
 * Our collection of utility functions, exported from the `/client/util.js` file
 * @module Utils
 */

/**
 * The `discord.js` Collection
 * @external DiscordCollection
 * @see {@link https://discord.js.org/#/docs/collection/main/class/Collection}
 */

// Importing from libraries
const { OAuth2Scopes, PermissionFlagsBits } = require('discord.js');
const { readdirSync, statSync } = require('fs');
const moment = require('moment');
const path = require('path');
const colors = require('./config/colors.json');
const { stripIndents } = require('common-tags');
const chalk = require('chalk');
const logger = require('@mirasaki/logger');

// Import our constants
const {
  NS_IN_ONE_MS,
  NS_IN_ONE_SECOND,
  DEFAULT_DECIMAL_PRECISION,
  BYTES_IN_KIB
} = require('./constants');

// Destructure from env
const {
  DEBUG_ENABLED,
  NODE_ENV
} = process.env;



/**
 * Transforms hex and rgb color input into integer color code
 * @method colorResolver
 * @param {string | Array<number>} [input] Hex color code or RGB array
 * @returns {number}
 */
const colorResolver = (input) => {
  // Return main bot color if no input is provided
  if (!input) return parseInt(colors.main.slice(1), 16);
  // Hex values
  if (typeof input === 'string') input = parseInt(input.slice(1), 16);
  // RGB values
  else input = (input[0] << 16) + (input[1] << 8) + input[2];
  // Returning our result
  return input;
};

/**
 * Get an array of (resolved) absolute file paths in the target directory,
 * Ignores files that start with a "." character
 * @param {string} requestedPath Absolute path to the directory
 * @param {Array<string>} [allowedExtensions=['.js', '.mjs', '.cjs']] Array of file extensions
 * @returns {Array<string>} Array of (resolved) absolute file paths
 */
const getFiles = (requestedPath, allowedExtensions = ['.js', '.mjs', '.cjs']) => {
  if (typeof allowedExtensions === 'string') allowedExtensions = [allowedExtensions];
  requestedPath ??= path.resolve(requestedPath);
  let res = [];
  for (let itemInDir of readdirSync(requestedPath)) {
    itemInDir = path.resolve(requestedPath, itemInDir);
    const stat = statSync(itemInDir);
    if (stat.isDirectory()) res = res.concat(getFiles(itemInDir, allowedExtensions));
    if (
      stat.isFile()
      && allowedExtensions.find((ext) => itemInDir.endsWith(ext))
      && !itemInDir.slice(
        itemInDir.lastIndexOf(path.sep) + 1, itemInDir.length
      ).startsWith('.')
    ) res.push(itemInDir);
  }
  return res;
};

/**
 * Utility function for getting the relative time string using moment
 * @param {Date} date The date to get the relative time from
 * @returns {string} Relative time from parameter Date
 */
const getRelativeTime = (date) => moment(date).fromNow();

/**
 * String converter: Mary Had A Little Lamb
 * @param {string} str Any string of characters
 * @returns {string} The string in title-case format
 */
const titleCase = (str) => {
  if (typeof str !== 'string') throw new TypeError('Expected type: String');
  str = str.toLowerCase().split(' ');
  for (let i = 0; i < str.length; i++) str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1);
  return str.join(' ');
};

/**
 * String converter: camelCaseString => ['camel', 'Case', 'String']
 * @param {string} str Any camelCase string
 * @param {string | null} joinCharacter If provided, joins the array output back together using the character
 * @returns {Array<string> | string} array of strings if joinCharacter is omitted, string if provided
 */
const splitCamelCaseStr = (str, joinCharacter = ' ') => {
  const arr = str.split(/ |\B(?=[A-Z])/);
  if (typeof joinCharacter === 'string') {
    return arr.join(joinCharacter);
  }
  return arr;
};

/**
 * String converter: Mary had a little lamb
 * @param {*} str The string to capitalize
 * @returns {string} Capitalized string
 */
const capitalizeString = (str) => `${str.charAt(0).toUpperCase()}${str.slice(1)}`;

/**
 * String converter: Parses a SNAKE_CASE_ARRAY to title-cased strings in an array
 * @param {Array<string>} arr Array of strings to convert
 * @returns {Array<string>} Array of title-cases SNAKE_CASE_ARRAY strings
 */
const parseSnakeCaseArray = (arr) => {
  return arr.map((str) => {
    str = str.toLowerCase().split(/[ _]+/);
    for (let i = 0; i < str.length; i++) str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1);
    return str.join(' ');
  });
};

/**
 * Get bot invite link, takes required permissions into consideration
 * @param {Client} client Our extended discord.js client
 * @returns {string} The invite link to add the bot to a server
 */
const getBotInviteLink = (client) => {
  const { commands } = client.container;
  const uniqueCombinedPermissions = [ ...new Set([].concat(...commands.map((cmd => cmd.clientPerms)))) ];
  return client.generateInvite({
    scopes: [ OAuth2Scopes.ApplicationsCommands, OAuth2Scopes.Bot ],
    permissions: uniqueCombinedPermissions.map((rawPerm) => PermissionFlagsBits[rawPerm])
  });
};

/**
 * Make the client sleep/wait for a specific amount of time
 * @param {number} ms The amount of time in milliseconds to wait/sleep
 * @returns {Promise<void>} The promise to await
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Get runtime since process.hrtime.bigint() - NOT process.hrtime()
 * @param {bigint} hrtime Timestamp in nanosecond precision
 * @param {number | 2} decimalPrecision Amount of characters to display after decimal point
 * @returns {{ seconds: number, ms: number, ns: bigint }}
 */
const getRuntime = (hrtime, decimalPrecision = DEFAULT_DECIMAL_PRECISION) => {
  // Converting
  const inNS = process.hrtime.bigint() - hrtime;
  const nsNumber = Number(inNS);
  const inMS = (nsNumber / NS_IN_ONE_MS).toFixed(decimalPrecision);
  const InSeconds = (nsNumber / NS_IN_ONE_SECOND).toFixed(decimalPrecision);

  // Return the conversions
  return {
    seconds: InSeconds,
    ms: inMS,
    ns: inNS
  };
};

/**
 * Convert a human date string into ms, credits where credits are due: https://stackoverflow.com/questions/49248262/how-to-convert-date-to-milliseconds-by-javascript
 * @param {string} dateString Human date string, for example: "25-12-2017"
 * @returns {integer} Date MS
 */
const dateStringToMS = (dateString) => {
  const prepareDate = (d) => {
    const [day, month, year] = d.split('-'); //Split the string
    return [year, month - 1, day]; //Return as an array with y,m,d sequence
    // Note: Month is 0-11, that is why m-1
  };
  return new Date(...prepareDate(dateString));
};


/**
 * [DEV]
 * Add Documentation
 */





const fetchAttachment = async (attachment, convertResToJSON = false, allowedSizeInKB = 1000) => {
  // Destructure from attachment object
  const {
    url,
    proxyURL,
    size,
    name,
    contentType
  } = attachment;

  // Performance timing
  const startFetching = process.hrtime.bigint();

  // Calculating size in KiB
  const attachmentSizeInKB = Math.round(size / BYTES_IN_KIB);

  // Return an error if attachment is too large
  if (attachmentSizeInKB > allowedSizeInKB) {
    return {
      status: 413,
      statusText: 'Request Entity Too Large',
      error: 'File Rejected',
      message: stripIndents`
        Your file exceeds the maximum size of ${allowedSizeInKB} KB.
        Your file file is ${attachmentSizeInKB} KB.
        Reduce file size by ${attachmentSizeInKB - allowedSizeInKB} KB to continue. 
      `
    };
  }

  // Fetching our attachment
  let res;
  try {
    // Try to fetch the attachment from the CDN url
    // use fetch instead to allow piping of res.body - no idea how this works with axios
    res = await fetch(url);
    // res = await axios({ method: 'GET', url: url });
  } catch (err) {
    // Try to fetch from proxy URL as a fallback if any errors are encounters
    try {
      res = await fetch(proxyURL);
    } catch (proxyErr) {
      // Define how to show the errors - more detailed in-dev
      const origFetchErrStr = NODE_ENV === 'production'
        ? err.message
        : `\`\`\`\n${err.stack || err}\`\`\``;
      const proxyFetchErrStr = NODE_ENV === 'production'
        ? proxyErr.message
        : `\`\`\`\n${proxyErr.stack || err}\`\`\``;

      // Returning an error if everything failed
      return {
        status: 503,
        statusText: 'Service Unavailable',
        error: 'Unexpected Error',
        message: stripIndents`
          Fetch from CDN: ${origFetchErrStr}
          Fetch from ProxyURL: ${proxyFetchErrStr}

          Attachment Name: ${name}
          Content Type: ${contentType}
          Size: ${attachmentSizeInKB}
          URL: ${url}
          proxyURL: ${proxyURL}
        `
      };
    }
  }

  // One final check for data availability
  if (!('body' in res) || typeof res.body === 'undefined') {
    // Debug logging
    logger.syserr('Unexpected error encounter while fetching attachment');
    logger.startLog('Fetch Attachment Response');
    console.error(res);
    logger.endLog('Fetch Attachment Response');

    return {
      status: 500,
      statusText: 'Internal Server Error',
      error: 'Unexpected Error',
      message: 'Encountered an unexpected error. Your request could not be processed, this error has been logged to the developers.\nPlease try again later.'
    };
  }

  // Performance logging
  const runtime = getRuntime(startFetching);
  if (DEBUG_ENABLED === 'true') {
    logger.debug(`${chalk.blue('Fetched attachment')} of ${chalk.yellow(attachmentSizeInKB)} KiB in ${chalk.yellow(runtime.ms)} ms (${chalk.yellow(runtime.seconds)} seconds)`);
  }

  // Returning the actual data if the attachment
  // was successfully fetched
  return {
    status: res.status,
    statusText: res.statusText,
    runtime: runtime.ms,
    size: attachmentSizeInKB,
    body: convertResToJSON
      ? await res.json()
      : res.body
  };
};

const isAllowedContentType = (valid, received) => {
  const [ allowedContentType, targetCharset ] = valid.split(' ');
  const [ contentType, charSet ] = received.split(' ');
  return {
    strict: contentType === allowedContentType && targetCharset === charSet,
    fuzzy: contentType === allowedContentType
  };
};


module.exports = {
  splitCamelCaseStr,
  colorResolver,
  getFiles,
  getRelativeTime,
  titleCase,
  capitalizeString,
  parseSnakeCaseArray,
  getBotInviteLink,
  wait: sleep,
  sleep,
  getRuntime,
  dateStringToMS,


  fetchAttachment,
  isAllowedContentType
};
