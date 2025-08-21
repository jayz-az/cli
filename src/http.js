const axios = require('axios');

async function azRequest({ method, url, token, params, body }) {
  const headers = {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
  };

  const resp = await axios.request({
    method,
    url,
    headers,
    params,
    data: body,
    validateStatus: () => true,
  });

  return {
    status: resp.status,
    headers: resp.headers,
    data: resp.data,
  };
}

module.exports = {
  azRequest,
};
