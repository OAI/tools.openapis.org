const fs = require('fs');
const YAML = require('js-yaml');

const { expect } = require('chai');

const Classifier = require('../../lib/classifer');

describe(__filename, () => {
  describe('constructor function', () => {
    it('Throws an error when tools argument missing', () => {
      expect(() => { const c = new Classifier(); return c; }).to.throw('Missing parameter: tools');
    });
  });
  describe('categorize function', () => {
    it('Tools data categorised as expected', async () => {
      // Note this is purely to provide a baseline for functional testing as opposed to integration
      // test to check the veracity of the categorisation method

      const sample = YAML.load(fs.readFileSync(`${__dirname}/../data/lib/tools.yaml`));
      const expectedCategories = YAML.load(fs.readFileSync(`${__dirname}/../data/lib/output-categories.yaml`));
      const classifier = new Classifier(sample);

      classifier.learn();

      const tools = await classifier.categorize();
      const categories = tools.map((tool) => (tool.category ? tool.category : null));

      expect(categories).to.deep.equal(expectedCategories);
    });
  });
});
