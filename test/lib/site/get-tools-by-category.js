const YAML = require('js-yaml'); // eslint-disable-line import/no-extraneous-dependencies
const fs = require('fs');

const { expect } = require('chai');

const getToolsByCategory = require('../../../lib/site/get-tools-by-category');

describe(__filename, () => {
  it('Returns expected tools by category', () => {
    // Grab a slab of tools
    const input = YAML.load(fs.readFileSync(`${__dirname}/../../data/site/tools.yaml`))
      .slice(0, 10);

    // fs.writeFileSync(`${__dirname}/../../data/site/tools-by-category.yaml`, YAML.dump(getToolsByCategory(input), { noRefs: true }));

    const expected = YAML.load(fs.readFileSync(`${__dirname}/../../data/site/tools-by-category.yaml`));

    expect(getToolsByCategory(input)).to.deep.equal(expected);
  });
});
