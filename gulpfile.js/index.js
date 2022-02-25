/* eslint-disable import/no-extraneous-dependencies */
const { src, dest } = require('gulp');
const transform = require('gulp-transform');
const rename = require('gulp-rename');

const {
  getRepositoryMetadata,
  readSourceData,
  mergeSources,
  normaliseSources,
} = require('../lib');

const full = () => src('gulpfile.js/metadata.json')
  .pipe(transform('utf8', readSourceData))
  .pipe(rename('raw-sources.yaml')) // Write raw data for debug purposes
  .pipe(dest('build/'))
  .pipe(transform('utf8', mergeSources))
  .pipe(transform('utf8', normaliseSources))
  .pipe(transform('utf8', getRepositoryMetadata))
  .pipe(rename('tools.yaml'))
  .pipe(dest('docs/'));

const metadata = () => src('docs/tools.yaml')
  .pipe(transform('utf8', getRepositoryMetadata))
  .pipe(rename('tools.yaml'))
  .pipe(dest('docs/'));

exports.full = full;
exports.metadata = metadata;
