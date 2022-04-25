const YAML = require('js-yaml');

const {
  getUri, logger, normalisePropertyNames, normaliseSplitters,
} = require('../util');

module.exports = async (rawSources) => {
  logger(__filename, 'normaliseSources');

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
};
