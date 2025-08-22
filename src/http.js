const axios = require('axios');

async function azRequest({ method, url, token, params, body }) {
  const resp = await axios.request({
    method, url, params, data: body,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    validateStatus: () => true,
  });
  if (resp.status >= 200 && resp.status < 300) return resp;
  const err = new Error('HTTP ' + resp.status);
  err.response = resp;
  throw err;
}

module.exports = { azRequest };
