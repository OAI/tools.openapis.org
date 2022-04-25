const Graphql = require('graphql-request').GraphQLClient;

const { logger } = require('../util');

const wrapper = async (client, topic, results, recursor) => {
  const query = `{
    search(type: REPOSITORY, query: "topic:${topic}", first: 100, ${recursor ? `after: "${recursor}"` : ''}) {
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
    await wrapper(client, topic, results, lastCursor);
  }

  return results;
};

module.exports = async (args) => {
  const results = [];
  const { title, topic, version } = args;

  if (!title || !topic || !version) {
    throw new Error(`Mandatory parameters missing when invoking ${__filename}`);
  }

  await wrapper(
    new Graphql('https://api.github.com/graphql', {
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.GH_API_USERNAME}:${process.env.GH_API_TOKEN}`).toString('base64')}`,
      },
    }),
    topic,
    results,
  );

  // Despite the pagination the GitHub query appears to return duplicates
  // Use a Set to dedup before returning with additional metadata
  const output = [...new Set(results)]
    .map((url) => ({ source: title, github: url, [version]: true }));

  logger(`Number of sources found tagged with ${topic}`, output.length);

  return output;
};
