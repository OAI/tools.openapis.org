const fs = require('fs');
const YAML = require('js-yaml');

module.exports = async (args) => {
  const { url } = args;

  if (!url) {
    throw new Error(`Mandatory parameters missing when invoking ${__filename}`);
  }

  return YAML.load(fs.readFileSync(url, 'utf-8'))
    .map((tool) => ({ ...tool, foundInMaster: true }));
};
