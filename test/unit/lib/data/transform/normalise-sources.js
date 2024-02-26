const chai = require('chai');
const cap = require('chai-as-promised');

chai.use(cap);

const { assert, expect } = chai;

const YAML = require('js-yaml');
const fs = require('fs');
const { resolve } = require('path');

const normaliseSources = require('../../../../../lib/data/transform/normalise-sources');

const getToolData = async (rawTestData, id) => YAML.load(await normaliseSources(rawTestData))
  .filter((tool) => tool.id === id)
  .pop();

describe(__filename, () => {
  describe('normaliseSources function', () => {
    const testDataDirectory = resolve(`${__dirname}/../../../../data/lib/data/transform/normalise-sources`);
    const rawTestData = fs.readFileSync(`${testDataDirectory}/sample-data.yaml`);

    it('Generate identifier and normalise data for new source data', async () => {
      const toolData = await getToolData(rawTestData, '206ab49426493f01bc246ec43fdcae2f');

      expect(toolData).to.deep.equal({
        id: '206ab49426493f01bc246ec43fdcae2f',
        source: 'openapi3 tags',
        repository: 'https://github.com/test-organisation/test-data',
        v3: true,
      });
    });
    it('Ignore new properties for data mastered in this repository', async () => {
      const toolData = await getToolData(rawTestData, '15aad8cd322242e03733b07f2a37890a');

      expect(toolData.link).to.equal('https://stoplight.io/open-source/prism');
    });
    it('Update properties from revised source data', async () => {
      const toolData = await getToolData(rawTestData, 'bfa5bf187387df6760e4366cf73a63b4');

      assert.isTrue(toolData.v3_1);
    });
  });
});
