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
    const {
      owner, stars, watchers, forks, created, updated, archived, language,
    } = tool.repositoryMetadata;

    return Object.assign(
      tool,
      {
        moreDetails: true,
        owner,
        language,
        stars: (stars || 'N/A'),
        watchers,
        forks,
        created,
        lastUpdated: updated,
        archived: archived ? 'Yes' : 'No',
      },
    );
  }

  return Object.assign(tool, { moreDetails: false, stars: 'N/A' });
};

module.exports = (toolList) => Object.entries(toolList
  .map((tool) => {
    const { category } = tool;

    if (!category) {
      return Object.assign(tool, { category: ['All', 'Unclassified'] });
    }

    return Object.assign(
      tool,
      { category: (Array.isArray(tool.category) ? tool.category : [tool.category]).concat(['All']) },
    );
  })
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
