// Import from packages
const logger = require('@mirasaki/logger');
const { AxiosError } = require('axios');
const FormData = require('form-data');
const { createWriteStream, createReadStream } = require('node:fs');
const { pipeline } = require('node:stream');
const { promisify } = require('node:util');
const { join } = require('path');

// Import from local files
const { titleCase } = require('../../util');
const BackendClient = require('../client');

// Destructure from env
const {
  NODE_ENV,
  DEBUG_FILE_UPLOAD_REQUESTS
} = process.env;

const fileUploadRequest = async ({
  id,
  readStream,
  endpoint,
  extension
}) => {
  let clientResponse;
  // Get our current temporary working directory for file downloads
  const endpointTag = endpoint.replace(/\//g, '-');
  const fileName = `${endpointTag}.${extension}`;
  const workDir = `data/${id}/`;

  // Piping the file to a temporary dir
  const filePath = join(workDir, fileName);
  const streamPipeLine = promisify(pipeline);
  await streamPipeLine(readStream, createWriteStream(filePath));

  // Create our request formData
  const formData = new FormData();
  formData.append('file', createReadStream(filePath));

  // Create our axios request config
  const config = {
    method: 'PUT',
    url: `${endpoint}/${id}`,
    headers: {
      ...formData.getHeaders()
    },
    data: formData
  };

  // Try to make the request
  try {
    const res = await BackendClient(config);
    clientResponse = BackendClient.getClientResponse(res);
  } catch (err) {
    if (err instanceof AxiosError) clientResponse = BackendClient.getClientResponse(err.response);

    // Extensive logging as this is a client-side problem
    else {
      logger.syserr('Client side error encountered while performing file upload request:');
      console.dir({
        id,
        readStream,
        endpoint,
        extension,
        workDir,
        fileName,
        filePath,
        axiosConfig: config
      });
      console.error(err);

      // Building the client response depending on environment
      clientResponse = {
        error: `Error encountered while uploading file "${fileName}"`,
        message: NODE_ENV === 'production'
          ? 'This problem has been logged to the developers, please try again later.'
          : err.stack
      };

      // Return early to avoid additional debug logging
      return clientResponse;
    }
  }

  // Conditional debug logging
  if (DEBUG_FILE_UPLOAD_REQUESTS === 'true') {
    const endpointDebugTag = titleCase(endpointTag.replace(/-/g, ' '));
    const debugTag = `[PUT] ${endpointDebugTag} File Upload Request`;
    logger.startLog(debugTag);
    console.dir(clientResponse, { depth: 1 });
    logger.endLog(debugTag);
  }

  // Return our client response data
  return clientResponse;
};

module.exports = fileUploadRequest;
