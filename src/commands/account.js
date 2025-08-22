const readline = require('readline');
const { listAccounts, getActiveAccountName, setDefaultAccount, removeAccount, getAccount } = require('../config');

async function promptSelect(items, header) {
  if (!process.stdout.isTTY) return null;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(header || 'Select an item:');
  items.forEach((name, idx) => { console.log(`  [${idx+1}] ${name}`); });
  const ans = await new Promise((resolve) => rl.question('Pick one (Enter to cancel): ', (a) => { rl.close(); resolve(a); }));
  const n = parseInt(ans, 10);
  if (!ans || isNaN(n) || n < 1 || n > items.length) return null;
  return items[n-1];
}

module.exports = {
  command: 'account',
  desc: 'Manage multiple login accounts (list/use/remove/show).',
  builder: (y) => {
    return y
      .command({
        command: 'list',
        desc: 'List known accounts; pick one to set as default.',
        builder: (y2) => y2.option('set-default', { type: 'boolean', default: false, describe: 'Prompt to set a default account.' }),
        handler: async (argv) => {
          const names = listAccounts();
          const current = getActiveAccountName();
          if (names.length === 0) { console.log('No accounts found. Run `jayz login` first.'); return; }
          names.forEach((n) => { console.log((n === current ? '* ' : '  ') + n); });
          if (argv.setDefault && process.stdout.isTTY) {
            const pick = await promptSelect(names, '\nChoose a default account:');
            if (!pick) { console.log('Cancelled.'); return; }
            setDefaultAccount(pick);
            console.log('Default account set to:', pick);
          }
        }
      })
      .command({
        command: 'use <name>',
        desc: 'Set the default (active) account.',
        builder: (y2) => y2.positional('name', { type: 'string' }),
        handler: async (argv) => {
          setDefaultAccount(argv.name);
          console.log('Default account set to:', argv.name);
        }
      })
      .command({
        command: 'remove <name>',
        desc: 'Delete an account profile.',
        builder: (y2) => y2.positional('name', { type: 'string' }),
        handler: async (argv) => {
          const ok = removeAccount(argv.name);
          if (!ok) { console.error('No such account:', argv.name); process.exit(1); }
          console.log('Removed account:', argv.name);
        }
      })
      .command({
        command: 'show [name]',
        desc: 'Show a redacted view of an account (or current).',
        builder: (y2) => y2.positional('name', { type: 'string' }),
        handler: async (argv) => {
          const { getActiveAccountName, getAccount } = require('../config');
          const name = argv.name || getActiveAccountName();
          if (!name) { console.log('No active account.'); return; }
          const acc = getAccount(name);
          if (!acc) { console.log('No such account:', name); return; }
          const redacted = { ...acc };
          if (redacted.clientSecret) redacted.clientSecret = '***';
          if (redacted.refreshToken) redacted.refreshToken = (redacted.refreshToken || '').slice(0,6) + '…';
          console.log(JSON.stringify({ name, ...redacted }, null, 2));
        }
      })
      .demandCommand(1, 'account requires a subcommand (list|use|remove|show)');
  },
  handler: () => {}
};
