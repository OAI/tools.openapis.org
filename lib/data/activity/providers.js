/**
 * Network access for activity checks: GitHub (issues, pull requests, repository activity),
 * GitLab and Bitbucket repository activity, and website reachability
 */

const http = require('axios');
const Promise = require('bluebird');

const USER_AGENT = 'oai-tooling-activity-check';
const GITHUB_API = 'https://api.github.com';
const GITHUB_BATCH_SIZE = 50;

const getGithubHeaders = (token) => ({
  Authorization: `bearer ${token}`,
  'User-Agent': USER_AGENT,
});

/**
 * Retry a request on server errors and rate limiting, with a simple linear backoff
 */
const withRetry = async (fn, retries = 3, delay = 2000) => {
  try {
    return await fn();
  } catch (err) {
    const status = err.response && err.response.status;
    const retryable = !status || status >= 500 || status === 403 || status === 429;

    if (retries <= 0 || !retryable) {
      throw err;
    }

    await Promise.delay(delay);
    return withRetry(fn, retries - 1, delay * 2);
  }
};

const githubGraphql = async (token, query, variables = {}) => {
  const response = await withRetry(() => http.post(
    `${GITHUB_API}/graphql`,
    { query, variables },
    { headers: getGithubHeaders(token) },
  ));

  return response.data;
};

/**
 * Page through a GitHub GraphQL connection on a repository
 */
const getRepositoryConnection = async (token, owner, repo, connection, fields) => {
  const query = `query($owner: String!, $repo: String!, $after: String) {
    repository(owner: $owner, name: $repo) {
      ${connection}(states: OPEN, first: 50, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { ${fields} }
      }
    }
  }`;
  const nodes = [];
  let after = null;

  do {
    // eslint-disable-next-line no-await-in-loop
    const { data, errors } = await githubGraphql(token, query, { owner, repo, after });

    if (errors) {
      throw new Error(`GitHub GraphQL error: ${JSON.stringify(errors)}`);
    }

    const { pageInfo, nodes: page } = data.repository[connection];

    nodes.push(...page);
    after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (after);

  return nodes;
};

const getOpenIssues = (token, owner, repo) => getRepositoryConnection(
  token,
  owner,
  repo,
  'issues',
  'number title body url',
);

const getOpenPullRequests = async (token, owner, repo) => (await getRepositoryConnection(
  token,
  owner,
  repo,
  'pullRequests',
  'number title url headRefOid files(first: 100) { nodes { path } }',
)).map(({ files, ...pullRequest }) => ({
  ...pullRequest,
  files: ((files && files.nodes) || []).map(({ path }) => path),
}));

/**
 * Get the patch for a single file in a Pull Request
 */
const getPullRequestFilePatch = async (token, owner, repo, number, path) => {
  for (let page = 1; ; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const { data } = await withRetry(() => http.get(
      `${GITHUB_API}/repos/${owner}/${repo}/pulls/${number}/files`,
      { headers: getGithubHeaders(token), params: { per_page: 100, page } },
    ));
    const file = data.find(({ filename }) => filename === path);

    if (file || data.length < 100) {
      return file ? file.patch : null;
    }
  }
};

/**
 * Get the raw contents of a file at a given commit. Pull Request head commits are
 * available from the base repository, so this works for Pull Requests from forks.
 */
const getFileAtRef = async (token, owner, repo, path, ref) => {
  const { data } = await withRetry(() => http.get(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`,
    {
      headers: { ...getGithubHeaders(token), Accept: 'application/vnd.github.raw' },
      params: { ref },
      responseType: 'text',
      transformResponse: [(d) => d],
      maxContentLength: Infinity,
    },
  ));

  return data;
};

/**
 * Get the date of the latest commit on the default branch for a set of GitHub repositories,
 * batched into GraphQL queries. Repositories that cannot be found are reported as such;
 * any other failure is reported as an error so the repository is not silently ignored.
 *
 * @returns {Map<string, Object>} Keyed by "owner/name" (lower case)
 */
const getGithubActivity = async (token, repositories, log = () => {}) => {
  const results = new Map();
  const batches = [];

  for (let i = 0; i < repositories.length; i += GITHUB_BATCH_SIZE) {
    batches.push(repositories.slice(i, i + GITHUB_BATCH_SIZE));
  }

  await Promise.mapSeries(batches, async (batch, index) => {
    log(`GitHub repository activity: batch ${index + 1} of ${batches.length}`);

    const query = `{ ${batch.map(({ owner, name }, i) => `r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) {
      nameWithOwner
      isArchived
      stargazerCount
      defaultBranchRef { target { ... on Commit { committedDate } } }
    }`).join('\n')} }`;

    let response;

    try {
      response = await githubGraphql(token, query);
    } catch (err) {
      batch.forEach(({ path }) => results.set(path.toLowerCase(), { error: err.message }));
      return;
    }

    const data = response.data || {};
    const errors = response.errors || [];

    batch.forEach(({ path }, i) => {
      const key = `r${i}`;
      const repository = data[key];
      const error = errors.find((e) => (e.path || [])[0] === key);

      if (repository) {
        const target = repository.defaultBranchRef && repository.defaultBranchRef.target;

        results.set(path.toLowerCase(), {
          found: true,
          archived: repository.isArchived,
          stars: repository.stargazerCount,
          lastCommit: (target && target.committedDate) || null,
        });
      } else if (error && error.type === 'NOT_FOUND') {
        results.set(path.toLowerCase(), { found: false });
      } else {
        results.set(path.toLowerCase(), { error: (error && error.message) || 'No data returned' });
      }
    });
  });

  return results;
};

const getHostedActivity = async (url, getLastCommit) => {
  try {
    const response = await withRetry(() => http.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 20000,
      validateStatus: (status) => status < 400 || status === 404,
    }));

    if (response.status === 404) {
      return { found: false };
    }

    return { found: true, lastCommit: getLastCommit(response.data) || null };
  } catch (err) {
    return { error: err.message };
  }
};

const getGitlabActivity = ({ path }) => getHostedActivity(
  `https://gitlab.com/api/v4/projects/${encodeURIComponent(path)}/repository/commits?per_page=1`,
  (data) => data[0] && data[0].committed_date,
);

const getBitbucketActivity = ({ owner, name }) => getHostedActivity(
  `https://api.bitbucket.org/2.0/repositories/${owner}/${name}/commits?pagelen=1`,
  (data) => data.values && data.values[0] && data.values[0].date,
);

/**
 * Check whether a website responds with a successful status. HEAD is tried first; some
 * servers do not support it, so any error status is retried with GET.
 *
 * @returns {Object} reachable flag plus the final HTTP status or error code
 */
const checkWebsite = async (url, timeout = 15000) => {
  const request = async (method) => {
    const response = await http.request({
      url,
      method,
      timeout,
      maxRedirects: 10,
      responseType: 'stream',
      validateStatus: () => true,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
    });

    if (response.data && response.data.destroy) {
      response.data.destroy();
    }

    return response;
  };

  try {
    let response = await request('HEAD');

    if (response.status >= 400) {
      response = await request('GET');
    }

    return { reachable: response.status >= 200 && response.status < 300, status: response.status };
  } catch (err) {
    return { reachable: false, error: err.code || err.message };
  }
};

module.exports = {
  checkWebsite,
  getBitbucketActivity,
  getFileAtRef,
  getGithubActivity,
  getGitlabActivity,
  getOpenIssues,
  getOpenPullRequests,
  getPullRequestFilePatch,
};
