const { GraphQLClient } = require('graphql-request');
const chai = require('chai');
const sinon = require('sinon');

chai.use(require('chai-as-promised'));

const { expect } = chai;

const fn = require('../../../../../lib/data/processors/tagged-repository-processor');

const response = (repositoryCount, urls, endCursor = null) => ({
  search: {
    repositoryCount,
    edges: urls.map((url) => ({ node: { url } })),
    pageInfo: {
      endCursor,
      hasNextPage: Boolean(endCursor),
    },
  },
});

describe(__filename, () => {
  const sandbox = sinon.createSandbox();
  let graphQlClientStub;

  beforeEach(() => {
    graphQlClientStub = sandbox.stub(GraphQLClient.prototype, 'request');
  });
  afterEach(() => sandbox.restore());

  it('Throws an error when required parameters are missing', async () => {
    await expect(fn()).to.be.rejectedWith('Mandatory parameters missing');
  });

  it('Paginates through a topic search and removes duplicate repositories', async () => {
    graphQlClientStub.onCall(0).resolves(response(
      3,
      ['https://github.com/example/one', 'https://github.com/example/two'],
      'next-page',
    ));
    graphQlClientStub.onCall(1).resolves(response(
      3,
      ['https://github.com/example/two', 'https://github.com/example/three'],
    ));

    await expect(fn({
      title: 'openapi3 tags',
      topic: 'openapi3',
      version: 'v3',
    })).to.eventually.deep.equal([
      { source: 'openapi3 tags', github: 'https://github.com/example/one', v3: true },
      { source: 'openapi3 tags', github: 'https://github.com/example/two', v3: true },
      { source: 'openapi3 tags', github: 'https://github.com/example/three', v3: true },
    ]);

    expect(graphQlClientStub.firstCall.args[1]).to.deep.equal({
      searchQuery: 'topic:openapi3',
      after: null,
    });
    expect(graphQlClientStub.secondCall.args[1]).to.deep.equal({
      searchQuery: 'topic:openapi3',
      after: 'next-page',
    });
  });

  it('Splits searches that exceed GitHub\'s 1,000-result limit into date ranges', async () => {
    graphQlClientStub.onCall(0).resolves(response(1001, []));
    graphQlClientStub.onCall(1).resolves(response(1001, []));
    graphQlClientStub.onCall(2).resolves(response(1, ['https://github.com/example/older']));
    graphQlClientStub.onCall(3).resolves(response(1, ['https://github.com/example/newer']));

    await expect(fn({
      title: 'openapi3 tags',
      topic: 'openapi3',
      version: 'v3',
    })).to.eventually.deep.equal([
      { source: 'openapi3 tags', github: 'https://github.com/example/older', v3: true },
      { source: 'openapi3 tags', github: 'https://github.com/example/newer', v3: true },
    ]);

    const olderQuery = graphQlClientStub.getCall(2).args[1].searchQuery;
    const newerQuery = graphQlClientStub.getCall(3).args[1].searchQuery;

    expect(olderQuery).to.match(/^topic:openapi3 created:2007-01-01\.\.[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
    expect(newerQuery).to.match(/^topic:openapi3 created:[0-9]{4}-[0-9]{2}-[0-9]{2}\.\.[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
  });
});
