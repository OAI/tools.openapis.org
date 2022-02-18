// eslint-disable-next-line import/no-extraneous-dependencies,import/newline-after-import
const chai = require('chai');
const { expect } = chai;

const axios = require('axios');
const sinon = require('sinon'); // eslint-disable-line import/no-extraneous-dependencies

chai.use(require('chai-as-promised')); // eslint-disable-line import/no-extraneous-dependencies

const { getGithubRepositoryMetadata, normaliseSplitters } = require('../../lib');

// JSON test data
const repositoryResponse = require('../data/github/repo-response.json');

describe(__filename, () => {
  describe('normaliseSplitters', () => {
    it('Remove noise from string', () => {
      const normalisedString = 'This is a string of text pretending to be an array';
      const testCase = [`["${normalisedString}"]`];

      expect(normaliseSplitters(testCase)).to.deep.equal([normalisedString]);
    });
    it('Split across multiple splitters and trim text', () => {
      const testCase = ['Java, Kotlin, JavaScript, Groovy, Ruby, Ceylon & Scala'];

      expect(normaliseSplitters(testCase)).to.deep.equal(['Java', 'Kotlin', 'JavaScript', 'Groovy', 'Ruby', 'Ceylon', 'Scala']);
    });
    it('Split and combine from multiple sources', () => {
      const testCase = ['XSLT', 'Java, Kotlin, JavaScript, Groovy, Ruby, Ceylon & Scala'];

      expect(normaliseSplitters(testCase)).to.deep.equal(['XSLT', 'Java', 'Kotlin', 'JavaScript', 'Groovy', 'Ruby', 'Ceylon', 'Scala']);
    });
    it('Split on a raw string', () => {
      const testCase = 'XSLT';

      expect(normaliseSplitters(testCase)).to.deep.equal(['XSLT']);
    });
    it('Remove duplicates after normalising values', () => {
      const testCase = ['XSLT', 'XSLT'];

      expect(normaliseSplitters(testCase)).to.deep.equal(['XSLT']);
    });
  });
  describe('getGithubRepositoryMetadata', () => {
    it('Error when args incorrect', async () => {
      await expect(getGithubRepositoryMetadata()).to.be.rejectedWith('url, username and password must be supplied');
    });
    it('Retrieve GitHub metadata successfully', async () => {
      // Sinon-based stub for GitHub response
      const sandbox = sinon.createSandbox();
      const stub = sandbox.stub(axios, 'get');

      const readmeResponse = '# Brief\n\nIt\'s for chopping up OpenAPI specs and that. Feed it some URIs, it merrily chops away. Good for paring down massive specs into bite-sized chunks. OpenAPI only (not Swagger).\n\nMore details to follow soon...\n\n# Usage\n\nDo as follows:\n\n```bash\ngit clone https://github.com/SensibleWood/openapi-chopper\ncd openapi-chopper\nyarn install && mkdir build\n./scripts/chopper.js --input test/data/petstore-input.yaml --output build/test-output.yaml /pet\n```\n\nLovely :thumbsup:\n"';

      stub.onCall(0)
        .returns(new Promise((resolve) => { resolve({ data: repositoryResponse }); }));
      stub.onCall(1)
        .returns(new Promise((resolve) => { resolve({ data: readmeResponse }); }));

      await expect(getGithubRepositoryMetadata(
        'https://github.com/api-stuff/openapi-chopper',
        process.env.GITHUB_USER,
        process.env.GITHUB_TOKEN,
      )).to.eventually.deep.equal({
        repositoryMetadata: {
          archived: false,
          created: '2021-01-29T15:19:21Z',
          description: 'For chopping up OpenAPI specification documents... like it says on the tin...',
          language: 'JavaScript',
          license: 'MIT',
          logo: 'https://avatars.githubusercontent.com/u/68026188?v=4',
          forks: 0,
          owner: 'api-stuff',
          readme: readmeResponse,
          stars: 0,
          updated: '2021-12-01T07:56:59Z',
          watchers: 0,
        },
      });
    });
  });
});
