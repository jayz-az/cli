const fs = require('fs');
const os = require('os');
const path = require('path');

const CONFIG_DIR = path.join(os.homedir(), '.config', 'jayz');
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function writeConfig(obj) {
  const data = Object.assign({}, readConfig(), obj || {});
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
  try {
    if (process.platform !== 'win32') fs.chmodSync(CONFIG_FILE, 0o600);
  } catch (_) {}
}

function mergeConfig(flags) {
  const file = readConfig();
  const env = {
    clientId: process.env.JAYZ_CLIENT_ID,
    clientSecret: process.env.JAYZ_CLIENT_SECRET,
    tenantId: process.env.JAYZ_TENANT_ID,
    subscriptionId: process.env.JAYZ_SUBSCRIPTION_ID,
    authorityHost: process.env.JAYZ_AUTHORITY_HOST,
  };

  const cli = {
    clientId: flags && (flags.clientId || flags['client-id']),
    clientSecret: flags && (flags.clientSecret || flags['client-secret']),
    tenantId: flags && (flags.tenantId || flags['tenant-id']),
    subscriptionId: flags && (flags.subscriptionId || flags['subscription-id']),
    authorityHost: flags && (flags.authorityHost || flags['authority-host']),
  };

  return Object.assign({}, file, env, cli);
}

module.exports = { CONFIG_FILE, readConfig, writeConfig, mergeConfig };
