const YAML = require('js-yaml');

const { getHash, logger } = require('../util');

module.exports = (rawSources) => {
  logger(__filename, 'purgeSources');

  const sources = YAML.load(rawSources);

  // List all repository URLs
  const allRepositories = sources
    .filter((source) => source.repository)
    .map((source) => source.repository);

  // Collect up any repositories that have been moved as a pointer ready for merging them with the
  // the new GitHub URL
  const newRepositoryLocations = sources
    .filter((source) => source.repositoryMetadata && source.repositoryMetadata.moved)
    .reduce((output, source) => {
      if (output[source.repositoryMetadata.newUrl]) {
        // eslint-disable-next-line no-param-reassign
        output[source.repositoryMetadata.newUrl] = output[source.repositoryMetadata.newUrl]
          .concat(source.repository);

        return output;
      }

      return Object.assign(
        output,
        { [source.repositoryMetadata.newUrl]: [source.repository] },
      );
    }, {});

  // Remove anything that is not found or has been moved. If a repository has been moved but the
  // new location is not in source then change the value of the source.repository property
  return YAML.dump(
    sources
      .map((source) => {
        const updatedSource = source;
        const newRepositoryLocation = newRepositoryLocations[source.repository];

        if (newRepositoryLocation) {
          // Source repository is updated to include old locations for tracking purposes

          // eslint-disable-next-line no-param-reassign
          updatedSource.oldLocations = [...new Set((source.oldLocations || [])
            .concat(newRepositoryLocations[source.repository]))];
        } else if ((source.repositoryMetadata || {}).moved
          && allRepositories.indexOf(source.repositoryMetadata.newUrl) === -1) {
          // Source repository has been moved but there is no data in the repository to move it to
          // Update the repository property with the new URL. This will then be ignored on the
          // next run and the updated repository value retained in the tools.yaml

          logger(`Moving repository metadata: ${source.repository} to new URL reference: ${updatedSource.repositoryMetadata.newUrl}`);

          updatedSource.oldLocations = [source.repository];
          updatedSource.repository = updatedSource.repositoryMetadata.newUrl;
          updatedSource.id = getHash(source.repository);

          delete updatedSource.repositoryMetadata.newUrl;
          delete updatedSource.repositoryMetadata.moved;
        }

        return updatedSource;
      })
      .filter((source) => {
        const { repositoryMetadata } = source;

        if (!repositoryMetadata || (!repositoryMetadata.notFound && !repositoryMetadata.moved)) {
          return true;
        }

        if (repositoryMetadata.notFound) {
          logger(`Removing repository as not found at target location: ${source.repository}`);
          return false;
        }

        logger(`Removing repository as it has been moved: ${source.repository} and is already catalogued at new URL reference: ${source.repositoryMetadata.newUrl}`);
        return false;
      }),
  );
};
