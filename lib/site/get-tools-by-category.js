const setUnclassified = require('./set-unclassified');

const setDisplayProperties = (sourceTool) => {
  const tool = sourceTool;

  // eslint-disable-next-line no-nested-ternary
  tool.swagger = tool.v2 === null ? 'Unknown' : (tool.v2 ? 'Yes' : 'No');

  // eslint-disable-next-line no-nested-ternary
  tool.version30 = tool.v3 === null ? 'Unknown' : (tool.v3 ? 'Yes' : 'No');

  // eslint-disable-next-line no-nested-ternary
  tool.version31 = tool.v3_1 === null ? 'Unknown' : (tool.v3_1 ? 'Yes' : 'No');

  tool.homepage = tool.homepage || tool.link;

  if ((!tool.repository || tool.repository.trim() === '') && tool.homepage.match(/.*github\.com/)) {
    tool.repository = tool.homepage;
  }

  if (tool.repositoryMetadata) {
    tool.owner = tool.repositoryMetadata.owner;
    tool.stars = tool.repositoryMetadata.stars;
    tool.watchers = tool.repositoryMetadata.watchers;
    tool.forks = tool.repositoryMetadata.forks;
    tool.created = tool.repositoryMetadata.created;
    tool.lastUpdated = tool.repositoryMetadata.updated;

    if (tool.repositoryMetadata.base64Readme) {
      tool.readMe = Buffer.from(tool.repositoryMetadata.base64Readme, 'base64').toString('utf8');
    }
  } else {
    tool.owner = 'N/A';
    tool.stars = 'N/A';
    tool.watchers = 'N/A';
    tool.forks = 'N/A';
    tool.created = 'N/A';
    tool.lastUpdated = 'N/A';
    tool.readMe = 'N/A';
  }

  return tool;
};

module.exports = (toolList) => Object.entries(toolList
  .reduce((output, tool) => {
    const update = output;

    if (!tool.category) {
      const category = setUnclassified();

      update[category] = (update[category] || []).concat([setDisplayProperties(tool)]);

      return update;
    }

    (Array.isArray(tool.category) ? tool.category : [tool.category])
      .forEach((c) => {
        const category = setUnclassified(c);

        update[category] = (update[category] || []).concat([setDisplayProperties(tool)]);
      });

    return update;
  }, {}))
  .map(([category, tools]) => ({ category, tools }));
