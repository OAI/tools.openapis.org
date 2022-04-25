const http = require('axios');
const YAML = require('js-yaml');

const { logger } = require('../util');

module.exports = async (args) => {
  const { title, url } = args;

  if (!title || !url) {
    throw new Error(`Mandatory parameters missing when invoking ${__filename}`);
  }

  const response = await http.get(url, { timeout: 5000 });
  const data = YAML.load(response.data);

  logger(`Number of sources found in ${title}`, data.length);

  return data.map((tool) => ({ source: title, ...tool }));
};
