const fs = require('fs');
const YAML = require('js-yaml');

const { expect } = require('chai');

const Classifier = require('../../../lib/transform/classifer');

describe(__filename, () => {
  // Sample dataset (well, all the data rather than a sample, but you get the point)
  const sample = YAML.load(fs.readFileSync(`${__dirname}/../../data/lib/transform/tools.yaml`));
  const classifier = new Classifier(sample);

  classifier.learn();

  describe('constructor function', () => {
    it('Throws an error when tools argument missing', () => {
      expect(() => { const c = new Classifier(); return c; }).to.throw('Missing parameter: tools');
    });
  });
  describe('getNormalisedCategories function', () => {
    it('Categories normalised as expected', () => {
      const expected = {
        'Low-level Tooling': 'Low-level Tooling',
        Parsers: 'Parsers',
        Converters: 'Converters',
        'Data Validators': 'Data Validators',
        'Description Validators': 'Description Validators',
        SDK: 'SDK',
        Editors: 'Editors',
        'GUI Editors': 'GUI Editors',
        'Server Implementations': 'Server Implementations',
        'Text Editors': 'Text Editors',
        'User Interfaces': 'User Interfaces',
        Documentation: 'Documentation',
        'Code Generators': 'Code Generators',
        'Mock Servers': 'Mock Servers',
        Mock: 'Mock',
        Server: 'Server',
        'Client Implementations': 'Client Implementations',
        DSL: 'DSL',
        'Text Editor': 'Text Editors',
        Learning: 'Learning',
        Testing: 'Testing',
        'Data Validation': 'Data Validators',
        'Schema Validators': 'Schema Validators',
        Security: 'Security',
        Parser: 'Parsers',
        Miscellaneous: 'Miscellaneous',
      };

      expect(classifier.getNormalisedCategories()).to.deep.equal(expected);
    });
  });
  describe('categorize function', () => {
    it('Tools data categorised as expected', async () => {
      // Note this is purely to provide a baseline for functional testing as opposed to integration
      // test to check the veracity of the categorisation method
      const expectedCategories = YAML.load(fs.readFileSync(`${__dirname}/../../data/lib/transform/output-categories.yaml`));

      const tools = await classifier.categorize();
      const categories = tools.map((tool) => (tool.category ? tool.category : null));

      fs.writeFileSync('tmp.yaml', YAML.dump(categories));

      expect(categories).to.deep.equal(expectedCategories);
    });
  });
});
