const { getAccessToken } = require('../auth');
const { mergeConfig } = require('../config');
const { azRequest } = require('../http');
const { printOutput } = require('../format');

module.exports = {
  command: 'call',
  desc: 'Generic Azure REST call.',
  builder: (y) =>
    y
      .option('method', { type: 'string', demandOption: true, describe: 'HTTP method (GET, PUT, POST, etc.)' })
      .option('url', { type: 'string', demandOption: true, describe: 'Full URL starting with https://management.azure.com' })
      .option('params', { type: 'string', describe: 'Query params as JSON (merged with api-version if present).' })
      .option('body', { type: 'string', describe: 'Request body as JSON.' })
      .option('subscription-id', { type: 'string', describe: 'Fallback subscription id for {subscriptionId} in URL.' })
      .option('output', { type: 'string', choices: ['json', 'table'], default: 'json', describe: 'Output format.' }),
  handler: async (argv) => {
    try {
      const token = await getAccessToken(argv);
      const cfg = mergeConfig(argv);

      let url = argv.url;
      if (url.includes('{subscriptionId}')) {
        const sid = argv.subscriptionId || cfg.subscriptionId;
        if (!sid) throw new Error('subscriptionId missing (env/file/flag).');
        url = url.replace('{subscriptionId}', sid);
      }

      const params = argv.params ? JSON.parse(argv.params) : {};
      const body = argv.body ? JSON.parse(argv.body) : undefined;

      const res = await azRequest({
        method: argv.method.toUpperCase(),
        url,
        token,
        params,
        body,
      });

      console.log('HTTP', res.status);
      printOutput(res.data, argv.output);
    } catch (err) {
      console.error('Call failed:', err.message);
      process.exit(1);
    }
  },
};
