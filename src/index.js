const yargsLib = require('yargs');
const { hideBin } = require('yargs/helpers');
const { registerGeneratedEndpoints } = require('./endpoints');

const cli = yargsLib(hideBin(process.argv));

// Register generated endpoints BEFORE parsing so top-level commands are available
registerGeneratedEndpoints(cli);

cli
  .scriptName('jayz')
  .usage('$0 <cmd> [args]')
  .command(require('./commands/login'))
  .command(require('./commands/call'))
  .command(require('./commands/doctor'))
  .command(require('./commands/init'))
  .command(require('./commands/account'))
  .command(require('./commands/endpoint'))  // endpoint list|add|update|remove|repair
  .demandCommand(1, 'Please supply a command.')
  .strict()
  .help()
  .wrap(Math.min(120, cli.terminalWidth()))
  .parse();
