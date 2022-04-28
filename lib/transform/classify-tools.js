const YAML = require('js-yaml');

const { logger } = require('../util');
const Classifier = require('./classifer');

/**
 * Categorise all tools based on analysis of existing categories and README files
 *
 * @param {string} rawSources Raw YAML data from Gulp file stream
 * @returns {string} Raw YAML data to return to Gulp stream
 */
module.exports = async (rawSources) => {
  logger(__filename, 'classifyTools');

  const sources = YAML.load(rawSources);
  const classifer = new Classifier(sources);

  classifer.learn();

  return YAML.dump(await classifer.categorize());
};
