const http = require('axios');
const YAML = require('js-yaml');

const { logger } = require('../util');

module.exports = async (source, url) => {
  const response = await http.get(url, { timeout: 5000 });
  const data = YAML.load(response.data);

  logger('Number of sources found in openapi.tools', data.length);

  return data.map((tool) => ({ source, ...tool }));
};
