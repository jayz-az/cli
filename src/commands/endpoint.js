const fs = require('fs');
const path = require('path');
const readline = require('readline');
const child_process = require('child_process');
const axios = require('axios');
const cheerio = require('cheerio');

const repoEndpointsDir = path.join(__dirname, '..', 'endpoints');
const userEndpointsDir = path.join(require('os').homedir(), '.config', 'jayz', 'endpoints');
const templatePath = path.join(__dirname, '..', '..', 'templates', 'endpoint.template.js');

function collectEndpoints() {
  const dirs = [repoEndpointsDir, userEndpointsDir];
  const out = [];
  const seen = new Set();
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir)
      .filter((f) => f !== 'index.js' && f.endsWith('.js'))
      .forEach((f) => {
        try {
          const mod = require(path.join(dir, f));
          const key = mod.command;
          if (mod && mod.command && mod.handler && !seen.has(key)) {
            seen.add(key);
            out.push({ file: f, command: mod.command, desc: mod.desc || '', dir });
          }
        } catch (_) { /* ignore broken endpoints */ }
      });
  });
  return out.sort((a,b) => a.command.localeCompare(b.command));
}

function filterEndpoints(list, grep) {
  if (!grep) return list;
  const g = grep.toLowerCase();
  return list.filter(e =>
    e.command.toLowerCase().includes(g) ||
    (e.desc && e.desc.toLowerCase().includes(g)) ||
    e.file.toLowerCase().includes(g)
  );
}

function spawnHelpFor(cmdName) {
  const binPath = path.join(__dirname, '..', '..', 'bin', 'jayz');
  const nodeExec = process.execPath;
  const child = child_process.spawn(nodeExec, [binPath, cmdName, '--help'], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}

async function promptInput(question, defVal='') {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const prompt = defVal ? `${question} [${defVal}]: ` : `${question}: `;
  const ans = await new Promise((resolve) => rl.question(prompt, (a) => { rl.close(); resolve(a || defVal || ''); }));
  return ans;
}

async function promptSelect(list) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\nAvailable endpoints:');
  list.forEach((e, idx) => {
    console.log(`  [${idx+1}] ${e.command}  ${e.desc ? '- ' + e.desc : ''}`);
  });
  const ans = await new Promise((resolve) => rl.question('Pick one (Enter to cancel): ', (a) => { rl.close(); resolve(a); }));
  const n = parseInt(ans, 10);
  if (!ans || isNaN(n) || n < 1 || n > list.length) return null;
  return list[n-1];
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
      if (m) { method = m[1]; url = m[2]; return false; }
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
  while ((m = regex.exec(rawUrl))) { set.add(m[1]); }
  return Array.from(set);
}

