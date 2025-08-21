const fs = require('fs');
const path = require('path');
const readline = require('readline');
const child_process = require('child_process');

const endpointsDir = path.join(__dirname, '..', 'endpoints');

function getEndpointModules() {
  if (!fs.existsSync(endpointsDir)) return [];
  return fs.readdirSync(endpointsDir)
    .filter((f) => f !== 'index.js' && f.endsWith('.js'))
    .map((f) => {
      try {
        const mod = require(path.join(endpointsDir, f));
        return { file: f, command: mod.command, desc: mod.desc || '' };
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);
}

function spawnHelpFor(cmdName) {
  const binPath = path.join(__dirname, '..', '..', 'bin', 'jayz');
  const nodeExec = process.execPath;
  const child = child_process.spawn(nodeExec, [binPath, cmdName, '--help'], {
    stdio: 'inherit'
  });
  child.on('exit', (code) => process.exit(code || 0));
}

async function promptSelect(list) {
  return await new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('\nAvailable endpoints:');
    list.forEach((e, idx) => {
      console.log(`  [${idx+1}] ${e.command}  ${e.desc ? '- ' + e.desc : ''}`);
    });
    rl.question('Pick one to show its help (Enter to cancel): ', (ans) => {
      rl.close();
      const n = parseInt(ans, 10);
      if (!ans || isNaN(n) || n < 1 || n > list.length) return resolve(null);
      resolve(list[n-1].command);
    });
  });
}

module.exports = {
  command: 'endpoint list',
  desc: 'List generated endpoints; optionally select one to view its --help.',
  builder: (y) => y
    .option('name', { type: 'string', describe: 'If provided, immediately show help for this endpoint command.' }),
  handler: async (argv) => {
    try {
      const mods = getEndpointModules();
      if (mods.length === 0) {
        console.log('No generated endpoints found. Use: jayz endpoint add <learnUrl>');
        return;
      }

      if (argv.name) {
        const ok = mods.find(m => m.command === argv.name);
        if (!ok) {
          console.error('Unknown endpoint:', argv.name);
          console.log('Known endpoints:');
          mods.forEach((m) => console.log(' -', m.command));
          process.exit(1);
        }
        spawnHelpFor(argv.name);
        return;
      }

      // Non-interactive: just list them
      if (!process.stdout.isTTY) {
        mods.forEach((m) => console.log(m.command));
        return;
      }

      // Interactive selection
      const choice = await promptSelect(mods);
      if (!choice) {
        console.log('Cancelled.');
        return;
      }
      spawnHelpFor(choice);
    } catch (err) {
      console.error('endpoint list failed:', err.message);
      process.exit(1);
    }
  },
};
