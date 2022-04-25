const YAML = require('js-yaml');

const { logger } = require('../util');
const Classifier = require('./classifer');

module.exports = async (rawSources) => {
  logger(__filename, 'classifyTools');

  const sources = YAML.load(rawSources);
  const classifer = new Classifier(sources);

  classifer.learn();

  return YAML.dump(await classifer.categorize());
};
