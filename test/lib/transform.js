const chai = require('chai');
const cap = require('chai-as-promised');

chai.use(cap);

const { expect } = chai;

const { validateMetadata } = require('../../lib/index');

describe(__filename, () => {
  describe('checkMetadata', () => {
    it('Throw error when the metadata does not match the schema', async () => {
      const metadata = JSON.stringify({ sources: [] });

      await expect(validateMetadata(metadata)).to.be.rejectedWith('The metadata could not be validated');
    });
    it('Throw error required when environment variables are not set', async () => {
      const metadata = JSON.stringify({
        environmentVariables: ['UNKNOWN_VAR_USER', 'UNKNOWN_VAR_PASSWORD'],
        sources: [
          { title: 'Test source', processor: 'lib/processors/test-processor.js', url: 'https://unknown.url' },
        ],
      });

      await expect(validateMetadata(metadata)).to.be.rejectedWith('Required environment variable(s) for build not set: UNKNOWN_VAR_USER, UNKNOWN_VAR_PASSWORD');
    });
    it('Metadata successfully validated', async () => {
      process.env.TEST_VAR = 'testing';
      const metadata = {
        environmentVariables: ['TEST_VAR'],
        sources: [
          { title: 'Test source', processor: 'lib/processors/test-processor.js', url: 'https://unknown.url' },
          { title: 'Test source without URL', processor: 'lib/processors/test-processor-without-url.js' },
        ],
      };

      await expect(validateMetadata(JSON.stringify(metadata))).to.eventually
        .equal(
          '- title: Test source\n  processor: lib/processors/test-processor.js\n  url: https://unknown.url\n'
        + '- title: Test source without URL\n  processor: lib/processors/test-processor-without-url.js\n',
        );
    });
  });
});
