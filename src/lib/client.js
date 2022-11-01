// Import packages
const { default: axios } = require('axios');
const logger = require('@mirasaki/logger');
const { mkdtempSync } = require('fs');
const { tmpdir } = require('os');
const path = require('path');
const chalk = require('chalk');

// Import from local files
const pkg = require('../../package.json');
const colors = require('../config/colors.json');
const { colorResolver } = require('../util');

// Destructure from env and assignments
const {
  BACKEND_URL,
  DEBUG_ENABLED
} = process.env;
let tmpDir;
const appPrefix = pkg.name;

// Set config defaults when creating the instance
const BackendClient = axios.create({
  baseURL: `${BACKEND_URL}/api/`
});

const createWorkingDir = () => {
  try {
    const tmpDir = mkdtempSync(path.join(tmpdir(), `${appPrefix}-`));
    // Conditional debug logging
    if (DEBUG_ENABLED === 'true') logger.debug(`Temporary working directory: ${chalk.green(tmpDir)}`);
    return tmpDir;
  } catch (err) {
    console.error(err);
  }
};

module.exports = BackendClient;
module.exports.tmpDir = tmpDir;

module.exports.getClientResponse = (res) => ({
  status: res.status,
  statusText: res.statusText,
  ...res.data
});

module.exports.getClientErrorEmbed = ({
  error,
  message,
  status,
  statusText
}) => ({
  color: colorResolver(colors.error),
  title: error,
  description: message,
  footer: {
    text: `${status} | ${statusText}`
  }
});

module.exports.init = () => {
  BackendClient.tmpDir = createWorkingDir();
};
