#! /usr/bin/env node

/**
 * Lists active projects from tools.yaml, open tool submission Issues and open Pull Requests,
 * with the condition under which each was marked active. See lib/data/activity for criteria.
 *
 * Requires a GitHub token in GH_API_TOKEN (or GITHUB_TOKEN / GH_TOKEN).
 */

const fs = require('fs');
const path = require('path');
const YAML = require('js-yaml');
const yargs = require('yargs');

const { findActiveProjects } = require('../lib/data/activity');
const { logger } = require('../lib/data/util');

const { argv } = yargs
  .option('input', {
    describe: 'tools.yaml file to check',
    default: './src/_data/tools.yaml',
  })
  .option('output', {
    describe: 'Output file for the active projects report (YAML)',
    default: './build/active-projects.yaml',
  })
  .option('owner', {
    describe: 'Owner of the repository to read Issues and Pull Requests from',
    default: 'OAI',
  })
  .option('repo', {
    describe: 'Repository to read Issues and Pull Requests from',
    default: 'tools.openapis.org',
  })
  .option('months', {
    describe: 'Activity window in months',
    type: 'number',
    default: 3,
  })
  .option('min-stars', {
    describe: 'GitHub repositories must have more than this many stars to be active',
    type: 'number',
    default: 50,
  })
  .option('concurrency', {
    describe: 'Concurrent website and repository checks',
    type: 'number',
    default: 8,
  })
  .option('timeout', {
    describe: 'Website request timeout in milliseconds',
    type: 'number',
    default: 15000,
  });

const token = process.env.GH_API_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

if (!token) {
  console.error('A GitHub token must be set in GH_API_TOKEN, GITHUB_TOKEN or GH_TOKEN');
  process.exit(1);
}

(async () => {
  logger(`Opening input file: ${argv.input}`);
  const tools = YAML.load(fs.readFileSync(argv.input, 'utf8'));

  const report = await findActiveProjects(tools, {
    token,
    owner: argv.owner,
    repo: argv.repo,
    months: argv.months,
    minStars: argv.minStars,
    concurrency: argv.concurrency,
    timeout: argv.timeout,
    log: logger,
  });

  fs.mkdirSync(path.dirname(argv.output), { recursive: true });
  fs.writeFileSync(argv.output, YAML.dump(report, { lineWidth: -1, noRefs: true }));

  logger(`Summary: ${JSON.stringify(report.summary)}`);
  logger(`Report written to: ${argv.output}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
