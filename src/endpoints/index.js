const fs = require('fs');
const path = require('path');
const os = require('os');

const repoEndpointsDir = path.join(__dirname);
const userEndpointsDir = path.join(os.homedir(), '.config', 'jayz', 'endpoints');

function loadDir(yargs, dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir)
    .filter((f) => f !== 'index.js' && f.endsWith('.js'));
  files.forEach((f) => {
    try {
      const full = path.join(dir, f);
      const cmd = require(full);
      if (cmd && cmd.command && cmd.handler) {
        yargs.command(cmd);
      }
    } catch (e) {
      console.error('Failed to load endpoint', f, 'from', dir, e.message);
    }
  });
}

function registerGeneratedEndpoints(yargs) {
  loadDir(yargs, repoEndpointsDir); // built-ins (if any)
  loadDir(yargs, userEndpointsDir); // user-specific endpoints
}

module.exports = { registerGeneratedEndpoints };
