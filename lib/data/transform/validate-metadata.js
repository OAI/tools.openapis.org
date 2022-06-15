const Ajv = require('ajv');
const YAML = require('js-yaml');

const { logger } = require('../util');

/**
   * Validate the metadata provided for the build
   *
   * @param {string} rawMetadata Raw YAML data from Gulp file stream
   * @returns {string}  Raw YAML data to return to Gulp stream
   */
module.exports = async (rawMetadata) => {
  logger(__filename, 'validateMetadata');

  const metadata = JSON.parse(rawMetadata);
  const ajv = new Ajv({ strict: true, allErrors: true });
  const validator = ajv.compile({
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['environmentVariables', 'sources'],
    properties: {
      environmentVariables: {
        type: 'array',
        items: { type: 'string' },
      },
      sources: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'processor'],
          properties: {
            title: { type: 'string' },
            processor: { type: 'string' },
            url: { type: 'string' },
          },
        },
        minItems: 1,
      },
    },

  });
  const results = validator(metadata);

  if (!results) {
    throw new Error('The metadata could not be validated');
  }

  const missing = metadata.environmentVariables
    .filter((variableName) => !process.env[variableName]);

  if (missing.length > 0) {
    throw new Error(`Required environment variable(s) for build not set: ${missing.join(', ')}`);
  }

  return YAML.dump(metadata.sources);
};
