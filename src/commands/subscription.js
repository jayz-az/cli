
const axios = require('axios');
const readline = require('readline');
const { getAccessToken } = require('../auth');
const { updateActiveAccount, mergeConfig } = require('../config');
const { printOutput } = require('../format');

async function fetchSubscriptions(token) {
  const resp = await axios.get('https://management.azure.com/subscriptions', {
    params: { 'api-version': '2020-01-01' },
    headers: { Authorization: 'Bearer ' + token },
    validateStatus: () => true,
  });
  if (resp.status >= 200 && resp.status < 300) {
    const data = resp.data && resp.data.value ? resp.data.value : [];
    const items = Array.isArray(data) ? data : [];
    return items.map(i => ({
      subscriptionId: i.subscriptionId || i.subscriptionID || (i.id && i.id.split('/')[2]),
      displayName: i.displayName || i.name,
      state: i.state,
      id: i.subscriptionId || i.subscriptionID || i.id,
      name: i.displayName || i.name,
    })).filter(x => x.subscriptionId);
  }
  throw new Error('Failed to list subscriptions: HTTP ' + resp.status + ' ' + JSON.stringify(resp.data));
}

async function promptSelect(list) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\\nSubscriptions:');
  list.forEach((s, idx) => {
    const disp = s.displayName || s.name || s.subscriptionId;
    const state = s.state ? (' - ' + s.state) : '';
    console.log(`  [${idx+1}] ${disp} (${s.subscriptionId})${state}`);
  });
  const ans = await new Promise((resolve) => rl.question('Pick one (Enter to cancel): ', (a) => { rl.close(); resolve(a); }));
  const n = parseInt(ans, 10);
  if (!ans || isNaN(n) || n < 1 || n > list.length) return null;
  return list[n-1];
}

function filterSubs(subs, grep) {
  if (!grep) return subs;
  const g = String(grep).toLowerCase();
  return subs.filter(s => {
    const name = (s.displayName || s.name || '').toLowerCase();
    const id = (s.subscriptionId || '').toLowerCase();
    return name.includes(g) || id.includes(g);
  });
}

module.exports = {
  command: 'subscription',
  desc: 'Manage the active Azure subscription (list/use/show).',
  builder: (y) => {
    return y
      .command({
        command: 'list',
        desc: 'List subscriptions visible to the active account; optionally pick a default.',
        builder: (y2) => y2
          .option('grep', { alias: 'g', type: 'string', describe: 'Filter by name or subscriptionId before listing/picking.' })
          .option('set-default', { type: 'boolean', default: false, describe: 'Prompt to select and set the default subscription.' })
          .option('output', { type: 'string', choices: ['json', 'table'], default: 'table' }),
        handler: async (argv) => {
          try {
            const token = await getAccessToken(argv);
            let subs = await fetchSubscriptions(token);
            subs = filterSubs(subs, argv.grep);
            if (argv.output === 'table') {
              printOutput({ value: subs }, 'table');
            } else {
              console.log(JSON.stringify({ value: subs }, null, 2));
            }
            if (argv.setDefault && process.stdout.isTTY && subs.length > 0) {
              const pick = await promptSelect(subs);
              if (!pick) { console.log('Cancelled.'); return; }
              updateActiveAccount({ subscriptionId: pick.subscriptionId });
              console.log('Default subscription set to:', pick.subscriptionId);
            }
          } catch (err) {
            console.error('subscription list failed:', err.message);
            process.exit(1);
          }
        }
      })
      .command({
        command: 'use [subscriptionId]',
        desc: 'Set the default (active) subscription. If omitted, shows a picker.',
        builder: (y2) => y2
          .positional('subscriptionId', { type: 'string' })
          .option('output', { type: 'string', choices: ['json','table'], default: 'table' })
          .option('grep', { alias: 'g', type: 'string', describe: 'Filter by name or subscriptionId before picking.' }),
        handler: async (argv) => {
          try {
            let sid = argv.subscriptionId;
            if (!sid) {
              const token = await getAccessToken(argv);
              let subs = await fetchSubscriptions(token);
              subs = filterSubs(subs, argv.grep);
              if (subs.length === 0) { console.log('No subscriptions visible.'); return; }
              const pick = await promptSelect(subs);
              if (!pick) { console.log('Cancelled.'); return; }
              sid = pick.subscriptionId;
            }
            updateActiveAccount({ subscriptionId: sid });
            console.log('Default subscription set to:', sid);
          } catch (err) {
            console.error('subscription use failed:', err.message);
            process.exit(1);
          }
        }
      })
      .command({
        command: 'show',
        desc: 'Show the currently configured subscription id (from the active account).',
        builder: (y2) => y2,
        handler: async (argv) => {
          const cfg = mergeConfig(argv);
          console.log(JSON.stringify({ subscriptionId: cfg.subscriptionId || null }, null, 2));
        }
      })
      .command({
        command: 'switch',
        desc: 'Interactive subscription picker; sets the default subscription.',
        builder: (y2) => y2
          .option('grep', { alias: 'g', type: 'string', describe: 'Filter by name or subscriptionId before picking.' }),
        handler: async (argv) => {
          try {
            const token = await getAccessToken(argv);
            let subs = await fetchSubscriptions(token);
            subs = filterSubs(subs, argv.grep);
            if (subs.length === 0) { console.log('No subscriptions visible.'); return; }
            const pick = await promptSelect(subs);
            if (!pick) { console.log('Cancelled.'); return; }
            updateActiveAccount({ subscriptionId: pick.subscriptionId });
            console.log('Default subscription set to:', pick.subscriptionId);
          } catch (err) {
            console.error('subscription switch failed:', err.message);
            process.exit(1);
          }
        }
      })
      .demandCommand(1, 'subscription requires a subcommand (list|use|show|switch)');
  },
  handler: () => {}
};
