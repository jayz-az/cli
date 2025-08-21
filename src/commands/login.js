const { loginWithBrowser, loginWithDeviceCode, loginWithClientSecret } = require('../auth');

module.exports = {
  command: 'login',
  desc: 'Login with browser OAuth by default; or device code; or client secret.',
  builder: (y) =>
    y
      .option('mode', {
        type: 'string',
        choices: ['browser', 'device', 'secret'],
        default: 'browser',
        describe: 'Auth mode. Default: browser',
      })
      .option('client-id', { type: 'string', describe: 'AAD app client id (required for browser/device).' })
      .option('client-secret', { type: 'string', describe: 'AAD app client secret (secret mode).' })
      .option('tenant-id', { type: 'string', describe: 'Tenant id (GUID).' })
      .option('subscription-id', { type: 'string', describe: 'Default subscription id.' })
      .option('authority-host', {
        type: 'string',
        describe: 'Custom authority host (default login.microsoftonline.com).',
      }),
  handler: async (argv) => {
    try {
      if (argv.mode === 'secret') {
        const saved = await loginWithClientSecret(argv);
        console.log('Logged in with client secret. Subscription:', saved.subscriptionId || '(unset)');
      } else if (argv.mode === 'device') {
        const saved = await loginWithDeviceCode(argv);
        console.log('Logged in via device code. Subscription:', saved.subscriptionId || '(unset)');
      } else {
        const saved = await loginWithBrowser(argv);
        console.log('Logged in via browser OAuth. Subscription:', saved.subscriptionId || '(unset)');
      }
    } catch (err) {
      console.error('Login failed:', err.message);
      process.exit(1);
    }
  },
};
