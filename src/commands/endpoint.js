const fs = require('fs');
const path = require('path');
const readline = require('readline');
const child_process = require('child_process');
const axios = require('axios');
const cheerio = require('cheerio');

const endpointsDir = path.join(__dirname, '..', 'endpoints');
const templatePath = path.join(__dirname, '..', '..', 'templates', 'endpoint.template.js');

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

async function fetchHtml(url) {
  const resp = await axios.get(url, { responseType: 'text' });
  return resp.data;
}

function scrapeHttpRequest(html) {
  const $ = cheerio.load(html);
  let method = null;
  let url = null;

  $('code, pre code').each((_, el) => {
    const t = $(el).text().trim();
    if (/^(GET|PUT|POST|PATCH|DELETE|HEAD|OPTIONS)\s+https:\/\/management\.azure\.com/i.test(t)) {
      const m = t.match(/^(GET|PUT|POST|PATCH|DELETE|HEAD|OPTIONS)\s+(https:\/\/management\.azure\.com[^\s]*)/i);
      if (m) {
        method = m[1];
        url = m[2];
        return false;
      }
    }
    return true;
  });

  return method && url ? { method, url } : null;
}

function extractApiVersionFromUrl(learnUrl) {
  const q = learnUrl.split('?')[1] || '';
  const params = new URLSearchParams(q);
  return params.get('view')?.split('rest-').pop()?.replace(/-.+$/, '') || null;
}

function synthesizeName(learnUrl, meta) {
  try {
    const u = new URL(learnUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex((p) => p === 'rest') + 2;
    const service = parts[idx] || 'service';
    const resource = (parts[idx + 1] || 'resource').replace(/-/g, '_');
    const op = (parts[idx + 2] || 'operation').replace(/-/g, '_');
    return [service, resource, op].join('_').replace(/[^a-z0-9_]/gi, '').toLowerCase();
  } catch (_) {
    return meta.method.toLowerCase() + '_endpoint';
  }
}

function extractPathParams(rawUrl) {
  const set = new Set();
  const regex = /\{([a-zA-Z0-9_]+)\}/g;
  let m;
  while ((m = regex.exec(rawUrl))) {
    set.add(m[1]);
  }
  return Array.from(set);
}

module.exports = {
  command: 'endpoint',
  desc: 'Endpoint utilities (list/add/update).',
  builder: (y) => {
    return y
      .command({
        command: 'list',
        desc: 'List generated endpoints; optionally select one to view its --help.',
        builder: (y2) => y2.option('name', { type: 'string', describe: 'If provided, immediately show help for this endpoint command.' }),
        handler: async (argv) => {
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
          if (!process.stdout.isTTY) {
            mods.forEach((m) => console.log(m.command));
            return;
          }
          const choice = await promptSelect(mods);
          if (!choice) {
            console.log('Cancelled.');
            return;
          }
          spawnHelpFor(choice);
        }
      })
      .command({
        command: 'add <learnUrl>',
        desc: 'Scaffold a typed command from a Microsoft Learn REST doc URL.',
        builder: (y2) => y2.positional('learnUrl', { type: 'string' }),
        handler: async (argv) => {
          const html = await fetchHtml(argv.learnUrl);
          const meta = scrapeHttpRequest(html);
          if (!meta || !meta.method || !meta.url) throw new Error('Could not parse HTTP request section from Learn page.');

          const apiVersion = extractApiVersionFromUrl(argv.learnUrl) || '2024-01-01';
          const name = synthesizeName(argv.learnUrl, meta);
          const filename = name + '.js';

          const requiredParams = extractPathParams(meta.url);
          const defaultedParams = apiVersion ? { 'api-version': apiVersion } : {};

          const outPath = path.join(endpointsDir, filename);
          const template = fs.readFileSync(templatePath, 'utf8');
          const rendered = template
            .replace(/__CMD_NAME__/g, name)
            .replace(/__HTTP_METHOD__/g, meta.method.toUpperCase())
            .replace(/__RAW_URL__/g, meta.url)
            .replace(/__DEFAULT_QUERY__/g, JSON.stringify(defaultedParams, null, 2))
            .replace(/__REQUIRED_PARAMS__/g, JSON.stringify(requiredParams, null, 2));

          if (!fs.existsSync(endpointsDir)) fs.mkdirSync(endpointsDir, { recursive: true });
          fs.writeFileSync(outPath, rendered, 'utf8');

          console.log('Generated:', outPath);
          console.log('You can now run:');
          console.log('  jayz', name, '--help');
        }
      })
      .command({
        command: 'update <learnUrl>',
        desc: 'Re-generate an endpoint from a Microsoft Learn REST doc URL (overwrites existing).',
        builder: (y2) => y2.positional('learnUrl', { type: 'string' }),
        handler: async (argv) => {
          const html = await fetchHtml(argv.learnUrl);
          const meta = scrapeHttpRequest(html);
          if (!meta || !meta.method || !meta.url) throw new Error('Could not parse HTTP request section from Learn page.');

          const apiVersion = extractApiVersionFromUrl(argv.learnUrl) || '2024-01-01';
          const name = synthesizeName(argv.learnUrl, meta);
          const filename = name + '.js';

          const requiredParams = extractPathParams(meta.url);
          const defaultedParams = apiVersion ? { 'api-version': apiVersion } : {};

          const outPath = path.join(endpointsDir, filename);
          const template = fs.readFileSync(templatePath, 'utf8');
          const rendered = template
            .replace(/__CMD_NAME__/g, name)
            .replace(/__HTTP_METHOD__/g, meta.method.toUpperCase())
            .replace(/__RAW_URL__/g, meta.url)
            .replace(/__DEFAULT_QUERY__/g, JSON.stringify(defaultedParams, null, 2))
            .replace(/__REQUIRED_PARAMS__/g, JSON.stringify(requiredParams, null, 2));

          if (!fs.existsSync(endpointsDir)) fs.mkdirSync(endpointsDir, { recursive: true });
          fs.writeFileSync(outPath, rendered, 'utf8');

          console.log('Updated:', outPath);
          console.log('You can now run:');
          console.log('  jayz', name, '--help');
        }
      })
      .demandCommand(1, 'endpoint requires a subcommand (list|add|update)');
  },
  handler: () => {}
};
