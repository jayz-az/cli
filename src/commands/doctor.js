const fs = require('fs');
const path = require('path');
const os = require('os');
const { getActiveAccountName, getActiveAccount } = require('../config');

function checkResolve(mod) {
  try {
    const p = require.resolve(mod);
    return { ok: true, path: p };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  command: 'doctor',
  desc: 'Diagnose common setup issues (module resolution, runtime, accounts).',
  builder: (y) => y,
  handler: async () => {
    const info = {};
    info.node = process.version;
    info.cwd = process.cwd();
    info.cliDir = process.env.JAYZ_CLI_DIR || '(unset)';
    info.bin = process.argv[1];
    info.msalNode = checkResolve('msal-node');
    info.axios = checkResolve('axios');
    info.yargs = checkResolve('yargs');

    const endpointsDir = path.join(os.homedir(), '.config', 'jayz', 'endpoints');
    const runtimeShim = path.join(endpointsDir, '_runtime.js');
    info.endpointsDir = endpointsDir;
    info.runtimeShimExists = fs.existsSync(runtimeShim);

    info.activeAccount = getActiveAccountName();
    info.activeProfile = getActiveAccount();

    console.log(JSON.stringify(info, null, 2));
    if (!info.msalNode.ok) {
      console.log('\nFix: run `npm install` in your jayz project folder:', info.cliDir);
    }
  }
};
