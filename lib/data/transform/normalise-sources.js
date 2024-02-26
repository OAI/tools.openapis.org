const YAML = require('js-yaml');

const {
  getUri, getHash, logger, normalisePropertyNames, normaliseSplitters,
} = require('../util');

/**
   * Normalise all sources to create consolidated data from each source
   *
   * @param {string} rawSources Raw YAML data from Gulp file stream
   * @returns {string}  Raw YAML data to return to Gulp stream
   */
const normaliseSources = async (rawSources) => {
  logger(__filename, 'normaliseSources');

  const dedupRepositoryValues = (data) => {
    if (Array.isArray(data)) {
      return [...new Set(data.map((value) => value
        .toLowerCase()))];
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

  // Normalise input properties across all tools
  const normalisedProperties = normalisePropertyNames(sourceProperties);

  // Provide custom functions for specific properties
  const functionMappings = {
    language: normaliseSplitters,
    repository: dedupRepositoryValues,
  };

  const normalisedSources = mergedSources
    .map((tool) => {
      const { master, sources } = tool;

      // If useMasterProperties properties flag is set then do not use sources as the data has
      // changed in this repository due to a data fix. Copy-and-paste data to output
      if ((master || {}).useMasterProperties) {
        return master;
      }

      // Loop across source data and normalise based on occurances of a given property
      // and naming conventions implied by preponderance in source data
      const mergedSourceProperties = sources
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

      // Check whether there is any chance of setting a repository value based on any recognised
      // properties from sources
      if (!source.repository) {
        const candidate = getUri(source);

        // This will be expanded as more sources are implemented
        if (candidate && candidate.match(/^https.*github\.com(?:\/[a-zA-Z0-9-_.~]+){2}$/)) {
          source.repository = candidate
            .toLowerCase();
        }
      }

      return Object.assign((master || {}), source);
    })
    .map((tool) => {
      // If an identifier is already assigned then retain it
      if (tool.id) {
        return tool;
      }

      // If this is new tool then generate a new identifier
      const seed = getUri(tool);

      if (!seed) {
        if (process.env.NODE_ENV !== 'test') {
          console.error(`Cannot map URL to uniquely identity tools: ${JSON.stringify(tool)}`);
        }

        throw new Error('Could not discover URL and therefore generate ID for tooling source. Check error log for tool properties');
      }

      return Object.assign(tool, { id: getHash(seed.toLowerCase()) });
    });

  return YAML.dump(normalisedSources);
};

module.exports = normaliseSources;
