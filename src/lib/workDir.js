const logger = require('@mirasaki/logger');
const { mkdtempSync } = require('fs');
const { tmpdir } = require('os');
const path = require('path');
const chalk = require('chalk');
const pkg = require('../../package.json');

let tmpDir;
const appPrefix = pkg.name;
const { DEBUG_ENABLED } = process.env;

const getWorkDir = () => {
  // Initialize the working directory if it doesn't exist
  if (!tmpDir) {
    try {
      tmpDir = mkdtempSync(path.join(tmpdir(), `${appPrefix}-`));
      // Conditional debug logging
      if (DEBUG_ENABLED === 'true') logger.debug(`Temporary working directory: ${chalk.green(tmpDir)}`);
    } catch (err) {
      console.error(err);
    }
  }

  return tmpDir;
};

module.exports = getWorkDir;
