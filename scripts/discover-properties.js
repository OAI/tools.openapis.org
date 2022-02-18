#! /usr/bin/env node

const fs = require('fs');
const YAML = require('js-yaml');
const { argv } = require('yargs') // eslint-disable-line import/no-extraneous-dependencies
  .option('input', {
    describe: 'File containing tooling metadata',
    demandOption: true,
  });

const toolList = YAML.load(fs.readFileSync(argv.input, 'utf8'));
console.log(JSON.stringify(toolList, null, 2));
