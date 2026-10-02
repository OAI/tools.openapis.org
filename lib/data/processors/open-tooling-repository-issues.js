const { GraphQLClient } = require('graphql-request');
const fs = require('fs');
const YAML = require('js-yaml');

const { logger } = require('../util');

const getOpenIssues = async (title, token, username, masterToolingIssues) => {
  const getVersionSupport = (bodyText, version) => {
    const match = bodyText.match(new RegExp(`^- +${version.replace('.', '\\.')}: +(true|false) *$`, 'mi'));

    return match ? match[1].toLowerCase() === 'true' : false;
  };

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

  const removeFormatting = (text) => text.replace(/\*|_/g, '').trim();
  const getField = (bodyText, field) => {
    const lines = bodyText.split(/\r?\n/);
    const start = lines.findIndex((line) => new RegExp(`^- +${field}:`, 'i').test(line));

    if (start === -1) {
      return '';
    }

    const firstLine = lines[start].replace(new RegExp(`^- +${field}: *`, 'i'), '');
    const continuation = lines.slice(start + 1)
      .findIndex((line) => /^- +[^:]+:|^## +/.test(line));
    const end = continuation === -1 ? lines.length : start + 1 + continuation;

    return removeFormatting([firstLine, ...lines.slice(start + 1, end)]
      .filter((line) => line.trim())
      .join(' '));
  };

  // Filter for issues that look like tooling requests (unfortunately no means to filter on the
  // the original template used which would been ideal). Remove anything that already appears in
  // the list from a previous run
  return issues.nodes
    .filter(({ number }) => masterToolingIssues.indexOf(number) === -1)
    .filter((node) => typeof node.body === 'string' && /## +Tool +Properties/.test(node.body))
    .reduce((cleanedIssues, node) => {
      const name = getField(node.body, 'Display +name');
      const sourceDescription = getField(node.body, 'Description');
      const link = getField(node.body, 'Homepage');
      const v31 = getVersionSupport(node.body, '3.1');
      const v3 = getVersionSupport(node.body, '3.0');
      const v2 = getVersionSupport(node.body, '2.0');

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
        source_description: sourceDescription,
        link,
        v3_1: v31,
        v3,
        v2,
        sourceIssueMetadata: {
          issueNumber,
          author: node.author ? node.author.login : null,
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
