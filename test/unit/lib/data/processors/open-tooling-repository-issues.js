const { GraphQLClient } = require('graphql-request');
const { resolve } = require('path');

const chai = require('chai');
const chap = require('chai-as-promised');
const sinon = require('sinon');
const dotenv = require('dotenv');

chai.use(chap);

const { expect } = chai;

const fn = require('../../../../../lib/data/processors/open-tooling-repository-issues');

describe(__filename, () => {
  const envFile = resolve(`${__dirname}/../../../../data/.env`);
  dotenv.config({ path: envFile });

  const sandbox = sinon.createSandbox();
  let graphQlClientStub;

  beforeEach(() => {
    graphQlClientStub = sandbox.stub(GraphQLClient.prototype, 'request');
  }); // eslint-disable-line no-return-assign
  afterEach(() => sandbox.restore());

  describe('Open Tooling repository issues processor', () => {
    const expectedGraphQlResponseBody = {
      repository: {
        issues: {
          nodes: [
            {
              title: 'Unrelated issues',
              body: 'This is not a tooling issues',
            },
            {
              body: '## Tool Properties\r\n'
            + '- Display name: Test Tool 1\r\n'
            + '- Description: Test Tool 1 description\r\n'
            + '- Homepage: https://github.com/oai/Tooling/test-tool-1\r\n'
            + '- 3.1: false\r\n'
            + '- 3.0: true\r\n'
            + '- 2.0: true\r\n',
              number: 1,
              author: { login: 'issueRaiser' },
              createdAt: '2023-03-30T09:37:02Z',
              updatedAt: '2023-03-30T09:50:49Z',
              url: 'https://github.com/OAI/Tooling/issues/1',
            },
            {
              body: '## Tool Properties\r\n'
            + '- Display name: Test Tool 2\r\n'
            + '- Description: Test Tool 2 description\r\n'
            + '- Homepage: https://github.com/oai/Tooling/test-tool-2\r\n'
            + '- 3.1: true\r\n'
            + '- 3.0: true\r\n'
            + '- 2.0: false\r\n',
              number: 2,
              author: { login: 'issueRaiser' },
              createdAt: '2023-03-30T09:37:02Z',
              updatedAt: '2023-03-30T09:50:49Z',
              url: 'https://github.com/OAI/Tooling/issues/2',
            },
            {
              body: '> **Please use this template for tools that cannot be tagged on GitHub. If your tool is on GitHub use the `openapi3` and `openapi31` tags to allow your data to be collected automatically.**\r\n\r\n'
              + '## Tool Properties\r\n\r\n'
              + '> **Please replace all placeholders marked in bold in the bullets below with the requested information. Use plain text for your information.**\r\n\r\n'
              + '- Display name: **Apidog**\r\n'
              + '- Description: **Apidog is an integrated collaboration platform for API documentation, API debugging, API mocking, and API automated testing that combines Postman + Swagger + Mock + JMeter to tackle the data synchronization problem among different systems using a set of systems and a set of data. API debugging, API data mocking, and API automated testing can be directly used without redefining as long as the API documentation is well-defined.**\r\n'
              + '- Homepage: https://www.apidog.com\r\n\r\n'
              + '## OpenAPI Versions\r\n\r\n'
              + '> **Please indicate the versions of OpenAPI supported by your tool by marking them true or false below.**\r\n\r\n'
              + '- 3.1: true\r\n'
              + '- 3.0: true\r\n'
              + '- 2.0: true\r\n\r\n',
              number: 3,
              author: { login: 'issueRaiser' },
              createdAt: '2023-03-30T09:37:02Z',
              updatedAt: '2023-03-30T09:50:49Z',
              url: 'https://github.com/OAI/Tooling/issues/3',
            },
          ],
        },
      },
    };
    const expectedTools = [
      {
        name: 'Test Tool 1',
        source: ['Tooling repository issues'],
        source_description: 'Test Tool 1 description',
        link: 'https://github.com/oai/Tooling/test-tool-1',
        v3_1: false,
        v3: true,
        v2: true,
        sourceIssueMetadata: {
          author: 'issueRaiser',
          createdAt: '2023-03-30T09:37:02Z',
          issueNumber: 1,
          updatedAt: '2023-03-30T09:50:49Z',
          url: 'https://github.com/OAI/Tooling/issues/1',
          status: 'open',
        },
      },
      {
        name: 'Test Tool 2',
        source: ['Tooling repository issues'],
        source_description: 'Test Tool 2 description',
        link: 'https://github.com/oai/Tooling/test-tool-2',
        v3_1: true,
        v3: true,
        v2: false,
        sourceIssueMetadata: {
          author: 'issueRaiser',
          createdAt: '2023-03-30T09:37:02Z',
          issueNumber: 2,
          updatedAt: '2023-03-30T09:50:49Z',
          url: 'https://github.com/OAI/Tooling/issues/2',
          status: 'open',
        },
      },
      {
        name: 'Apidog',
        source: ['Tooling repository issues'],
        source_description: 'Apidog is an integrated collaboration platform for API documentation, API debugging, API mocking, and API automated testing that combines Postman + Swagger + Mock + JMeter to tackle the data synchronization problem among different systems using a set of systems and a set of data. API debugging, API data mocking, and API automated testing can be directly used without redefining as long as the API documentation is well-defined.',
        link: 'https://www.apidog.com',
        v3_1: true,
        v3: true,
        v2: true,
        sourceIssueMetadata: {
          author: 'issueRaiser',
          createdAt: '2023-03-30T09:37:02Z',
          issueNumber: 3,
          updatedAt: '2023-03-30T09:50:49Z',
          url: 'https://github.com/OAI/Tooling/issues/3',
          status: 'open',
        },
      },
    ];

    it('Throws an error when incorrect parameter sent', async () => {
      await expect(fn())
        .to.be.rejectedWith('Mandatory parameters missing when executing open-tooling-repository-issues.js: [title] [masterDataFileName]');
    });
    it('Throws an error when GitHub API username or token not set', async () => {
      delete process.env.GH_API_TOKEN;

      await expect(fn({ title: 'Tooling repository issues', masterDataFileName: 'src/_data/tools.yaml' }))
        .to.be.rejectedWith('GH_API_TOKEN, GH_API_USERNAME, TOOLING_REPOSITORY_OWNER or TOOLING_REPOSITORY_REPO_NAME not set in environment when executing open-tooling-repository-issues.js');
    });
    it('Filters tool with invalid URL', async () => {
      dotenv.config({ path: envFile });
      graphQlClientStub.returns(Promise.resolve({
        repository: {
          issues: {
            nodes: [
              {
                body: '> **Please use this template for tools that cannot be tagged on GitHub. If your tool is on GitHub use the `openapi3` and `openapi31` tags to allow your data to be collected automatically.**\r\n\r\n'
                + '## Tool Properties\r\n\r\n'
                + '> **Please replace all placeholders marked in bold in the bullets below with the requested information. Use plain text for your information.**\r\n\r\n'
                + '- Display name: Boilerplate\r\n'
                + '- Description: Boilerplate'
                + '- Homepage: www.lacking-protocol.com\r\n\r\n'
                + '## OpenAPI Versions\r\n\r\n'
                + '> **Please indicate the versions of OpenAPI supported by your tool by marking them true or false below.**\r\n\r\n'
                + '- 3.1: true\r\n'
                + '- 3.0: true\r\n'
                + '- 2.0: true\r\n\r\n',
                number: 3,
                author: { login: 'issueRaiser' },
                createdAt: '2023-03-30T09:37:02Z',
                updatedAt: '2023-03-30T09:50:49Z',
                url: 'https://github.com/OAI/Tooling/issues/3',
              },
            ],
          },
        },
      }));

      await expect(fn({
        title: 'Tooling repository issues',
        masterDataFileName: `${__dirname}/../../../../data/lib/data/processors/tools-no-existing-issues.yaml`,
      }))
        .to.eventually.deep.equal([]);
    });
    it('Returns the expected number of tooling issues when querying GitHub GraphQL endpoint', async () => {
      dotenv.config({ path: envFile });
      graphQlClientStub.returns(Promise.resolve(expectedGraphQlResponseBody));

      await expect(fn({
        title: 'Tooling repository issues',
        masterDataFileName: `${__dirname}/../../../../data/lib/data/processors/tools-no-existing-issues.yaml`,
      }))
        .to.eventually.deep.equal(expectedTools);
    });
    it('Returns only new tooling issues when an issue already exists in the dataset (i.e. closing the issue failed)', async () => {
      dotenv.config({ path: envFile });
      graphQlClientStub.returns(Promise.resolve(expectedGraphQlResponseBody));

      await expect(fn({
        title: 'Tooling repository issues',
        masterDataFileName: `${__dirname}/../../../../data/lib/data/processors/tools-existing-issues.yaml`,
      }))
        .to.eventually.deep.equal([expectedTools[1]]);
    });
  });
});
