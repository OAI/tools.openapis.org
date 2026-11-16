/**
 * Identifies active projects across tools.yaml, open tool submission Issues and open Pull
 * Requests that add or change tools.yaml entries.
 *
 * A project is active when either:
 *
 * 1. repository-activity: its source code repository has a commit on the default branch
 *    within the activity window. GitHub repositories must also have more than a minimum
 *    number of stars (50 by default).
 * 2. website-reachable: it has no source code repository and one of its websites responds
 *    with a successful status.
 *
 * Projects with a repository that has no recent commits are inactive, even if their website
 * is reachable. A repository that no longer exists is treated as no repository.
 */

const Promise = require('bluebird');

const candidates = require('./candidates');
const providers = require('./providers');

const DEFAULT_MIN_STARS = 50;

const getCriteria = (minStars) => ({
  'repository-activity': 'Commit on the default branch of the source code repository within the activity window'
    + ` and, for GitHub repositories, more than ${minStars} stars`,
  'website-reachable': 'No source code repository exists and the website responded with a successful (2xx) status',
});

/**
 * Get the start of the activity window
 *
 * @param {Date} now Current date
 * @param {number} months Window length in months
 * @returns {Date} Start of the window
 */
const getActiveSince = (now, months) => {
  const since = new Date(now);

  since.setUTCMonth(since.getUTCMonth() - months);
  return since;
};

/**
 * Evaluate a single candidate against the activity criteria
 *
 * @param {Object} candidate Candidate project
 * @param {Object} options since (Date), repositoryActivity (Map keyed by candidate repository
 * key), checkWebsite (async function) and minStars (GitHub repositories only)
 * @returns {Object} Result with status of active, inactive or unresolved
 */
const evaluateCandidate = async (candidate, {
  since, repositoryActivity, checkWebsite, minStars = DEFAULT_MIN_STARS,
}) => {
  const notes = [];
  const { repository } = candidate;

  if (repository) {
    const activity = repositoryActivity.get(
      `${repository.provider}:${repository.path.toLowerCase()}`,
    ) || { error: 'Repository not checked' };

    if (activity.error) {
      return { status: 'unresolved', reason: `Repository check failed: ${activity.error}` };
    }

    if (activity.found) {
      // Star counts are only available for GitHub repositories
      if (repository.provider === 'github' && !(activity.stars > minStars)) {
        return { status: 'inactive', reason: `${activity.stars || 0} stars (more than ${minStars} required)` };
      }

      if (activity.lastCommit && new Date(activity.lastCommit) >= since) {
        return {
          status: 'active',
          condition: 'repository-activity',
          evidence: {
            repository: repository.url,
            lastCommit: activity.lastCommit,
            ...(activity.stars !== undefined ? { stars: activity.stars } : {}),
            ...(activity.archived ? { archived: true } : {}),
          },
        };
      }

      return {
        status: 'inactive',
        reason: activity.lastCommit ? `Last commit ${activity.lastCommit}` : 'Repository has no commits',
      };
    }

    notes.push(`Repository not found: ${repository.url}`);
  }

  const checks = [];

  // Check sequentially and stop at the first reachable website
  // eslint-disable-next-line no-restricted-syntax
  for (const website of candidate.websites) {
    // eslint-disable-next-line no-await-in-loop
    const result = await checkWebsite(website);

    if (result.reachable) {
      return {
        status: 'active',
        condition: 'website-reachable',
        evidence: { website, status: result.status, ...(notes.length ? { notes } : {}) },
      };
    }

    checks.push(`${website} (${result.status || result.error})`);
  }

  return {
    status: 'inactive',
    reason: checks.length ? `Website not reachable: ${checks.join(', ')}` : 'No repository or website',
  };
};

/**
 * Get last commit dates for all candidate repositories, grouped by provider
 *
 * @returns {Map<string, Object>} Keyed by "provider:path" (lower case)
 */
const getRepositoryActivity = async (merged, { token, concurrency, log }) => {
  const repositories = merged.map(({ repository }) => repository).filter(Boolean);
  const byProvider = (provider) => repositories.filter((r) => r.provider === provider);
  const activity = new Map();

  const github = await providers.getGithubActivity(token, byProvider('github'), log);

  github.forEach((value, key) => activity.set(`github:${key}`, value));

  await Promise.map([
    ...byProvider('gitlab').map((r) => ({ r, fn: providers.getGitlabActivity })),
    ...byProvider('bitbucket').map((r) => ({ r, fn: providers.getBitbucketActivity })),
  ], async ({ r, fn }) => {
    activity.set(`${r.provider}:${r.path.toLowerCase()}`, await fn(r));
  }, { concurrency });

  return activity;
};

