const Graphql = require('graphql-request').GraphQLClient;

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
      }
    }
  }`;
  const data = await client.request(query);
  let lastCursor;

  data.search.edges
    .forEach((edge) => {
      const { url } = edge.node;
      const { cursor } = edge;

      lastCursor = cursor;
      results.push({ source, github: url, v3: true });
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
        Authorization: `Basic ${Buffer.from(`${process.env.GITHUB_USER}:${process.env.GITHUB_TOKEN}`).toString('base64')}`,
      },
    }),
    results,
  );

  return results;
};
