const { GraphQLClient } = require('graphql-request');
const fs = require('fs');
const YAML = require('js-yaml');

const { logger } = require('../util');

const getOpenIssues = async (title, token, username, masterToolingIssues) => {
  const getVersionSupport = (bodyText, regex) => ((bodyText.match(regex)[0] || false).match(/true|false/)[0] || 'false') === 'true';

  const client = new GraphQLClient('https://api.github.com/graphql', {
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`,
    },
  });
  const query = `{
    repository(owner: "${process.env.TOOLING_REPOSITORY_OWNER}", name: "${process.env.TOOLING_REPOSITORY_REPO_NAME}") {
      issues(states: OPEN, first: 100) {
        nodes {
          number
          title
          body
          createdAt
          updatedAt
          author {
            login
          },
          url
        }
      }
    }
  }`;

  const { issues } = ((await client.request(query)) || {}).repository;

  const removeFormatting = (text) => text.replace(/\*|_/g, '');

  // Filter for issues that look like tooling requests (unfortunately no means to filter on the
  // the original template used which would been ideal). Remove anything that already appears in
  // the list from a previous run
  return issues.nodes
    .filter(({ number }) => masterToolingIssues.indexOf(number) === -1)
    .filter((node) => /## +Tool +Properties/.test(node.body))
    .reduce((cleanedIssues, node) => {
      const name = removeFormatting((node.body.match(/- Display +name:.+?\r\n/)[0] || '')
        .replace(/- Display +name: *|\r\n/g, ''));
      const sourceDescription = node.body.split('\r\n')
        .reduce((output, line) => {
          // Start of description so collect data
          if (/- +Description: .+/.test(line)) {
            return Object.assign(output, { text: removeFormatting(line), collect: true });
          }

          if (/- +Homepage: +/.test(line)) {
            return Object.assign(output, { text: output.text, collect: false });
          }

          if (output.collect) {
            return Object.assign(output, { text: output.text + line, collect: true });
          }

          return output;
        }, { text: '', collect: false }).text;
      const link = (node.body.match(/- Homepage:.+?\r\n/)[0] || '')
        .replace(/- Homepage: *|\r\n/g, '');
      const v31 = getVersionSupport(node.body, /- +3\.1: +(true|false)/);
      const v3 = getVersionSupport(node.body, /- +3\.0: +(true|false)/);
      const v2 = getVersionSupport(node.body, /- +2\.0: +(true|false)/);

      const {
        number: issueNumber, createdAt, updatedAt, url,
      } = node;

      // Check that everything grabbed correctly from body text
      if (!name || !sourceDescription || !link || !(v31 || v3 || v2)) {
        logger(`Could not process issue as information missing or format of issue invalid: ${url}`);
        logger(JSON.stringify({
          name, sourceDescription, link, v31, v3, v2,
        }));
        return cleanedIssues;
      }

      // Validate the link
      try {
        const validatedLink = new URL(link); // eslint-disable-line no-unused-vars
      } catch (err) {
        logger(`Could not process issue as link to tool homepage is invalid: ${link}`);
        return cleanedIssues;
      }

      return cleanedIssues.concat({
        name,
        source: [title],
        source_description: sourceDescription.replace(/.*Description: */, ''),
        link,
        v3_1: v31,
        v3,
        v2,
        sourceIssueMetadata: {
          issueNumber,
          author: node.author.login,
          createdAt,
          updatedAt,
          url,
          status: 'open',
        },
      });
    }, []);
};

module.exports = async (args) => {
  const { title, masterDataFileName } = args || {};

  if (!title || !masterDataFileName) {
    throw new Error(`Mandatory parameters missing when executing ${__filename.split('/').pop()}: [title] [masterDataFileName]`);
  }

  if (!process.env.GH_API_TOKEN
    || !process.env.GH_API_USERNAME
    || !process.env.TOOLING_REPOSITORY_OWNER
    || !process.env.TOOLING_REPOSITORY_REPO_NAME) {
    throw new Error(`GH_API_TOKEN, GH_API_USERNAME, TOOLING_REPOSITORY_OWNER or TOOLING_REPOSITORY_REPO_NAME not set in environment when executing ${__filename.split('/').pop()}`);
  }

  const masterToolingIssues = YAML.load(fs.readFileSync(masterDataFileName, 'utf8'))
    .filter((tool) => tool.sourceIssueMetadata)
    .map((tool) => tool.sourceIssueMetadata.issueNumber);

  const openIssues = [...new Set(
    await getOpenIssues(
      title,
      process.env.GH_API_TOKEN,
      process.env.GH_API_USERNAME,
      masterToolingIssues,
    ),
  )];

  logger(`Number of open issues to add tools found at Tooling repository ${openIssues.length}`);

  return openIssues;
};
