const http = require('axios');
const YAML = require('js-yaml');

module.exports = async (source, url) => {
  const response = await http.get(url);

  return YAML.load(response.data).map((tool) => ({ source, ...tool }));
};
