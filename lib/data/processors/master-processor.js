const fs = require('fs');
const YAML = require('js-yaml');

const { logger } = require('../util');

module.exports = async (args) => {
  const { url } = args;

  if (!url) {
    throw new Error(`Mandatory parameters missing when invoking ${__filename}`);
  }

  const tools = YAML.load(fs.readFileSync(url, 'utf-8'))
    .map((tool) => ({ ...tool, foundInMaster: true }));

  logger('Number of sources found in master', tools.length);

  return tools;
};