module.exports = {
  command: 'endpoint',
  desc: 'Endpoint utilities (list/add/update/remove).',
  builder: (y) => {
    return y
      .command({
        command: 'list',
        desc: 'List generated endpoints; supports --grep and interactive picking to view --help.',
        builder: (y2) => y2
          .option('grep', { alias: 'g', type: 'string', describe: 'Filter endpoints by substring.' })
          .option('name', { type: 'string', describe: 'Directly show --help for this endpoint command.' }),
        handler: async (argv) => {
          const all = collectEndpoints();
          if (argv.name) {
            const ok = all.find(m => m.command === argv.name);
            if (!ok) {
              console.error('Unknown endpoint:', argv.name);
              console.log('Known endpoints:');
              all.forEach((m) => console.log(' -', m.command));
              process.exit(1);
            }
            spawnHelpFor(argv.name);
            return;
          }
          let list = filterEndpoints(all, argv.grep);
          if (list.length === 0) {
            if (process.stdout.isTTY && !argv.grep) {
              const q = await promptInput('No matches. Enter a search term to filter (or Enter to show all)', '');
              list = filterEndpoints(all, q);
            }
          }
          if (!process.stdout.isTTY) {
            list.forEach((m) => console.log(m.command));
            return;
          }
          if (argv.grep == null) {
            const q = await promptInput('Filter (optional)', '');
            if (q) list = filterEndpoints(list, q);
          }
          if (list.length === 0) { console.log('No endpoints matched.'); return; }
          const choice = await promptSelect(list);
          if (!choice) { console.log('Cancelled.'); return; }
          spawnHelpFor(choice.command);
        }
      })
      .command({
        command: 'add <learnUrl>',
        desc: 'Scaffold a typed command from a Microsoft Learn REST doc URL. Tip: wrap the URL in quotes.',
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

          if (!fs.existsSync(userEndpointsDir)) fs.mkdirSync(userEndpointsDir, { recursive: true });
          const outPath = path.join(userEndpointsDir, filename);
          const template = fs.readFileSync(templatePath, 'utf8');
          const rendered = template
            .replace(/__CMD_NAME__/g, name)
            .replace(/__HTTP_METHOD__/g, meta.method.toUpperCase())
            .replace(/__RAW_URL__/g, meta.url)
            .replace(/__DEFAULT_QUERY__/g, JSON.stringify(defaultedParams, null, 2))
            .replace(/__REQUIRED_PARAMS__/g, JSON.stringify(requiredParams, null, 2));

          fs.writeFileSync(outPath, rendered, 'utf8');
          console.log('Generated:', outPath);
          console.log('You can now run:');
          console.log('  jayz', name, '--help');
        }
      })
      .command({
        command: 'update <learnUrl>',
        desc: 'Re-generate an endpoint from a Microsoft Learn REST doc URL (overwrites existing). Tip: wrap the URL in quotes.',
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

          if (!fs.existsSync(userEndpointsDir)) fs.mkdirSync(userEndpointsDir, { recursive: true });
          const outPath = path.join(userEndpointsDir, filename);
          const template = fs.readFileSync(templatePath, 'utf8');
          const rendered = template
            .replace(/__CMD_NAME__/g, name)
            .replace(/__HTTP_METHOD__/g, meta.method.toUpperCase())
            .replace(/__RAW_URL__/g, meta.url)
            .replace(/__DEFAULT_QUERY__/g, JSON.stringify(defaultedParams, null, 2))
            .replace(/__REQUIRED_PARAMS__/g, JSON.stringify(requiredParams, null, 2));

          fs.writeFileSync(outPath, rendered, 'utf8');
          console.log('Updated:', outPath);
          console.log('You can now run:');
          console.log('  jayz', name, '--help');
        }
      })
      .command({
        command: 'remove [name]',
        desc: 'Remove a user-generated endpoint. Supports --grep and interactive picking.',
        builder: (y2) => y2
          .positional('name', { type: 'string', describe: 'Endpoint command name to remove (optional).' })
          .option('grep', { alias: 'g', type: 'string', describe: 'Filter endpoints by substring.' })
          .option('yes', { alias: 'y', type: 'boolean', default: false, describe: 'Do not prompt for confirmation.' }),
        handler: async (argv) => {
          const listAll = collectEndpoints().filter(e => e.dir === userEndpointsDir); // only user endpoints are removable here
          if (listAll.length === 0) { console.log('No user endpoints found at', userEndpointsDir); return; }

          let targetName = argv.name;
          if (!targetName) {
            // Build candidate list via grep or optional prompt
            let list = filterEndpoints(listAll, argv.grep);
            if (process.stdout.isTTY && argv.grep == null) {
              const q = await promptInput('Filter (optional)', '');
              if (q) list = filterEndpoints(list, q);
            }
            if (list.length === 0) { console.log('No endpoints matched.'); return; }
            if (!process.stdout.isTTY) {
              if (list.length === 1) {
                targetName = list[0].command;
              } else {
                console.error('Multiple matches. Use --grep to narrow down or provide a name.');
                list.forEach((m) => console.error(' -', m.command));
                process.exit(1);
              }
            } else {
              const choice = await promptSelect(list);
              if (!choice) { console.log('Cancelled.'); return; }
              targetName = choice.command;
            }
          }

          const file = path.join(userEndpointsDir, targetName + '.js');
          if (!fs.existsSync(file)) {
            console.error('Not found in user endpoints:', file);
            process.exit(1);
          }

          if (!argv.yes && process.stdout.isTTY) {
            const ans = await promptInput(`Delete ${file}? [y/N]`, 'N');
            if (!/^y(es)?$/i.test(ans || '')) { console.log('Cancelled.'); return; }
          }

          fs.unlinkSync(file);
          console.log('Removed:', file);
        }
      })
      .demandCommand(1, 'endpoint requires a subcommand (list|add|update|remove)');
  },
  handler: () => {}
};
