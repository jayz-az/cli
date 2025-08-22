const yargsLib = require('yargs');
const { hideBin } = require('yargs/helpers');
const { registerGeneratedEndpoints } = require('./endpoints');
const path = require('path');

function safeLoad(p) {
  try { return require(p); }
  catch (e) {
    console.error('Failed to load', p, '\n', e.message);
    console.error('Re-extract the zip keeping folder structure, then run `npm install`.');
    process.exit(1);
  }
}

const cli = yargsLib(hideBin(process.argv));

// Register user endpoints BEFORE parsing so their commands are available
registerGeneratedEndpoints(cli);

cli
  .scriptName('jayz')
  .usage('$0 <cmd> [args]')
  .command(safeLoad('./commands/login'))
  .command(safeLoad('./commands/call'))
  .command(safeLoad('./commands/init'))
  .command(safeLoad('./commands/account'))
  .command(safeLoad('./commands/endpoint'))
  .command(safeLoad('./commands/doctor'))
  .demandCommand(1, 'Please supply a command.')
  .strict()
  .help()
  .wrap(Math.min(120, cli.terminalWidth()))
  .parse();
