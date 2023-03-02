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

  // Get properties across all sources. This is used to help define the precedence of a given key
  // when the properties are normalised in subsequent scripts. Executed now as sources are merged
  const sourceProperties = sources
    .reduce((output, source) => Object.assign(
      output,
      Object.keys(source)
        .reduce((thisOutput, key) => Object
          .assign(thisOutput, { [key]: (output[key] || 0) + 1 }), {}),
      {},
    ), {});

  // Merge all sources that have been previously moved into a single array. This will be used to
  // prevent work being done again on data pulled back in from the source repositories
  // Any repositories matching a value found in this array will be ignored
  const movedSources = sources
    .filter((source) => source.foundInMaster && source.oldLocations)
    .reduce((output, source) => output.concat(source.oldLocations), []);

  // This of course removes some of the flexibility we get from the processor approach
  // Need to devise a way to discover the uri rather than using hard-coded values
  const mergedSources = sources
    .map((source) => ({
      uri: getUri(source)
        .toLowerCase(),
      source,
    }))
    .filter((source) => {
      if (movedSources.indexOf(source.uri) !== -1) {
        logger(`Ignoring repository as found to have moved at previous run: ${source.uri}`);
        return false;
      }

      return true;
    })
    .reduce((output, filteredSource) => {
      const updatedOutput = output;
      const { uri, source } = filteredSource;

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
