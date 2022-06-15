const fs = require('fs');
const YAML = require('js-yaml');

module.exports = () => YAML.load(fs.readFileSync(`${__dirname}/tools.yaml`))
  .map((tool) => {
    let displayName = 'Not available';
    let displayDescription = 'Not available';

    if (tool.name) {
      displayName = Array.isArray(tool.name)
        ? tool.name[0] : tool.name;
    } else if (tool.repository) {
      displayName = tool.repository.split('/').pop();
    }

    if ((tool.repositoryMetadata || {}).description) {
      displayDescription = tool.repositoryMetadata.description;
    } else if (tool.source_description) {
      displayDescription = Array.isArray(tool.source_description)
        ? tool.source_description[0]
        : tool.source_description;
    }

    return {
      ...tool,
      displayDescription,
      displayName,
    };
  });
