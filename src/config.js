const fs = require('fs');
const os = require('os');
const path = require('path');

const CONFIG_DIR = path.join(os.homedir(), '.config', 'jayz');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function writeConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

function mergeConfig(cliFlags) {
  const fileCfg = readConfig();

  const envCfg = {
    clientId: process.env.JAYZ_CLIENT_ID,
    clientSecret: process.env.JAYZ_CLIENT_SECRET,
    tenantId: process.env.JAYZ_TENANT_ID,
    subscriptionId: process.env.JAYZ_SUBSCRIPTION_ID,
    authorityHost: process.env.JAYZ_AUTHORITY_HOST,
  };

  const merged = Object.assign({}, fileCfg, removeUndefined(envCfg), removeUndefined(cliFlags));
  return merged;
}

function removeUndefined(obj) {
  const out = {};
  Object.keys(obj || {}).forEach((k) => {
    if (obj[k] !== undefined && obj[k] !== '') out[k] = obj[k];
  });
  return out;
}

module.exports = {
  CONFIG_FILE,
  readConfig,
  writeConfig,
  mergeConfig,
};
