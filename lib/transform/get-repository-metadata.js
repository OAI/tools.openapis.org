const YAML = require('js-yaml');

const { getGithubRepositoryMetadata } = require('../repo');
const { logger } = require('../util');

module.exports = async (rawNormalisedData) => {
  logger(__filename, 'getRepositoryMetadata');

  const normalisedData = YAML.load(rawNormalisedData);
  const enrichedData = await Promise.all(normalisedData
    .map(async (source) => {
      if (source.repository && typeof source.repository === 'string' && source.repository.match(/github\.com/)) {
        logger(`Retrieving GitHub metadata for: ${source.repository}`);
        const metadata = await getGithubRepositoryMetadata(
          source.repository,
          process.env.GH_API_USERNAME,
          process.env.GH_API_TOKEN,
          source.repositoryMetadata,
        );
        logger(`Successfully retrieved GitHub metadata for: ${source.repository}`);
        return { ...source, ...metadata };
      }

      return source;
    }));

  return YAML.dump(enrichedData);
};
