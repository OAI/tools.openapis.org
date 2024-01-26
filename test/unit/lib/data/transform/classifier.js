const fs = require('fs');
const { resolve } = require('path');
const YAML = require('js-yaml');

const { assert, expect } = require('chai');

const Classifier = require('../../../../../lib/data/transform/classifer');

describe(__filename, () => {
  // Sample dataset (well, all the data rather than a sample, but you get the point)
  const sample = YAML.load(fs.readFileSync(resolve(`${__dirname}/../../../../data/lib/data/transform/tools.yaml`)));
  const classifier = new Classifier(sample);

  // Learn the model (this function doesn't return anything meaningful to test)
  // so doing it before other tests
  classifier.learn();

  describe('constructor function', () => {
    it('Throws an error when tools argument missing', () => {
      expect(() => { const c = new Classifier(); return c; }).to.throw('Missing parameter: tools');
    });
  });
  describe('getNormalisedCategories function', () => {
    it('Categories normalised as expected', () => {
      const expected = {
        'Auto Generators': 'Auto Generators',
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
      };

      expect(classifier.getNormalisedCategories()).to.deep.equal(expected);
    });
  });
  describe('categorize function', async () => {
    it('Tools dataset categorised as expected', async () => {
      // Note this is purely to provide a baseline for functional testing as opposed to integration
      // test to check the veracity of the categorisation method
      const expectedCategories = YAML.load(fs.readFileSync(resolve(`${__dirname}/../../../../data/lib/data/transform/output-categories.yaml`)));
      const tools = await classifier.categorize();

      // Consistently represent null for comparison
      const categories = tools.map((tool) => (tool.category ? tool.category : null));

      expect(categories).to.deep.equal(expectedCategories);
    });
    it('changeByRequestIndicator is respected', async () => {
      const tools = await classifier.categorize();
      const tool = tools.filter(({ id }) => id === '34445bbc3e815731b195a393a2a9d3f4').pop();

      assert.isTrue(tool.categoryByRequestIndicator);
      expect(tool.category).to.equal('Auto Generators');
    });
  });
});
