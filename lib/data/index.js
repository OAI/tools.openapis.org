const {
  classifyTools,
  closeToolingRepoIssues,
  validateMetadata,
  getRepositoryMetadata,
  readLocalSourceData,
  readSourceData,
  mergeSources,
  normaliseSources,
  purgeSources,
} = require('./transform');
const { logger } = require('./util');

module.exports = {
  classifyTools,
  closeToolingRepoIssues,
  validateMetadata,
  getRepositoryMetadata,
  readLocalSourceData,
  readSourceData,
  logger,
  mergeSources,
  normaliseSources,
  purgeSources,
};
