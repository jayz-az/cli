const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { mergeConfig, writeConfig, readConfig, CONFIG_FILE } = require('../config');
const { loginWithBrowser, loginWithDeviceCode, loginWithClientSecret } = require('../auth');

function filePermsNote() {
  if (process.platform !== 'win32') {
    try { fs.chmodSync(CONFIG_FILE, 0o600); } catch (_) {}
  }
}

function ask(rl, q, defVal) {
  const prompt = defVal ? `${q} [${defVal}]: ` : `${q}: `;
  return new Promise((resolve) => rl.question(prompt, (ans) => resolve(ans || defVal || '')));
}

async function interactiveInit(argv) {
  const existing = readConfig();
  const envDefaults = {
    clientId: process.env.JAYZ_CLIENT_ID || '',
    tenantId: process.env.JAYZ_TENANT_ID || '',
    subscriptionId: process.env.JAYZ_SUBSCRIPTION_ID || '',
    authorityHost: process.env.JAYZ_AUTHORITY_HOST || existing.authorityHost || '',
  };

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const clientId = await ask(rl, 'Azure AD App Client ID', existing.clientId || envDefaults.clientId);
    const tenantId = await ask(rl, 'Tenant ID', existing.tenantId || envDefaults.tenantId);
    const subscriptionId = await ask(rl, 'Default Subscription ID (optional)', existing.subscriptionId || envDefaults.subscriptionId);
    const authorityHost = await ask(rl, 'Authority Host (optional, e.g., https://login.microsoftonline.us)', existing.authorityHost || envDefaults.authorityHost);

    if (!clientId || !tenantId) {
      console.error('clientId and tenantId are required. Aborting.');
      process.exit(1);
    }

    const config = { clientId, tenantId };
    if (subscriptionId) config.subscriptionId = subscriptionId;
    if (authorityHost) config.authorityHost = authorityHost;

    writeConfig(config);
    filePermsNote();
    console.log('Saved config to', CONFIG_FILE);

    if (argv.login) {
      const mode = argv.mode || 'browser';
      console.log('Attempting initial login using mode:', mode);
      if (mode === 'browser') {
        await loginWithBrowser({ clientId, tenantId, subscriptionId, authorityHost });
      } else if (mode === 'device') {
        await loginWithDeviceCode({ clientId, tenantId, subscriptionId, authorityHost });
      } else if (mode === 'secret') {
        if (!argv.clientSecret) {
          console.error('client secret required for --mode secret (use --client-secret).');
          process.exit(1);
        }
        await loginWithClientSecret({ clientId, clientSecret: argv.clientSecret, tenantId, subscriptionId, authorityHost });
      }
      console.log('Login complete.');
    }
  } finally {
    rl.close();
  }
}

function nonInteractiveInit(argv) {
  const existing = readConfig();
  const merged = Object.assign({}, existing);

  if (argv.clientId) merged.clientId = argv.clientId;
  if (argv.tenantId) merged.tenantId = argv.tenantId;
  if (argv.subscriptionId) merged.subscriptionId = argv.subscriptionId;
  if (argv.authorityHost) merged.authorityHost = argv.authorityHost;

  if (!merged.clientId && process.env.JAYZ_CLIENT_ID) merged.clientId = process.env.JAYZ_CLIENT_ID;
  if (!merged.tenantId && process.env.JAYZ_TENANT_ID) merged.tenantId = process.env.JAYZ_TENANT_ID;
  if (!merged.subscriptionId && process.env.JAYZ_SUBSCRIPTION_ID) merged.subscriptionId = process.env.JAYZ_SUBSCRIPTION_ID;
  if (!merged.authorityHost && process.env.JAYZ_AUTHORITY_HOST) merged.authorityHost = process.env.JAYZ_AUTHORITY_HOST;

  if (!merged.clientId || !merged.tenantId) {
    console.error('clientId and tenantId are required. Supply with flags or env. Aborting.');
    process.exit(1);
  }

  writeConfig(merged);
  filePermsNote();
  console.log('Saved config to', CONFIG_FILE);
  return merged;
}

module.exports = {
  command: 'init',
  desc: 'Interactive setup for ~/.config/jayz/config.json; optional first login.',
  builder: (y) => y
    .option('yes', { alias: 'y', type: 'boolean', default: false, describe: 'Non-interactive: write values from flags/env.' })
    .option('client-id', { type: 'string', describe: 'Client ID for non-interactive mode.' })
    .option('tenant-id', { type: 'string', describe: 'Tenant ID for non-interactive mode.' })
    .option('subscription-id', { type: 'string', describe: 'Default subscription ID.' })
    .option('authority-host', { type: 'string', describe: 'Authority host (e.g., https://login.microsoftonline.us).' })
    .option('login', { type: 'boolean', default: false, describe: 'After writing config, perform a login.' })
    .option('mode', { type: 'string', choices: ['browser', 'device', 'secret'], default: 'browser', describe: 'Login mode if --login.' })
    .option('client-secret', { type: 'string', describe: 'Required when --login --mode secret.' }),
  handler: async (argv) => {
    try {
      if (argv.yes) {
        const cfg = nonInteractiveInit(argv);
        if (argv.login) {
          const mode = argv.mode || 'browser';
          console.log('Attempting initial login using mode:', mode);
          if (mode === 'browser') {
            await loginWithBrowser(cfg);
          } else if (mode === 'device') {
            await loginWithDeviceCode(Object.assign({}, cfg));
          } else if (mode === 'secret') {
            if (!argv.clientSecret && !cfg.clientSecret) {
              console.error('client secret required for --mode secret (use --client-secret).');
              process.exit(1);
            }
            const secret = argv.clientSecret || cfg.clientSecret;
            await loginWithClientSecret(Object.assign({}, cfg, { clientSecret: secret }));
          }
          console.log('Login complete.');
        }
      } else {
        await interactiveInit(argv);
      }
    } catch (err) {
      console.error('init failed:', err.message);
      process.exit(1);
    }
  },
};
