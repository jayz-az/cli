const path = require('path');
function resolveRuntime() {
  const candidates = [];
  if (process.env.JAYZ_CLI_DIR) {
    candidates.push(path.join(process.env.JAYZ_CLI_DIR, 'src', 'runtime'));
    candidates.push(path.join(process.env.JAYZ_CLI_DIR, 'runtime'));
  }
  try { const bin = process.argv[1]; if (bin) candidates.push(path.join(path.dirname(bin), '..', 'src', 'runtime')); } catch (_) {}
  candidates.push(path.join(__dirname, '_runtime'));
  candidates.push(path.join(__dirname, '..', '..', 'src', 'runtime'));
  const tried = [];
  for (const c of candidates) { try { return require(c); } catch (e) { tried.push(c); } }
  throw new Error('jayz runtime not found. Tried: ' + tried.join(', '));
}
const { getAccessTokenFor, mergeConfig, azRequest, printOutput } = resolveRuntime();
const SCOPE = '__SCOPE__';

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
    requiredParams.forEach((p) => { y2.option(p, { type: 'string', describe: 'Path parameter: ' + p }); });
    return y2;
  },
  handler: async (argv) => {
    try {
      const token = await getAccessTokenFor(SCOPE, argv);
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

      const urlObj = new URL(url);
      const queryFromUrl = {};
      for (const [k, v] of urlObj.searchParams.entries()) queryFromUrl[k] = v;
      urlObj.search = '';
      url = urlObj.toString();

      const defaultQuery = __DEFAULT_QUERY__;
      const extra = argv.params ? JSON.parse(argv.params) : {};
      const query = Object.assign({}, defaultQuery, queryFromUrl, extra);

      const body = argv.body ? JSON.parse(argv.body) : undefined;

      if (argv.dry) { console.log(JSON.stringify({ method: '__HTTP_METHOD__', url, query, body }, null, 2)); return; }

      const res = await azRequest({ method: '__HTTP_METHOD__', url, token, params: query, body });
      console.log('HTTP', res.status);
      printOutput(res.data, argv.output);
    } catch (err) {
      console.error('__CMD_NAME__ failed:', err.message);
      process.exit(1);
    }
  },
};
