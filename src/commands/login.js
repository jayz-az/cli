const axios = require('axios');
const readline = require('readline');
const { loginWithBrowser, loginWithDeviceCode, loginWithClientSecret, getAccessToken } = require('../auth');
const { mergeConfig, writeConfig, readConfig, saveAccount, setDefaultAccount, getActiveAccountName } = require('../config');

async function fetchSubscriptions(token) {
  const resp = await axios.get('https://management.azure.com/subscriptions', {
    params: { 'api-version': '2020-01-01' },
    headers: { Authorization: 'Bearer ' + token },
    validateStatus: () => true,
  });
  if (resp.status >= 200 && resp.status < 300) {
    const items = Array.isArray(resp.data?.value) ? resp.data.value : [];
    return items.map(i => ({
      subscriptionId: i.subscriptionId || i.subscriptionID || i.id?.split('/')[2],
      displayName: i.displayName || i.name,
      state: i.state,
    })).filter(x => x.subscriptionId);
  }
  throw new Error('Failed to list subscriptions: HTTP ' + resp.status + ' ' + JSON.stringify(resp.data));
}

async function pickSubscriptionInteractively(list) {
  return await new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('\nSelect a default subscription:');
    list.forEach((s, idx) => {
      console.log(`  [${idx+1}] ${s.displayName || s.subscriptionId} (${s.subscriptionId})${s.state ? ' - ' + s.state : ''}`);
    });
    rl.question('Enter a number (or press Enter to skip): ', (ans) => {
      rl.close();
      const n = parseInt(ans, 10);
      if (!ans || isNaN(n) || n < 1 || n > list.length) return resolve(null);
      resolve(list[n-1].subscriptionId);
    });
  });
}

module.exports = {
  command: 'login',
  desc: 'Login with browser (default), device code, or client secret; optionally pick a default subscription.',
  builder: (y) =>
    y
      .option('mode', { type: 'string', choices: ['browser', 'device', 'secret'], default: 'browser' })
      .option('client-id', { type: 'string' })
      .option('client-secret', { type: 'string' })
      .option('tenant-id', { type: 'string' })
      .option('subscription-id', { type: 'string' })
      .option('authority-host', { type: 'string' })
      .option('account', { type: 'string', describe: 'Name for this login profile (e.g., spn-prod, user-dev). Defaults to auto-generated.' })
      .option('no-default', { type: 'boolean', default: false, describe: 'Do not make this account the default after login.' })
      .option('pick-subscription', { type: 'boolean', default: true }),
  handler: async (argv) => {
    try {
      let saved;
      if (argv.mode === 'secret') {
        saved = await loginWithClientSecret(argv);
        console.log('Logged in with client secret.');
      } else if (argv.mode === 'device') {
        saved = await loginWithDeviceCode(argv);
        console.log('Logged in via device code.');
      } else {
        saved = await loginWithBrowser(argv);
        console.log('Logged in via browser OAuth.');
      }

      // Save as named account and maybe set default
      const suffix = (saved.clientId||'').slice(0,6);
      const prefix = saved.tokenType === 'client_secret' ? 'spn' : 'user';
      const name = argv.account || `${prefix}-${(saved.tenantId||'').slice(0,8)}-${suffix}`;
      saveAccount(name, saved);
      if (!argv.noDefault) { setDefaultAccount(name); }
      console.log('Saved account:', name, (!argv.noDefault ? '(set as default)' : ''));

      if (argv.subscriptionId) {
        const cfg = mergeConfig({});
        const updated = Object.assign({}, cfg, { subscriptionId: argv.subscriptionId });
        writeConfig(updated);
        console.log('Saved default subscription:', argv.subscriptionId);
        return;
      }

      if (!argv.pickSubscription) {
        const current = mergeConfig({}).subscriptionId;
        console.log('Login complete. Default subscription is', current || '(unset)');
        return;
      }

      let cfg = mergeConfig({});
      if (!cfg.subscriptionId) {
        const token = await getAccessToken({});
        const subs = await fetchSubscriptions(token);
        if (subs.length === 0) {
          console.log('Login complete. No subscriptions visible to this account.');
          return;
        }
        let chosen = null;
        if (process.stdout.isTTY && subs.length > 1) {
          chosen = await pickSubscriptionInteractively(subs);
        }
        if (!chosen) {
          chosen = subs[0].subscriptionId;
          if (subs.length > 1) console.log(`No selection made; using first subscription: ${chosen}`);
        }
        cfg = mergeConfig({ subscriptionId: chosen });
        writeConfig(cfg);
        console.log('Saved default subscription:', chosen);
      } else {
        console.log('Login complete. Default subscription is', cfg.subscriptionId);
      }
    } catch (err) {
      console.error('Login failed:', err.message);
      process.exit(1);
    }
  },
};
