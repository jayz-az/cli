
const http = require('http');
const { URLSearchParams } = require('url');
const crypto = require('crypto');
const child_process = require('child_process');
const axios = require('axios');
const { writeConfig, mergeConfig } = require('./config');

const MANAGEMENT_SCOPE = 'https://management.azure.com/.default';
const REDIRECT_PORT = 63265;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

function buildAuthority(tenantId, authorityHost) {
  const host = authorityHost || 'https://login.microsoftonline.com';
  return host.replace(/\/+$/, '') + '/' + tenantId;
}

function base64url(input) {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function genPkce() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function openBrowser(url) {
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      child_process.spawn('open', [url], { stdio: 'ignore', detached: true });
    } else if (platform === 'win32') {
      child_process.spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true });
    } else {
      child_process.spawn('xdg-open', [url], { stdio: 'ignore', detached: true });
    }
  } catch (e) {
    console.error('Please open this URL in your browser:', url);
  }
}

async function startLocalServerForCode() {
  const server = http.createServer();
  let resolveCode, rejectCode;
  const waitForCode = new Promise((resolve, reject) => { resolveCode = resolve; rejectCode = reject; });

  server.on('request', (req, res) => {
    try {
      // Always resolve relative to localhost + fixed port
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      if (url.pathname !== '/callback') {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      const code = url.searchParams.get('code');
      const err = url.searchParams.get('error_description') || url.searchParams.get('error');
      if (err) {
        res.statusCode = 400;
        res.end('Login failed. You may close this window.');
        rejectCode(new Error(err));
        server.close();
        return;
      }
      res.statusCode = 200;
      res.end('Login complete. You may close this window.');
      resolveCode(code);
      server.close();
    } catch (e) {
      try { res.statusCode = 500; res.end('Error'); } catch (_) {}
      rejectCode(e);
      server.close();
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', (e) => {
      if (e && e.code === 'EADDRINUSE') {
        reject(new Error(`Port ${REDIRECT_PORT} is in use. Close the app using it and retry.`));
      } else {
        reject(e);
      }
    });
    // Bind without hostname to support IPv4/IPv6; redirect uses localhost
    server.listen(REDIRECT_PORT, () => resolve());
  });

  return waitForCode;
}

async function loginWithBrowser(flags) {
  const cfg = mergeConfig(flags);
  if (!cfg.clientId) throw new Error('Browser login requires --client-id or JAYZ_CLIENT_ID in env or config.json');
  if (!cfg.tenantId) throw new Error('Browser login requires --tenant-id or JAYZ_TENANT_ID in env or config.json');

  const authority = buildAuthority(cfg.tenantId, cfg.authorityHost);

  // Start local server waiting for code
  const waitForCode = startLocalServerForCode();

  const pkce = genPkce();
  const authParams = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    response_mode: 'query',
    scope: `${MANAGEMENT_SCOPE} offline_access openid profile`,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });

  const authUrl = `${authority}/oauth2/v2.0/authorize?${authParams.toString()}`;
  console.log('Opening browser for login...');
  openBrowser(authUrl);

  const authCode = await waitForCode;

  // exchange code for tokens
  const tokenParams = new URLSearchParams({
    client_id: cfg.clientId,
    scope: `${MANAGEMENT_SCOPE} offline_access`,
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: REDIRECT_URI,
    code_verifier: pkce.verifier,
  });
  if (cfg.clientSecret) {
    tokenParams.append('client_secret', cfg.clientSecret);
  }

  const tokenUrl = `${authority}/oauth2/v2.0/token`;
  const tokenResp = await axios.post(tokenUrl, tokenParams.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    validateStatus: () => true,
  });

  if (tokenResp.status < 200 || tokenResp.status >= 300) {
    const e = tokenResp.data || {};
if (e.error === 'invalid_client') {
  throw new Error("Token exchange failed: invalid_client. Your app is configured as a confidential client. Either set JAYZ_CLIENT_SECRET (or --client-secret) and add a Web redirect 'http://localhost:63265/callback' to the app registration, or switch to --mode secret.");
} else {
  throw new Error('Token exchange failed: ' + JSON.stringify(tokenResp.data));
}
  }

  const body = tokenResp.data;
  const toSave = {
    clientId: cfg.clientId,
    tenantId: cfg.tenantId,
    subscriptionId: cfg.subscriptionId,
    tokenType: 'browser_oauth',
    accessToken: body.access_token || null,
    refreshToken: body.refresh_token || null,
    expiresOn: body.expires_in ? new Date(Date.now() + body.expires_in * 1000).toISOString() : null,
    authorityHost: cfg.authorityHost,
  };

  writeConfig(Object.assign(mergeConfig({}), toSave));
  return toSave;
}

