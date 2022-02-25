const YAML = require('js-yaml');

const { getGithubRepositoryMetadata } = require('./repo');
const { logger, normalisePropertyNames, normaliseSplitters } = require('./util');

const getUri = (source) => (source.repository || source.github || source.link || source.homepage);

module.exports = {
  getRepositoryMetadata: async (rawNormalisedData) => {
    logger('getRepositoryMetadata');

    const normalisedData = YAML.load(rawNormalisedData);
    const enrichedData = await Promise.all(normalisedData
      .map(async (source) => {
        if (source.repository && typeof source.repository === 'string' && source.repository.match(/github\.com/)) {
          logger(`Retrieving GitHub metadata for: ${source.repository}`);
          return {
            ...source,
            ...(await getGithubRepositoryMetadata(
              source.repository,
              process.env.GITHUB_USER,
              process.env.GITHUB_TOKEN,
              source.repositoryMetadata,
            )),
          };
        }

        return source;
      }));

    return YAML.dump(enrichedData);
  },
  /**
   * Merge all sources, combining entries where duplicates are found
   *
   * @param {Object[]} sources
   * @returns {string} Merged sources
   */
  mergeSources: async (rawSources) => {
    logger('mergeSources');
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
  },
  /**
   * Normalise and classify the data consistently across all sources
   *
   * @param {Object} rawSources Source data keyed on URL
   * @returns {string} YAML-encoded string of tools with merged properties
   */
  normaliseSources: async (rawSources) => {
    logger('normaliseSources');

    const dedupRepositoryValues = (data) => {
      if (Array.isArray(data)) {
        return [...new Set(data.map((value) => value.toLowerCase()))];
      }
      return data ? data.toLowerCase() : data;
    };
    const keyMappings = {
      github: 'repository',
      gitlab: 'repository',
      bitbucket: 'repository',
      description: 'source_description',
    };
    const { sourceProperties, mergedSources } = YAML.load(rawSources);
    const normalisedProperties = normalisePropertyNames(sourceProperties);
    const functionMappings = {
      language: normaliseSplitters,
      repository: dedupRepositoryValues,
    };

    const normalisedSources = mergedSources
      .map((tool) => {
      // Loop across source data and normalise based on occurances of a given property
      // and naming conventions implied by preponderance in source data
        const mergedSourceProperties = tool.sources
          .reduce((output, source) => Object.assign(
            output,
            Object.entries(source)
              .reduce((sourceOutput, [key, value]) => {
                const targetPropertyName = normalisedProperties[key];

                return Object.assign(
                  sourceOutput,
                  {
                    [targetPropertyName]: output[targetPropertyName]
                      ? [].concat(output[targetPropertyName], value) : value,
                  },
                );
              }, {}),
          ), {});

        // Merge the normalised metadata into a refined set of key and property values
        const source = Object.entries(mergedSourceProperties)
          .reduce((output, [key, value]) => {
          // If source data is an array then use Set to dedup the values
            const metadataValue = Array.isArray(value) ? [...new Set(value)] : value;
            // Calculate the correct output property name
            const outputKey = [keyMappings[key] || key];
            // Set the property value, applying any functions as required
            const outputValue = functionMappings[outputKey]
              ? functionMappings[outputKey](metadataValue) : metadataValue;

            return Object.assign(
              output,
              {
                [keyMappings[key] || key]: Array.isArray(outputValue) && outputValue.length === 1
                  ? outputValue.pop() : outputValue,
              },
            );
          }, {});

        // Check whether there is any chance of setting a repository value based on any recognise
        // properties from sources
        if (!source.repository) {
          const candidate = getUri(source);

          if (candidate && candidate.match(/^https.*github\.com(?:\/[a-zA-Z0-9-_.~]+){2}$/)) {
            source.repository = candidate;
          }
        }

        return Object.assign(tool.master, source);
      });

    return YAML.dump(normalisedSources);
  },
  /**
   * Read all sources of data and return array of objects containing results
   *
   * @param {string} rawConfig The raw configuration file found in this directory
   * @returns {Object[]} Array of objects returned by each processor
   */
  readSourceData: async (rawConfig) => {
    logger('readSourceData');

    const config = JSON.parse(rawConfig);

    const results = await config
      .reduce(async (output, source) => {
        const update = await output;
        logger(source.title, 'Reading source data...');

        // Yes, this is an anti-pattern and opinionated approach...
        // but it provides a nice level of flexibility in the build mechanism
        // so lets live with it for now...

        // eslint-disable-next-line import/no-dynamic-require, global-require
        const processor = require(`${__dirname}/${source.processor}`);
        const data = await processor(source.title, source.url);

        return update.concat(data);
      }, []);

    // A string needs to returned by the async operation
    return YAML.dump(results);
  },
};
