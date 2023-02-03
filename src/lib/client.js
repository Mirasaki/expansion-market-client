// Import packages
const { default: axios } = require('axios');

// Import from local files
const pkg = require('../../package.json');
const colors = require('../config/colors.json');
const { colorResolver } = require('../util');

// Destructure from env and assignments
const {
  BACKEND_URL
} = process.env;
let tmpDir;

// Set config defaults when creating the instance
const BackendClient = axios.create({
  baseURL: `${BACKEND_URL}/api/`,
  headers: {
    'User-Agent': `${pkg.name}/${pkg.version} (${process.platform}; Node:${process.version})`,
    'Connection': 'keep-alive'
  }
});

module.exports = BackendClient;
module.exports.tmpDir = tmpDir;

module.exports.getClientResponse = (res) => {
  let clientResponse = {
    status: res.status,
    statusText: res.statusText
  };

  // Save res.data as an array instead of using the spread operator
  if (Array.isArray(res.data)) clientResponse.data = res.data;

  // Or combine/spread both objects in a new object
  else clientResponse = { ...clientResponse, ...res.data };

  // Always return the client response
  return clientResponse;
};

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
