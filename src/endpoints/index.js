const fs = require('fs');
const path = require('path');

const endpointsDir = path.join(__dirname);

function registerGeneratedEndpoints(yargs) {
  if (!fs.existsSync(endpointsDir)) return;
  const files = fs.readdirSync(endpointsDir)
    .filter((f) => f !== 'index.js' && f.endsWith('.js'));

  files.forEach((f) => {
    try {
      const cmd = require(path.join(endpointsDir, f));
      if (cmd && cmd.command && cmd.handler) {
        yargs.command(cmd);
      }
    } catch (e) {
      console.error('Failed to load endpoint', f, e.message);
    }
  });
}

module.exports = {
  registerGeneratedEndpoints,
};
