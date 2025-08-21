const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const endpointsDir = path.join(__dirname, '..', 'endpoints');
const templatePath = path.join(__dirname, '..', '..', 'templates', 'endpoint.template.js');

module.exports = {
  command: 'endpoint add <learnUrl>',
  desc: 'Scaffold a typed command from a Microsoft Learn REST doc URL.',
  builder: (y) => y.positional('learnUrl', { type: 'string', describe: 'The Learn REST doc URL to scrape.' }),
  handler: async (argv) => {
    try {
      const html = await fetchHtml(argv.learnUrl);
      const meta = scrapeHttpRequest(html);

      if (!meta || !meta.method || !meta.url) {
        throw new Error('Could not parse HTTP request section from Learn page.');
      }

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
    } catch (err) {
      console.error('endpoint add failed:', err.message);
      process.exit(1);
    }
  },
};

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
