const { getAccessToken } = require('./auth');
const { mergeConfig } = require('./config');
const { azRequest } = require('./http');
const { printOutput } = require('./format');

module.exports = { getAccessToken, mergeConfig, azRequest, printOutput };
