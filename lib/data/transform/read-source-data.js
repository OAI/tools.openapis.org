const YAML = require('js-yaml');

const { existsSync } = require('fs');

const { logger } = require('../util');

const readSource = async (output, source) => {
  const update = await output;
  logger(`${__dirname}/${source.processor}`, source.title, 'Reading source data...');

  // Yes, this is an anti-pattern and opinionated approach...
  // but it provides a nice level of flexibility in the build mechanism
  // so lets live with it for now...

  // eslint-disable-next-line import/no-dynamic-require, global-require
  const processor = require(`${__dirname}/${source.processor}`);
  const data = await processor(source);

  return update.concat(data);
};

module.exports = {
  /**
   * Read the local source data. Used for incremental metadata updates
   *
   * @param {*} rawConfig The raw configuration file found in this directory
   * @returns {Object[]} Array of objects returned by each processor
   */
  readLocalSourceData: async (rawConfig) => {
    logger(__filename, 'readLocalSourceData');

    const config = YAML.load(rawConfig);

    const results = await config
      .filter((source) => existsSync(source.url))
      .reduce(async (output, source) => readSource(output, source), []);

    // A string needs to returned by the async operation
    return YAML.dump(results);
  },
  /**
     * Read all sources of data and return array of objects containing results
     *
     * @param {string} rawConfig The raw configuration file found in this directory
     * @returns {Object[]} Array of objects returned by each processor
     */
  readSourceData: async (rawConfig) => {
    logger(__filename, 'readSourceData');

    const config = YAML.load(rawConfig);

    const results = await config
      .reduce(async (output, source) => readSource(output, source), []);

    // A string needs to returned by the async operation
    return YAML.dump(results);
  },
};
