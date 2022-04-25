const http = require('axios');

const { logger } = require('../util');

module.exports = async (args) => {
  const { title, url } = args;

  if (!title || !url) {
    throw new Error(`Mandatory parameters missing when invoking ${__filename}`);
  }

  const response = await http.get(url, { timeout: 5000 });
  let toolType;

  const tools = response.data
    .split('\n')
    .filter((line) => line.match(/^(\| |#{4})/))
    .filter((line) => !line.match(/^(\| +Title|\| *-+)/))
    .reduce((output, line) => {
      if (line.match(/^#{4}/)) {
        toolType = line.replace(/#+ +/, '');
        return output;
      }

      const properties = line.split('|')
        .filter((attribute) => !attribute.match(/^ *$/))
        .map((attribute) => attribute.trim());

      return output.concat({
        source: title,
        name: properties[0],
        homepage: properties[1].match(/http.*[a-z0-9A-Z/]+/).pop(),
        languages: properties[2]
          .split(',')
          .map((language) => language.trim()),
        description: properties[3],
        category: toolType,
      });
    }, []);

  logger(`Number of sources found in ${title}`, tools.length);

  return tools;
};
