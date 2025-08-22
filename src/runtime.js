const { getAccessToken, getAccessTokenFor } = require('./auth');
const { mergeConfig } = require('./config');
const { azRequest } = require('./http');
const { printOutput } = require('./format');
module.exports = { getAccessToken, getAccessTokenFor, mergeConfig, azRequest, printOutput };
