/* eslint-disable import/no-extraneous-dependencies */
const { src, dest } = require('gulp');
const transform = require('gulp-transform');
const rename = require('gulp-rename');
const log = require('fancy-log');
const YAML = require('js-yaml');

const { getGithubRepositoryMetadata, normalisePropertyNames, normaliseSplitters } = require('./lib');

/**
 * Read all sources of data and return array of objects containing results
 *
 * @param {string} rawConfig The raw configuration file found in this directory
 * @returns {Object[]} Array of objects returned by each processor
 */
const readSourceData = async (rawConfig) => {
  log('readSourceData');

  const config = JSON.parse(rawConfig);

  const results = await config
    .reduce(async (output, source) => {
      const update = await output;
      log(source.title, 'Reading source data...');

      // Yes, this is an anti-pattern and opinionated approach...
      // but it provides a nice level of flexibility in the build mechanism
      // so lets live with it for now...

      // eslint-disable-next-line import/no-dynamic-require, global-require
      const processor = require(`${__dirname}/${source.processor}`);
      const data = await processor(source.title, source.url);

      return update.concat(data);
    }, []);

  // A string needs to returned by the async operation
  return JSON.stringify(results);
};

/**
 * Merge all sources, combining entries where duplicates are found
 *
 * @param {Object[]} sources
 * @returns {string} Merged sources
 */
const mergeSources = async (rawSources) => {
  log('mergeSources');
  const sources = JSON.parse(rawSources);

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
      const uri = (source.github || source.link || source.homepage).toLowerCase();

      return Object.assign(output, { [uri]: (output[uri] || []).concat(source) });
    }, {});

  return JSON.stringify({ sourceProperties, mergedSources });
};

/**
 * Normalise and classify the data consistently across all sources
 *
 * @param {Object} rawSources Source data keyed on URL
 * @returns {string} YAML-encoded string of tools with merged properties
 */
const normaliseSources = async (rawSources) => {
  log('normaliseSources');

  const keyMappings = {
    github: 'repository',
    gitlab: 'repository',
    bitbucket: 'repository',
    description: 'source_description',
  };
  const { sourceProperties, mergedSources } = JSON.parse(rawSources);
  const normalisedProperties = normalisePropertyNames(sourceProperties);
  const functionMappings = {
    language: normaliseSplitters,
  };

  // There are easier ways of doing this by using multiple reassignments
  // but this is better for readability/general understanding of what is going on
  const normalisedSources = Object.values(mergedSources)
    .reduce((output, tool) => output.concat(tool
      .reduce((toolOutput, source) => Object.assign(
        toolOutput,
        Object.entries(source)
          .reduce((sourceOutput, [key, value]) => {
            const targetPropertyName = normalisedProperties[key];

            return Object.assign(
              sourceOutput,
              {
                [targetPropertyName]: toolOutput[targetPropertyName]
                  ? [].concat(toolOutput[targetPropertyName], value) : value,
              },
            );
          }, {}),
      ), {})), [])
    .map((tool) => Object.entries(tool)
      .reduce((output, [key, value]) => {
        // If source data is an array then use Set to dedup the values
        const metadataValue = Array.isArray(value) ? [...new Set(value)] : value;
        const outputKey = [keyMappings[key] || key];
        const outputValue = functionMappings[outputKey]
          ? functionMappings[outputKey](metadataValue) : metadataValue;

        return Object.assign(
          output,
          {
            [keyMappings[key] || key]: Array.isArray(outputValue) && outputValue.length === 1
              ? outputValue.pop() : outputValue,
          },
        );
      }, {}));

  return JSON.stringify(normalisedSources);
};

const getRepositoryMetadata = async (rawNormalisedData) => {
  log('getRepositoryMetadata');

  const normalisedData = JSON.parse(rawNormalisedData);
  const enrichedData = await Promise.all(normalisedData
    .map(async (source) => {
      if (source.repository && source.repository.match(/github\.com/)) {
        return {
          ...source,
          ...(await getGithubRepositoryMetadata(
            source.repository,
            process.env.GITHUB_USER,
            process.env.GITHUB_TOKEN,
          )),
        };
      }

      return source;
    }));

  return YAML.dump(enrichedData);
};

const buildFromSource = () => src('gulpfile.js/sourceMetadata.json')
  .pipe(transform('utf8', readSourceData))
  .pipe(transform('utf8', mergeSources))
  .pipe(transform('utf8', normaliseSources))
  .pipe(transform('utf8', getRepositoryMetadata))
  .pipe(rename('tools.yaml'))
  .pipe(dest('docs/'));

exports.default = buildFromSource;
