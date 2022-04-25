// eslint-disable-next-line import/no-extraneous-dependencies,import/newline-after-import
const chai = require('chai');
const { expect } = chai;

const axios = require('axios');
const sinon = require('sinon'); // eslint-disable-line import/no-extraneous-dependencies

chai.use(require('chai-as-promised')); // eslint-disable-line import/no-extraneous-dependencies

const { getGithubRepositoryMetadata } = require('../../../lib/repo');

// Test data
const repositoryResponse = require('../../data/repo/github/repository-response.json');

const readmeResponse = '# Brief\n\nIt\'s for chopping up OpenAPI specs and that. Feed it some URIs, it merrily chops away. Good for paring down massive specs into bite-sized chunks. OpenAPI only (not Swagger).\n\nMore details to follow soon...\n\n# Usage\n\nDo as follows:\n\n```bash\ngit clone https://github.com/SensibleWood/openapi-chopper\ncd openapi-chopper\nyarn install && mkdir build\n./scripts/chopper.js --input test/data/petstore-input.yaml --output build/test-output.yaml /pet\n```\n\nLovely :thumbsup:\n"';

const stub200Response = (stub, callNumber, data, etag, lastModified) => {
  stub.onCall(callNumber)
    .returns(new Promise((resolve) => {
      resolve({
        data,
        status: 200,
        headers: { etag, 'last-modified': lastModified },
      });
    }));
};

const stub304Response = (stub, callNumber, etag, lastModified) => {
  stub.onCall(callNumber)
    .returns(new Promise((resolve) => {
      resolve({
        status: 304,
        headers: { etag, 'last-modified': lastModified },
      });
    }));
};

