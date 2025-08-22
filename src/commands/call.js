const { getAccessToken, mergeConfig } = require('../auth');
const { azRequest } = require('../http');
const { printOutput } = require('../format');

module.exports = {
  command: 'call',
  desc: 'Generic HTTP call against ARM/Graph with jayz auth.',
  builder: (y) => y
    .option('method', { type: 'string', choices: ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'], demandOption: true })
    .option('url', { type: 'string', demandOption: true })
    .option('params', { type: 'string', describe: 'JSON of query params' })
    .option('body', { type: 'string', describe: 'JSON body' })
    .option('output', { type: 'string', choices: ['json','table'], default: 'json' }),
  handler: async (argv) => {
    try {
      const token = await getAccessToken(argv);
      const cfg = mergeConfig(argv);

      let url = argv.url;
      if (url.includes('{subscriptionId}')) {
        const sid = cfg.subscriptionId || argv.subscriptionId;
        if (!sid) throw new Error('subscriptionId missing (env/file/flag)');
        url = url.replace('{subscriptionId}', sid);
      }

      const urlObj = new URL(url);
      const urlParams = {};
      for (const [k,v] of urlObj.searchParams.entries()) urlParams[k] = v;
      urlObj.search = '';
      url = urlObj.toString();

      const p = argv.params ? JSON.parse(argv.params) : {};
      const params = Object.assign({}, urlParams, p);
      const body = argv.body ? JSON.parse(argv.body) : undefined;

      const res = await azRequest({ method: argv.method, url, token, params, body });
      console.log('HTTP', res.status);
      printOutput(res.data, argv.output);
    } catch (err) {
      if (err && err.response) {
        console.error('HTTP', err.response.status, JSON.stringify(err.response.data));
      } else {
        console.error('Call failed:', err.message);
      }
      process.exit(1);
    }
  }
};
