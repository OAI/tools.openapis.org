const YAML = require('js-yaml');

const { getUri, logger } = require('../util');

/**
   * Merge all sources, combining entries where duplicates are found
   *
   * @param {string} rawSources Raw YAML data from Gulp file stream
   * @returns {string}  Raw YAML data to return to Gulp stream
   */
module.exports = async (rawSources) => {
  logger(__filename, 'mergeSources');
  const sources = YAML.load(rawSources);

  // Get properties across all sources
  const sourceProperties = sources
    .reduce((output, source) => Object.assign(
      output,
      Object.keys(source)
        .reduce((thisOutput, key) => Object
          .assign(thisOutput, { [key]: (output[key] || 0) + 1 }), {}),
      {},
    ), {});

  // This of course removes some of the flexibility we get from the processor approach
  // Need to devise a way to discover the uri rather than using hard-coded values
  const mergedSources = sources
    .reduce((output, source) => {
      const updatedOutput = output;
      const uri = getUri(source).toLowerCase();

      if (!updatedOutput[uri]) {
        updatedOutput[uri] = { master: {}, sources: [] };
      }

      // This repository is already catalogued and normalised so hive off
      // the existing golden copy to its own object. This will be used where that
      // object is missing in source so we have a persistant record
      if (source.foundInMaster) {
        updatedOutput[uri].master = source;
        return updatedOutput;
      }

      // This is unnormalised source data to catalogue
      updatedOutput[uri].sources = ((updatedOutput[uri] || {}).sources || []).concat(source);

      return updatedOutput;
    }, {});

  return YAML.dump({
    sourceProperties,
    mergedSources: Object
      .values(mergedSources)
      .map((data) => ({ master: data.master, sources: data.sources })),
  });
};
