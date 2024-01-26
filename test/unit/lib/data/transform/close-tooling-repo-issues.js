const chai = require('chai');
const chap = require('chai-as-promised');

chai.use(chap);

const { expect } = chai;

const dotenv = require('dotenv');
const sinon = require('sinon');
const axios = require('axios');
const YAML = require('js-yaml');

const { closeToolingRepoIssues } = require('../../../../lib/data/transform');

describe(__filename, () => {
  dotenv.config({ path: `${__dirname}/../../../data/.env` });

  describe('closeToolingRepoIssues function', () => {
    const sandbox = sinon.createSandbox();
    let patchStub = null;

    beforeEach(() => {
      patchStub = sandbox.stub(axios, 'patch');
    }); // eslint-disable-line no-return-assign
    afterEach(() => sandbox.restore());

    it('Throw an error when environment variables not set', async () => {
      delete process.env.TOOLING_REPOSITORY_REPO_NAME;

      await expect(closeToolingRepoIssues(''))
        .to.be.rejectedWith('GH_API_TOKEN, GH_API_USERNAME, TOOLING_REPOSITORY_OWNER or TOOLING_REPOSITORY_REPO_NAME not set in environment when executing close-tooling-repo-issues.js');
    });
    it('Throw an error when concurrency level is not set or not a number', async () => {
      process.env.TOOLING_REPOSITORY_REPO_NAME = 'DUMMY';
      process.env.GH_API_CONCURRENCY_LIMIT = 'invalid';

      await expect(closeToolingRepoIssues(''))
        .to.be.rejectedWith('Concurrency limit is not set correctly or is not a number');
    });
    it('Data is returned as-is with open status when call to GitHub API fails', async () => {
      patchStub.throws('Unhandled exception at GitHub API');

      process.env.GH_API_CONCURRENCY_LIMIT = 2;

      const inputData = [{
        name: 'Test Tool 1',
        source: ['Tooling repository issues'],
        source_description: 'Test Tool 1 description',
        link: 'https://github.com/oai/Tooling/test-tool-1',
        v3_1: false,
        v3: true,
        v2: true,
        sourceIssueMetadata: {
          issueNumber: 1,
          author: 'issueRaiser',
          createdAt: '2023-03-30T09:37:02Z',
          updatedAt: '2023-03-30T09:50:49Z',
          url: 'https://github.com/OAI/Tooling/issues/0',
          status: 'open',
        },
      }];

      await expect(YAML.load(await closeToolingRepoIssues(YAML.dump(inputData))))
        .to.deep.equal(inputData);
    });
    it('Data is returned with closed status when call to GitHub API is successful', async () => {
      patchStub.returns({ status: 200 });

      process.env.GH_API_CONCURRENCY_LIMIT = 2;

      const inputData = [{
        name: 'Test Tool 1',
        source: ['Tooling repository issues'],
        source_description: 'Test Tool 1 description',
        link: 'https://github.com/oai/Tooling/test-tool-1',
        v3_1: false,
        v3: true,
        v2: true,
        sourceIssueMetadata: {
          issueNumber: 1,
          author: 'issueRaiser',
          createdAt: '2023-03-30T09:37:02Z',
          updatedAt: '2023-03-30T09:50:49Z',
          url: 'https://github.com/OAI/Tooling/issues/0',
          status: 'open',
        },
      }];
      const outputData = JSON.parse(JSON.stringify(inputData));

      outputData[0].sourceIssueMetadata.status = 'closed';

      await expect(YAML.load(await closeToolingRepoIssues(YAML.dump(inputData))))
        .to.deep.equal(outputData);
    });
  });
});
