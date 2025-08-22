const fs = require('fs');
const os = require('os');
const path = require('path');

const CONFIG_DIR = path.join(os.homedir(), '.config', 'jayz');
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const obj = JSON.parse(raw);
    if (!obj.accounts && (obj.clientId || obj.tenantId)) {
      const legacy = { ...obj };
      delete legacy.accounts; delete legacy.defaultAccount;
      const name = legacy.tokenType === 'client_secret'
        ? `spn-${(legacy.tenantId||'').slice(0,8)}-${(legacy.clientId||'').slice(0,6)}`
        : `user-${(legacy.tenantId||'').slice(0,8)}-${(legacy.clientId||'').slice(0,6)}`;
      return { accounts: { [name]: legacy }, defaultAccount: name };
    }
    return obj || {};
  } catch (_) { return {}; }
}

function writeRaw(obj) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(obj || {}, null, 2));
  try { if (process.platform !== 'win32') fs.chmodSync(CONFIG_FILE, 0o600); } catch(_) {}
}

function writeConfig(patch) {
  const cfg = readConfig();
  if (cfg.accounts && cfg.defaultAccount && cfg.accounts[cfg.defaultAccount]) {
    cfg.accounts[cfg.defaultAccount] = { ...(cfg.accounts[cfg.defaultAccount]||{}), ...(patch||{}) };
    writeRaw(cfg); return;
  }
  writeRaw({ ...(cfg||{}), ...(patch||{}) });
}

function definedOnly(obj) {
  const out = {};
  if (!obj) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

function listAccounts() { const cfg = readConfig(); return Object.keys(cfg.accounts || {}); }
function getAccount(name) { const cfg = readConfig(); return (cfg.accounts || {})[name]; }
function getActiveAccountName() { const cfg = readConfig(); return cfg.defaultAccount || null; }
function getActiveAccount() { const cfg = readConfig(); if (cfg.accounts && cfg.defaultAccount) return cfg.accounts[cfg.defaultAccount]; return null; }
function saveAccount(name, account) { const cfg = readConfig(); if (!cfg.accounts) cfg.accounts = {}; cfg.accounts[name] = { ...(cfg.accounts[name]||{}), ...(account||{}) }; if (!cfg.defaultAccount) cfg.defaultAccount = name; writeRaw(cfg); return cfg.accounts[name]; }
function removeAccount(name) { const cfg = readConfig(); if (!cfg.accounts || !cfg.accounts[name]) return false; delete cfg.accounts[name]; if (cfg.defaultAccount === name) cfg.defaultAccount = Object.keys(cfg.accounts)[0] || null; writeRaw(cfg); return true; }
function setDefaultAccount(name) { const cfg = readConfig(); if (!cfg.accounts || !cfg.accounts[name]) throw new Error('Unknown account: ' + name); cfg.defaultAccount = name; writeRaw(cfg); return name; }
function updateActiveAccount(patch) { const cfg = readConfig(); if (!cfg.accounts || !cfg.defaultAccount) throw new Error('No active account to update.'); cfg.accounts[cfg.defaultAccount] = { ...(cfg.accounts[cfg.defaultAccount]||{}), ...(patch||{}) }; writeRaw(cfg); return cfg.accounts[cfg.defaultAccount]; }

function mergeConfig(flags) {
  const fileActive = getActiveAccount() || {};
  const env = definedOnly({
    clientId: process.env.JAYZ_CLIENT_ID,
    clientSecret: process.env.JAYZ_CLIENT_SECRET,
    tenantId: process.env.JAYZ_TENANT_ID,
    subscriptionId: process.env.JAYZ_SUBSCRIPTION_ID,
    authorityHost: process.env.JAYZ_AUTHORITY_HOST,
  });
  const cli = definedOnly({
    clientId: flags && (flags.clientId || flags['client-id']),
    clientSecret: flags && (flags.clientSecret || flags['client-secret']),
    tenantId: flags && (flags.tenantId || flags['tenant-id']),
    subscriptionId: flags && (flags.subscriptionId || flags['subscription-id']),
    authorityHost: flags && (flags.authorityHost || flags['authority-host']),
  });
  return Object.assign({}, fileActive, env, cli);
}

module.exports = {
  CONFIG_FILE,
  readConfig, writeConfig, mergeConfig,
  listAccounts, getAccount, getActiveAccount, getActiveAccountName,
  saveAccount, removeAccount, setDefaultAccount, updateActiveAccount
};
