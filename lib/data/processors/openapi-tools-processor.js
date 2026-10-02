const { GraphQLClient } = require('graphql-request');
const YAML = require('js-yaml');

const { logger } = require('../util');

const query = `query OpenApiTools($owner: String!, $repository: String!, $expression: String!) {
  repository(owner: $owner, name: $repository) {
    object(expression: $expression) {
      ... on Tree {
        entries {
          name
          object {
            ... on Blob {
              text
            }
          }
        }
      }
    }
  }
}`;

const parseFrontMatter = (text) => {
  const match = text && text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);

  return match ? YAML.load(match[1]) : null;
};

const normaliseTool = (title, tool) => {
  const languages = Object.entries(tool.languages || {})
    .filter(([, supported]) => supported)
    .map(([language]) => (language === 'saas' ? 'SaaS' : language));
  const versions = tool.oasVersions || {};

  return {
    source: title,
    name: tool.name,
    description: tool.description,
    category: tool.categories,
    link: tool.link,
    github: tool.repo,
    language: languages.length > 0 ? languages.join(', ') : undefined,
    v2: versions.v2,
    v3: versions.v3,
    v3_1: versions.v3_1,
    v3_2: versions.v3_2,
  };
};

module.exports = async (args) => {
  const {
    title, repositoryOwner, repositoryName, ref = 'main', path = 'src/content/tools',
  } = args || {};

  if (!title || !repositoryOwner || !repositoryName) {
    throw new Error(`Mandatory parameters missing when invoking ${__filename}`);
  }

  if (!process.env.GH_API_USERNAME || !process.env.GH_API_TOKEN) {
    throw new Error(`GH_API_USERNAME or GH_API_TOKEN not set when invoking ${__filename}`);
  }

  const client = new GraphQLClient('https://api.github.com/graphql', {
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.GH_API_USERNAME}:${process.env.GH_API_TOKEN}`).toString('base64')}`,
    },
  });
  const response = await client.request(query, {
    owner: repositoryOwner,
    repository: repositoryName,
    expression: `${ref}:${path}`,
  });
  const entries = (((response || {}).repository || {}).object || {}).entries || [];
  const data = entries
    .filter((entry) => entry.name.endsWith('.md') && entry.object && entry.object.text)
    .map((entry) => parseFrontMatter(entry.object.text))
    .filter((tool) => tool && tool.name)
    .map((tool) => normaliseTool(title, tool));

  logger(`Number of sources found in ${title}`, data.length);

  return data;
};