describe(__filename, () => {
  describe('getGithubRepositoryMetadata', () => {
    let sandbox;
    let stub;

    const expectedRepositoryMetadata = {
      archived: false,
      created: '2021-01-29T15:19:21Z',
      description: 'For chopping up OpenAPI specification documents... like it says on the tin...',
      language: 'JavaScript',
      license: 'MIT',
      logo: 'https://avatars.githubusercontent.com/u/68026188?v=4',
      forks: 0,
      owner: 'api-stuff',
      stars: 0,
      updated: '2021-12-01T07:56:59Z',
      watchers: 0,
    };
    const expectedBase64Readme = Buffer.from(readmeResponse).toString('base64');

    const repoEtag = '"b0a53ee97d1075f9b41d5b0dc7585105eb087ea947147444bbefaeb5754d2df0"';
    const repoLastModified = 'Fri, 18 Feb 2022 14:51:46 GMT';
    const readmeEtag = '"391f58e67e4e25e21a4a85aba4d56ae1b1cdc74557c248d12db168e659cf657d"';
    const readmeLastModified = 'Tue, 15 Feb 2022 19:39:47 GMT';

    const newRepoEtag = '"0d13a28c9ea4a1a113c241da0e418bfd1965462a181ecfc180ddcc32e57ebc7e"';
    const newRepoLastModified = 'Fri, 24 Feb 2022 15:51:46 GMT';
    const newReadmeEtag = '"5c94b5124fc8f347612bf5fda79494e4d91688e9eed3b02b782f82f58549039b"';
    const newReadmeLastModified = 'Fri, 24 Feb 2022 23:59:59 GMT';

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      stub = sandbox.stub(axios, 'get');
    });
    afterEach(() => sandbox.restore());

    it('Error when args incorrect', async () => {
      await expect(getGithubRepositoryMetadata()).to.be.rejectedWith('url, username and password must be supplied');
    });
    it('Mark GitHub repository not found in metadata when 404 returned', async () => {
      stub.onCall(0).throws({ response: { status: 404 } });

      await expect(getGithubRepositoryMetadata(
        'https://github.com/api-stuff/openapi-chopper',
        'username',
        'password',
      )).to.eventually.deep.equal({
        repositoryMetadata: {
          notFound: true,
        },
      });
    });
    it('Error thrown accessing repository metadata when any other HTTP error returned from Axios', async () => {
      stub.onCall(0).throws({ response: { status: 400 } });

      await expect(getGithubRepositoryMetadata(
        'https://github.com/api-stuff/openapi-chopper',
        'username',
        'password',
      )).to.be.rejectedWith('Bad HTTP response 400 returned when calling repository URL: https://api.github.com/repos/api-stuff/openapi-chopper');
    });
    it('Repository metadata available but readme call returns non-404 error', async () => {
      stub200Response(stub, 0, repositoryResponse, repoEtag, repoLastModified);
      stub.onCall(1)
        .throws({ response: { status: 400 } });

      await expect(getGithubRepositoryMetadata(
        'https://github.com/api-stuff/openapi-chopper',
        'username',
        'password',
      )).to.be.rejectedWith('Bad HTTP response 400 returned when calling README URL: https://api.github.com/repos/api-stuff/openapi-chopper/readme');
    });
    it('Successfully return metadata and readme from GitHub with no cache control data', async () => {
      stub200Response(stub, 0, repositoryResponse, repoEtag, repoLastModified);
      stub200Response(stub, 1, readmeResponse, readmeEtag, readmeLastModified);

      await expect(getGithubRepositoryMetadata(
        'https://github.com/api-stuff/openapi-chopper',
        'username',
        'password',
      )).to.eventually.deep.equal({
        repositoryMetadata: {
          ...expectedRepositoryMetadata,
          base64Readme: expectedBase64Readme,
          repoEtag,
          repoLastModified,
          readmeEtag,
          readmeLastModified,
        },
      });
    });
    it('Repository metadata available but readme missing', async () => {
      stub200Response(stub, 0, repositoryResponse, repoEtag, repoLastModified);
      stub.onCall(1)
        .throws({ response: { status: 404 } });

      await expect(getGithubRepositoryMetadata(
        'https://github.com/api-stuff/openapi-chopper',
        'username',
        'password',
      )).to.eventually.deep.equal({
        repositoryMetadata: {
          ...expectedRepositoryMetadata,
          repoEtag,
          repoLastModified,
        },
      });
    });
    it('Repository metadata has not been updated and readme missing', async () => {
      stub304Response(stub, 0, repoEtag, repoLastModified);
      stub.onCall(1)
        .throws({ response: { status: 404 } });

      await expect(getGithubRepositoryMetadata(
        'https://github.com/api-stuff/openapi-chopper',
        'username',
        'password',
        { ...expectedRepositoryMetadata, repoEtag, repoLastModified },
      )).to.eventually.deep.equal({
        repositoryMetadata: {
          ...expectedRepositoryMetadata,
          repoEtag,
          repoLastModified,
        },
      });
    });
    it('Repository metadata has been updated at GitHub and readme missing', async () => {
      stub200Response(stub, 0, repositoryResponse, newRepoEtag, newRepoLastModified);
      stub.onCall(1)
        .throws({ response: { status: 404 } });

      await expect(getGithubRepositoryMetadata(
        'https://github.com/api-stuff/openapi-chopper',
        'username',
        'password',
        { ...expectedRepositoryMetadata, repoEtag, repoLastModified },
      )).to.eventually.deep.equal({
        repositoryMetadata: {
          ...expectedRepositoryMetadata,
          repoEtag: newRepoEtag,
          repoLastModified: newRepoLastModified,
        },
      });
    });
    it('Repository metadata and readme have not been updated', async () => {
      stub304Response(stub, 0, repoEtag, repoLastModified);
      stub304Response(stub, 1, readmeEtag, readmeLastModified);

      await expect(getGithubRepositoryMetadata(
        'https://github.com/api-stuff/openapi-chopper',
        'username',
        'password',
        {
          ...expectedRepositoryMetadata,
          repoEtag,
          repoLastModified,
          readmeEtag,
          readmeLastModified,
        },
      )).to.eventually.deep.equal({
        repositoryMetadata: {
          ...expectedRepositoryMetadata,
          repoEtag,
          repoLastModified,
          readmeEtag,
          readmeLastModified,
        },
      });
    });
    it('Repository metadata has been updated and readme has not', async () => {
      stub200Response(stub, 0, repositoryResponse, newRepoEtag, newRepoLastModified);
      stub304Response(stub, 1, readmeEtag, readmeLastModified);

      await expect(getGithubRepositoryMetadata(
        'https://github.com/api-stuff/openapi-chopper',
        'username',
        'password',
        {
          ...expectedRepositoryMetadata,
          repoEtag,
          repoLastModified,
          readmeEtag,
          readmeLastModified,
        },
      )).to.eventually.deep.equal({
        repositoryMetadata: {
          ...expectedRepositoryMetadata,
          repoEtag: newRepoEtag,
          repoLastModified: newRepoLastModified,
          readmeEtag,
          readmeLastModified,
        },
      });
    });
    it('Repository metadata has not been updated and readme has', async () => {
      stub304Response(stub, 0, repoEtag, repoLastModified);
      stub200Response(stub, 1, readmeResponse, newReadmeEtag, newReadmeLastModified);

      await expect(getGithubRepositoryMetadata(
        'https://github.com/api-stuff/openapi-chopper',
        'username',
        'password',
        {
          ...expectedRepositoryMetadata,
          repoEtag,
          repoLastModified,
          readmeEtag,
          readmeLastModified,
        },
      )).to.eventually.deep.equal({
        repositoryMetadata: {
          ...expectedRepositoryMetadata,
          base64Readme: expectedBase64Readme,
          repoEtag,
          repoLastModified,
          readmeEtag: newReadmeEtag,
          readmeLastModified: newReadmeLastModified,
        },
      });
    });
    it('Repository metadata and readme have been updated', async () => {
      stub200Response(stub, 0, repositoryResponse, newRepoEtag, newRepoLastModified);
      stub200Response(stub, 1, readmeResponse, newReadmeEtag, newReadmeLastModified);

      await expect(getGithubRepositoryMetadata(
        'https://github.com/api-stuff/openapi-chopper',
        'username',
        'password',
        {
          ...expectedRepositoryMetadata,
          repoEtag,
          repoLastModified,
          readmeEtag,
          readmeLastModified,
        },
      )).to.eventually.deep.equal({
        repositoryMetadata: {
          ...expectedRepositoryMetadata,
          base64Readme: expectedBase64Readme,
          repoEtag: newRepoEtag,
          repoLastModified: newRepoLastModified,
          readmeEtag: newReadmeEtag,
          readmeLastModified: newReadmeLastModified,
        },
      });
    });
  });
});