/**
 * Collect candidates from tools.yaml, open Issues and open Pull Requests
 */
const collectCandidates = async (tools, {
  token, owner, repo, log,
}) => {
  log(`Reading ${tools.length} tools.yaml entries`);
  const fromTools = tools.map((tool) => candidates.fromTool(tool));

  log(`Reading open Issues from ${owner}/${repo}`);
  const issues = await providers.getOpenIssues(token, owner, repo);
  const fromIssues = issues.map(candidates.fromIssue).filter(Boolean);
  log(`Found ${fromIssues.length} tool submissions in ${issues.length} open Issues`);

  log(`Reading open Pull Requests from ${owner}/${repo}`);
  const pullRequests = (await providers.getOpenPullRequests(token, owner, repo))
    .filter(({ files }) => files.includes(candidates.TOOLS_FILE_PATH));
  const fromPullRequests = (await Promise.mapSeries(pullRequests, async (pullRequest) => {
    const { number, headRefOid } = pullRequest;
    const { TOOLS_FILE_PATH } = candidates;
    const [patch, toolsFile] = await Promise.all([
      providers.getPullRequestFilePatch(token, owner, repo, number, TOOLS_FILE_PATH),
      providers.getFileAtRef(token, owner, repo, TOOLS_FILE_PATH, headRefOid),
    ]);

    if (!patch) {
      log(`Warning: no patch available for ${candidates.TOOLS_FILE_PATH} in ${pullRequest.url}`);
      return [];
    }

    return candidates.fromPullRequest(pullRequest, candidates.getChangedTools(toolsFile, patch));
  })).flat();
  log(`Found ${fromPullRequests.length} tools.yaml changes in ${pullRequests.length} open Pull Requests`);

  return [...fromTools, ...fromIssues, ...fromPullRequests];
};

const toOutputProject = ({ candidate, result }) => ({
  name: candidate.name,
  ...(result.condition ? { condition: result.condition, evidence: result.evidence } : {}),
  ...(result.reason ? { reason: result.reason } : {}),
  repository: candidate.repository ? candidate.repository.url : null,
  websites: candidate.websites,
  listedOnOpenapiTools: candidate.listedOnOpenapiTools,
  sources: candidate.sources,
});

const countBy = (items, fn) => items.reduce((counts, item) => {
  [].concat(fn(item)).forEach((key) => {
    counts[key] = (counts[key] || 0) + 1; // eslint-disable-line no-param-reassign
  });
  return counts;
}, {});

/**
 * Find all active projects
 *
 * @param {Object[]} tools tools.yaml entries
 * @param {Object} options token, owner, repo, months, now, concurrency, log
 * @returns {Object} Report containing active projects and any that could not be resolved
 */
const findActiveProjects = async (tools, {
  token,
  owner,
  repo,
  months = 3,
  minStars = DEFAULT_MIN_STARS,
  now = new Date(),
  concurrency = 8,
  timeout = 15000,
  log = () => {},
}) => {
  const since = getActiveSince(now, months);
  const merged = candidates.mergeCandidates(
    await collectCandidates(tools, {
      token, owner, repo, log,
    }),
  );

  log(`Checking ${merged.length} unique projects for activity since ${since.toISOString()}`);
  const repositoryActivity = await getRepositoryActivity(merged, { token, concurrency, log });

  log('Checking websites for projects without a source code repository');
  const results = await Promise.map(merged, async (candidate) => ({
    candidate,
    result: await evaluateCandidate(candidate, {
      since,
      repositoryActivity,
      minStars,
      checkWebsite: (url) => providers.checkWebsite(url, timeout),
    }),
  }), { concurrency });

  const byName = (a, b) => String(a.name).localeCompare(String(b.name));
  const active = results.filter(({ result }) => result.status === 'active').map(toOutputProject).sort(byName);
  const unresolved = results.filter(({ result }) => result.status === 'unresolved').map(toOutputProject).sort(byName);

  return {
    generatedAt: now.toISOString(),
    activeSince: since.toISOString(),
    minStars,
    criteria: getCriteria(minStars),
    summary: {
      projectsChecked: merged.length,
      active: active.length,
      inactive: results.length - active.length - unresolved.length,
      unresolved: unresolved.length,
      activeByCondition: countBy(active, ({ condition }) => condition),
      activeBySource: countBy(
        active,
        ({ sources }) => [...new Set(sources.map(({ type }) => type))],
      ),
    },
    projects: active,
    unresolved,
  };
};

module.exports = {
  DEFAULT_MIN_STARS,
  getCriteria,
  evaluateCandidate,
  findActiveProjects,
  getActiveSince,
};
