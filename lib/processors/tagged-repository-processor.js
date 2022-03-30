const Graphql = require('graphql-request').GraphQLClient;

const { logger } = require('../util');

const wrapper = async (source, client, results, recursor) => {
  const query = `{
    search(type: REPOSITORY, query: "topic:openapi3", first: 100, ${recursor ? `after: "${recursor}"` : ''}) {
      edges{
        node {
          ... on Repository {
            url
          }
        },
        cursor
      },
      pageInfo {
        endCursor
      }
    },
    rateLimit {
      limit
      cost
      remaining
      resetAt
    }
  }`;
  const data = await client.request(query);
  const lastCursor = data.search.pageInfo.endCursor;

  data.search.edges
    .forEach((edge) => {
      const { url } = edge.node;

      results.push(url);
    });

  if (lastCursor) {
    await wrapper(source, client, results, lastCursor);
  }

  return results;
};

module.exports = async (source) => {
  const results = [];

  await wrapper(
    source,
    new Graphql('https://api.github.com/graphql', {
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.GITHUB_ACTOR}:${process.env.GITHUB_TOKEN}`).toString('base64')}`,
      },
    }),
    results,
  );

  // Despite the pagination the GitHub query appears to return duplicates
  // Use a Set to dedup before returning with additional metadata
  const output = [...new Set(results)]
    .map((url) => ({ source, github: url, v3: true }));

  logger('Number of sources found tagged with openapi3', output.length);

  return output;
};
