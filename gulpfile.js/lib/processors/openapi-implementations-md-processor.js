const http = require('axios');

module.exports = async (source, url) => {
  const response = await http.get(url);
  let toolType;

  return response.data
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
        source,
        name: properties[0],
        homepage: properties[1].match(/http.*[a-z0-9A-Z/]+/).pop(),
        languages: properties[2]
          .split(',')
          .map((language) => language.trim()),
        description: properties[3],
        category: toolType,
      });
    }, []);
};
