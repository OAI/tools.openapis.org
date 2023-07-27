const Promise = require('bluebird');
const YAML = require('js-yaml');

const { setGithubIssueState } = require('../repo');
const { logger } = require('../util');

module.exports = async (data) => {
  logger(__filename, 'closeToolingRepoIssues');

  const filename = __filename.split('/').pop();

  if (
    !process.env.GH_API_TOKEN
    || !process.env.GH_API_USERNAME
    || !process.env.TOOLING_REPOSITORY_OWNER
    || !process.env.TOOLING_REPOSITORY_REPO_NAME
  ) {
    throw new Error(`GH_API_TOKEN, GH_API_USERNAME, TOOLING_REPOSITORY_OWNER or TOOLING_REPOSITORY_REPO_NAME not set in environment when executing ${filename}`);
  }

  const concurrency = parseInt(process.env.GH_API_CONCURRENCY_LIMIT);

  if (!concurrency || Number.isNaN(concurrency)) {
    throw new Error('Concurrency limit is not set correctly or is not a number');
  }

  logger(`Concurrency limit for this run is set to ${concurrency} in ${filename}`);

  const outputData = await Promise.all(
    Promise.map(
      YAML.load(data),
      async (tool) => {
        if ((tool.sourceIssueMetadata || {}).status === 'open') {
          try {
            await setGithubIssueState(
              process.env.GH_API_USERNAME,
              process.env.GH_API_TOKEN,
              tool.sourceIssueMetadata.issueNumber,
              process.env.TOOLING_REPOSITORY_OWNER,
              process.env.TOOLING_REPOSITORY_REPO_NAME,
            );
            tool.sourceIssueMetadata.status = 'closed'; // eslint-disable-line no-param-reassign
          } catch (err) {
            // If closing the issue fails save data as is to ensure it gets reprocessed
            // Open issues that have already been processed will get mopped up on the next run
            return tool;
          }
        }

        return tool;
      },
      { concurrency },
    ),
  );

  return YAML.dump(outputData);
};
