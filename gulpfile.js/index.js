/* eslint-disable import/no-extraneous-dependencies */
const { src, dest } = require('gulp');
const transform = require('gulp-transform');
const rename = require('gulp-rename');
const dotenv = require('dotenv');

const { argv } = require('yargs')
  .option('metadata', {
    describe: 'Input file that describes build metadata',
    default: 'gulpfile.js/metadata.json',
  })
  .option('env-file', {
    describe: 'Environment file for non-sensitive environment variables',
    default: 'gulpfile.js/.env',
  })
  .option('output-dir', {
    describe: 'Output directory for tools.yaml',
    default: 'src/_data',
  })
  .option('dry-run', {
    describe: 'Used for testing. Will skip closing issues in Tooling repository when true',
    boolean: true,
    default: false,
  });

dotenv.config({ path: argv.envFile });

const {
  classifyTools,
  closeToolingRepoIssues,
  validateMetadata,
  getRepositoryMetadata,
  readLocalSourceData,
  readSourceData,
  mergeSources,
  normaliseSources,
  purgeSources,
  logger,
} = require('../lib/data');

logger(`Using metadata file: <${argv.metadata}>`);
logger(`Using environment file for non-sensitive environment variables: <${argv.envFile}>`);
logger(`tools.yaml will be written to: ${argv.outputDir}`);

let closeToolingIssuesFn = closeToolingRepoIssues;

if (argv.dryRun) {
  logger('Tooling repository issues will not be closed during this build');
  closeToolingIssuesFn = (rawData) => rawData;
}

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
  .pipe(transform('utf8', closeToolingIssuesFn))
  .pipe(rename('tools.yaml'))
  .pipe(dest(argv.outputDir));

// This is a scan of the metadata associated with the repositories already
// held in the repository. No new source data is retrieved from sources
// but existing data may be removed if not found
const metadata = () => src(argv.metadata)
  .pipe(transform('utf8', validateMetadata))
  .pipe(transform('utf8', readLocalSourceData))
  .pipe(transform('utf8', getRepositoryMetadata))
  .pipe(transform('utf8', purgeSources))
  .pipe(rename('tools.yaml'))
  .pipe(dest(argv.outputDir));

exports.full = full;
exports.metadata = metadata;
