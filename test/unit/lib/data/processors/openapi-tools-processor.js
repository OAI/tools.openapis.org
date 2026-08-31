const { GraphQLClient } = require('graphql-request');
const chai = require('chai');
const sinon = require('sinon');

chai.use(require('chai-as-promised'));

const { expect } = chai;

const fn = require('../../../../../lib/data/processors/openapi-tools-processor');

describe(__filename, () => {
  const sandbox = sinon.createSandbox();
  let graphQlClientStub;

  beforeEach(() => {
    process.env.GH_API_USERNAME = 'test-user';
    process.env.GH_API_TOKEN = 'test-token';
    graphQlClientStub = sandbox.stub(GraphQLClient.prototype, 'request');
  });
  afterEach(() => sandbox.restore());

  it('Throws an error when required parameters are missing', async () => {
    await expect(fn()).to.be.rejectedWith('Mandatory parameters missing');
  });

  it('Reads and normalises tool front matter from the upstream repository', async () => {
    graphQlClientStub.resolves({
      repository: {
        object: {
          entries: [
            {
              name: 'sourcey.md',
              object: {
                text: `---
name: Sourcey
description: Static documentation from OpenAPI and Markdown.
categories:
  - docs
  - mcp
link: https://sourcey.com/
repo: https://github.com/sourcey/sourcey
languages:
  nodejs: true
  typescript: true
  saas: false
oasVersions:
  v2: true
  v3: true
  v3_1: true
  v3_2: true
---
`,
              },
            },
            { name: 'README.txt', object: { text: 'Not a tool' } },
            { name: 'invalid.md', object: { text: 'Missing front matter' } },
          ],
        },
      },
    });

    await expect(fn({
      title: 'https://openapi.tools/',
      repositoryOwner: 'apisyouwonthate',
      repositoryName: 'openapi.tools',
      ref: 'main',
      path: 'src/content/tools',
    })).to.eventually.deep.equal([
      {
        source: 'https://openapi.tools/',
        name: 'Sourcey',
        description: 'Static documentation from OpenAPI and Markdown.',
        category: ['docs', 'mcp'],
        link: 'https://sourcey.com/',
        github: 'https://github.com/sourcey/sourcey',
        language: 'nodejs, typescript',
        v2: true,
        v3: true,
        v3_1: true,
        v3_2: true,
      },
    ]);

    expect(graphQlClientStub.firstCall.args[1]).to.deep.equal({
      owner: 'apisyouwonthate',
      repository: 'openapi.tools',
      expression: 'main:src/content/tools',
    });
  });
});
