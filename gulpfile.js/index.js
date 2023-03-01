/* eslint-disable import/no-extraneous-dependencies */
const { src, dest } = require('gulp');
const transform = require('gulp-transform');
const rename = require('gulp-rename');

const { argv } = require('yargs')
  .option('metadata', {
    describe: 'Input file that describes build metadata',
    default: 'gulpfile.js/metadata.json',
  });

const {
  classifyTools,
  validateMetadata,
  getRepositoryMetadata,
  readLocalSourceData,
  readSourceData,
  mergeSources,
  normaliseSources,
  purgeSources,
} = require('../lib/data');

console.log(`info: Using metadata file <${argv.metadata}>`);

// This is complete scan of the source data. All sources will be retrieved and processed
// though the transformation code, rebuilding tools.yaml
const full = () => src(argv.metadata)
  .pipe(transform('utf8', validateMetadata))
  .pipe(transform('utf8', readSourceData))
  .pipe(rename('raw-sources.yaml')) // Write raw data for debug purposes
  .pipe(dest('build/'))
  .pipe(transform('utf8', mergeSources))
  .pipe(transform('utf8', normaliseSources))
  .pipe(transform('utf8', getRepositoryMetadata))
  .pipe(transform('utf8', classifyTools))
  .pipe(transform('utf8', purgeSources))
  .pipe(rename('tools.yaml'))
  .pipe(dest('src/_data'));

// This is a scan of the metadata associated with the repositories already
// held in the repository. No new source data is retrieved from sources
// but existing data may be removed if not found
const metadata = () => src(argv.metadata)
  .pipe(transform('utf8', validateMetadata))
  .pipe(transform('utf8', readLocalSourceData))
  .pipe(transform('utf8', getRepositoryMetadata))
  .pipe(transform('utf8', purgeSources))
  .pipe(rename('tools.yaml'))
  .pipe(dest('src/_data'));

exports.full = full;
exports.metadata = metadata;
