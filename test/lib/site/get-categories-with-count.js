const YAML = require('js-yaml'); // eslint-disable-line import/no-extraneous-dependencies
const fs = require('fs');

const { expect } = require('chai');

const getCategoriesWithCount = require('../../../lib/site/get-categories-with-count');

describe(__filename, () => {
  it('Returns expected categories and counts', () => {
    const tools = YAML.load(fs.readFileSync(`${__dirname}/../../data/site/tools.yaml`));
    const categories = getCategoriesWithCount(tools);

    expect(categories).to.deep.equal(
      [
        ['Parsers', 257],
        ['Server Implementations', 184],
        ['Server', 111],
        ['Testing', 99],
        ['SDK', 97],
        ['Code Generators', 80],
        ['Documentation', 78],
        ['Low-level Tooling', 74],
        ['Data Validators', 74],
        ['Description Validators', 63],
        ['Unclassified', 48],
        ['Converters', 38],
        ['Mock', 19],
        ['User Interfaces', 11],
        ['GUI Editors', 10],
        ['Text Editors', 10],
        ['Editors', 9],
        ['Learning', 7],
        ['Security', 7],
        ['DSL', 6],
        ['Client Implementations', 5],
        ['Testing Tools', 2],
        ['Mock Servers', 1],
        ['Mock Testing', 1],
        ['Schema Validators', 1],
        ['Auto Generators', 1],
      ],
    );
  });
});
