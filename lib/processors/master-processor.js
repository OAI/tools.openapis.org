const fs = require('fs');
const YAML = require('js-yaml');

module.exports = async (source, url) => YAML.load(fs.readFileSync(url, 'utf-8'))
  .map((tool) => ({ ...tool, foundInMaster: true }));