async function refreshWithRefreshToken(cfg) {
  if (!cfg.refreshToken) throw new Error('Missing refresh token. Please run `jayz login` again.');
  const authority = buildAuthority(cfg.tenantId, cfg.authorityHost);
  const tokenParams = new URLSearchParams({
    client_id: cfg.clientId,
    scope: `${MANAGEMENT_SCOPE} offline_access`,
    grant_type: 'refresh_token',
    refresh_token: cfg.refreshToken,
  });
  if (cfg.clientSecret) {
    tokenParams.append('client_secret', cfg.clientSecret);
  }

  const tokenUrl = `${authority}/oauth2/v2.0/token`;
  const tokenResp = await axios.post(tokenUrl, tokenParams.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    validateStatus: () => true,
  });

  if (tokenResp.status < 200 || tokenResp.status >= 300) {
    throw new Error('Refresh token failed: ' + JSON.stringify(tokenResp.data));
  }

  const body = tokenResp.data;
  const updated = Object.assign({}, cfg, {
    accessToken: body.access_token || null,
    refreshToken: body.refresh_token || cfg.refreshToken,
    expiresOn: body.expires_in ? new Date(Date.now() + body.expires_in * 1000).toISOString() : null,
  });
  writeConfig(updated);
  return updated.accessToken;
}

// Optional alt modes for completeness
async function loginWithDeviceCode(flags) {
  const msal = require('msal-node');
  const { LogLevel, PublicClientApplication } = msal;
  const cfg = mergeConfig(flags);

  if (!cfg.clientId) {
    throw new Error('Device code flow requires --client-id or JAYZ_CLIENT_ID');
  }
  if (!cfg.tenantId) {
    throw new Error('Device code flow requires --tenant-id or JAYZ_TENANT_ID');
  }

  const pca = new PublicClientApplication({
    auth: {
      clientId: cfg.clientId,
      authority: buildAuthority(cfg.tenantId, cfg.authorityHost),
    },
    system: { loggerOptions: { logLevel: LogLevel.Warning } },
  });

  const result = await pca.acquireTokenByDeviceCode({
    deviceCodeCallback: (msg) => {
      console.log(msg.message);
    },
    scopes: [MANAGEMENT_SCOPE],
  });

  const toSave = {
    clientId: cfg.clientId,
    tenantId: cfg.tenantId,
    subscriptionId: cfg.subscriptionId,
    tokenType: 'device_code',
    accessToken: result.accessToken || null,
    expiresOn: result.expiresOn?.toISOString?.() || null,
    authorityHost: cfg.authorityHost,
  };

  writeConfig(Object.assign(mergeConfig({}), toSave));
  return toSave;
}

async function loginWithClientSecret(flags) {
  const msal = require('msal-node');
  const { ConfidentialClientApplication, LogLevel } = msal;
  const cfg = mergeConfig(flags);
  const required = ['clientId', 'clientSecret', 'tenantId'];
  required.forEach((k) => {
    if (!cfg[k]) throw new Error('Missing ' + k + ' (env, file, or flag).');
  });

  const cca = new ConfidentialClientApplication({
    auth: {
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      authority: buildAuthority(cfg.tenantId, cfg.authorityHost),
    },
    system: { loggerOptions: { logLevel: LogLevel.Warning } },
  });

  const result = await cca.acquireTokenByClientCredential({
    scopes: [MANAGEMENT_SCOPE],
  });

  const toSave = {
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    tenantId: cfg.tenantId,
    subscriptionId: cfg.subscriptionId,
    tokenType: 'client_secret',
    accessToken: result?.accessToken || null,
    expiresOn: result?.expiresOn ? new Date(result.expiresOn * 1000).toISOString() : null,
    authorityHost: cfg.authorityHost,
  };

  writeConfig(Object.assign(mergeConfig({}), toSave));
  return toSave;
}

async function getAccessToken(flags) {
  const cfg = mergeConfig(flags);
  if (!cfg.tenantId || !cfg.clientId) {
    throw new Error('Not logged in. Run: jayz login');
  }

  if (cfg.tokenType === 'client_secret' && cfg.clientSecret) {
    const msal = require('msal-node');
    const { ConfidentialClientApplication } = msal;
    const cca = new ConfidentialClientApplication({
      auth: {
        clientId: cfg.clientId,
        clientSecret: cfg.clientSecret,
        authority: buildAuthority(cfg.tenantId, cfg.authorityHost),
      },
    });
    const result = await cca.acquireTokenByClientCredential({ scopes: [MANAGEMENT_SCOPE] });
    return result.accessToken;
  }

  if (cfg.tokenType === 'browser_oauth' && cfg.refreshToken) {
    return await refreshWithRefreshToken(cfg);
  }

  if (cfg.tokenType === 'device_code') {
    const res = await loginWithDeviceCode(cfg);
    return res.accessToken;
  }

  if (cfg.refreshToken) {
    return await refreshWithRefreshToken(cfg);
  }

  throw new Error('Unsupported token state. Please run `jayz login` again.');
}

module.exports = {
  loginWithBrowser,
  loginWithDeviceCode,
  loginWithClientSecret,
  getAccessToken,
};
