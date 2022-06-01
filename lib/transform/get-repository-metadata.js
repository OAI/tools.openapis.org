const Promise = require('bluebird');
const YAML = require('js-yaml');

const { getGithubRepositoryMetadata } = require('../repo');
const { logger } = require('../util');

/**
 * Retrieve metadata from all GitHub repositories listed in tools stream
 *
 * Note this uses the Bluebird Promise to provide access to the concurrency
 * limit on the map function. This is important as it allows the calls to the
 * GitHub API to be regulated
 *
 * @param {string} rawNormalisedData Raw YAML data from Gulp file stream
 * @returns {string} Raw YAML data to return to Gulp stream
 */
module.exports = async (rawNormalisedData) => {
  logger(__filename, 'getRepositoryMetadata');

  const concurrency = parseInt(process.env.GH_API_CONCURRENCY_LIMIT);

  if (!concurrency || Number.isNaN(concurrency)) {
    throw new Error('Concurrency limit is not set correctly or is not a number');
  }

  logger(`Concurrency limit for this run is set to ${concurrency}`);

  const normalisedData = YAML.load(rawNormalisedData);
  const enrichedData = await Promise.all(
    Promise.map(
      normalisedData,
      async (source) => {
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
      },
      { concurrency },
    ),
  );

  return YAML.dump(enrichedData);
};
