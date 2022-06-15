const YAML = require('js-yaml'); // eslint-disable-line import/no-extraneous-dependencies

const { getCategoriesWithCount } = require('./lib/site');

module.exports = (eleventyConfig) => {
  eleventyConfig.addDataExtension('yaml', (contents) => YAML.load(contents));
  eleventyConfig.addLayoutAlias('tool', 'tool.njk');
  eleventyConfig.addPassthroughCopy({ 'src/images/favicon': '/' });

  // Takes a list of objects and generates a unique list based on a given key
  eleventyConfig.addFilter('uniqueValues', (list, key) => list
    .reduce((output, member) => {
      if (Array.isArray(member[key])) {
        member[key]
          .forEach((v) => {
            if (output.indexOf(v) === -1) {
              output.push(v);
            }
          });
        return output;
      }

      if (output.indexOf(member[key]) === -1) {
        return output.concat(member[key]);
      }

      return output;
    }, []));

  eleventyConfig.addFilter('categoriesWithCount', getCategoriesWithCount);

  return {
    dir: {
      input: 'src',
      output: 'docs',
    },
  };
};
