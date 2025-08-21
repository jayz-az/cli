const { getAccessToken } = require('../auth');
const { mergeConfig } = require('../config');
const { azRequest } = require('../http');
const { printOutput } = require('../format');

module.exports = {
  command: '__CMD_NAME__',
  desc: 'Generated endpoint from Microsoft Learn.',
  builder: (y) => {
    const y2 = y
      .option('subscription-id', { type: 'string', describe: 'Subscription id fallback.' })
      .option('params', { type: 'string', describe: 'Extra query params JSON (merged).' })
      .option('body', { type: 'string', describe: 'JSON body.' })
      .option('dry', { type: 'boolean', default: false, describe: 'Print request and exit.' })
      .option('output', { type: 'string', choices: ['json', 'table'], default: 'json', describe: 'Output format.' });

    const requiredParams = __REQUIRED_PARAMS__;
    requiredParams.forEach((p) => {
      y2.option(p, { type: 'string', describe: 'Path parameter: ' + p });
    });

    return y2;
  },
  handler: async (argv) => {
    try {
      const token = await getAccessToken(argv);
      const cfg = mergeConfig(argv);

      let url = '__RAW_URL__';

      if (url.includes('{subscriptionId}')) {
        const sid = argv.subscriptionId || cfg.subscriptionId;
        if (!sid) throw new Error('subscriptionId missing.');
        url = url.replace('{subscriptionId}', sid);
      }

      const requiredParams = __REQUIRED_PARAMS__;
      requiredParams.forEach((p) => {
        if (url.includes('{' + p + '}')) {
          const v = argv[p];
          if (!v) throw new Error('Missing required path param: ' + p);
          url = url.replace('{' + p + '}', v);
        }
      });

      const defaultQuery = __DEFAULT_QUERY__;
      const extra = argv.params ? JSON.parse(argv.params) : {};
      const query = Object.assign({}, defaultQuery, extra);

      const body = argv.body ? JSON.parse(argv.body) : undefined;

      if (argv.dry) {
        console.log(JSON.stringify({
          method: '__HTTP_METHOD__',
          url,
          query,
          body,
        }, null, 2));
        return;
      }

      const res = await azRequest({
        method: '__HTTP_METHOD__',
        url,
        token,
        params: query,
        body,
      });

      console.log('HTTP', res.status);
      printOutput(res.data, argv.output);
    } catch (err) {
      console.error('__CMD_NAME__ failed:', err.message);
      process.exit(1);
    }
  },
};
