const { GraphQLClient } = require('graphql-request');

const { logger } = require('../util');

const FIRST_GITHUB_DATE = '2007-01-01';
const GITHUB_SEARCH_LIMIT = 1000;

const query = `query TaggedRepositories($searchQuery: String!, $after: String) {
  search(type: REPOSITORY, query: $searchQuery, first: 100, after: $after) {
    repositoryCount
    edges {
      node {
        ... on Repository {
          url
        }
      }
    }
    pageInfo {
      endCursor
      hasNextPage
    }
  }
}`;

const addDays = (value, days) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const midpoint = (start, end) => {
  const startTime = new Date(`${start}T00:00:00Z`).getTime();
  const endTime = new Date(`${end}T00:00:00Z`).getTime();
  return new Date(startTime + Math.floor((endTime - startTime) / 2))
    .toISOString().slice(0, 10);
};

const collectSearch = async (client, searchQuery) => {
  const results = [];
  let after = null;
  let repositoryCount;

  do {
    // eslint-disable-next-line no-await-in-loop
    const data = await client.request(query, { searchQuery, after });
    const { search } = data;

    repositoryCount = search.repositoryCount;
    if (repositoryCount > GITHUB_SEARCH_LIMIT) {
      return { repositoryCount, results: [] };
    }

    search.edges.forEach((edge) => results.push(edge.node.url));
    after = search.pageInfo.hasNextPage ? search.pageInfo.endCursor : null;
  } while (after);

  return { repositoryCount, results };
};

const collectRange = async (client, topic, start, end) => {
  const search = await collectSearch(client, `topic:${topic} created:${start}..${end}`);

  if (search.repositoryCount <= GITHUB_SEARCH_LIMIT) {
    return search.results;
  }

  if (start === end) {
    throw new Error(`More than ${GITHUB_SEARCH_LIMIT} repositories tagged ${topic} were created on ${start}; the GitHub search cannot be split further`);
  }

  const split = midpoint(start, end);
  const [older, newer] = await Promise.all([
    collectRange(client, topic, start, split),
    collectRange(client, topic, addDays(split, 1), end),
  ]);

  return older.concat(newer);
};

module.exports = async (args) => {
  const { title, topic, version } = args || {};

  if (!title || !topic || !version) {
    throw new Error(`Mandatory parameters missing when invoking ${__filename}`);
  }

  const client = new GraphQLClient('https://api.github.com/graphql', {
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.GH_API_USERNAME}:${process.env.GH_API_TOKEN}`).toString('base64')}`,
    },
  });
  const unbounded = await collectSearch(client, `topic:${topic}`);
  const results = unbounded.repositoryCount > GITHUB_SEARCH_LIMIT
    ? await collectRange(
      client,
      topic,
      FIRST_GITHUB_DATE,
      new Date().toISOString().slice(0, 10),
    )
    : unbounded.results;
  const output = [...new Set(results)]
    .map((url) => ({ source: title, github: url, [version]: true }));

  logger(`Number of sources found tagged with ${topic}`, output.length);

  return output;
};
