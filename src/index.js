const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const { registerGeneratedEndpoints } = require('./endpoints');

yargs(hideBin(process.argv))
  .scriptName('jayz')
  .usage('$0 <cmd> [args]')
  .command(require('./commands/login'))
  .command(require('./commands/call'))
  .command(require('./commands/endpoint-add'))
  .command(require('./commands/endpoint-list'))
  .command(require('./commands/endpoint-update'))
  .command(require('./commands/init'))
  .middleware(() => {
    registerGeneratedEndpoints(yargs);
  })
  .demandCommand(1, 'Please supply a command.')
  .strict()
  .help()
  .wrap(Math.min(120, yargs.terminalWidth()))
  .parse();
