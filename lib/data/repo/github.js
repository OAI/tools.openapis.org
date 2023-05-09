const http = require('axios');
const jsonpath = require('jsonpath');

const { logger } = require('../util');

/**
 * Get the readme properties, obeying any cache control responses and
 * setting cache control metadata in response
 *
 * @param {Object} response Axios response object
 * @returns {Object} Readme properties
 */
const getReadme = (response, url, repositoryMetadata = {}) => {
  if (!response || !response.data || response.status === 304 || response.status !== 200) {
    logger(`No update for readme: ${url}`);
    const { base64Readme, readmeEtag, readmeLastModified } = repositoryMetadata;

    return {
      ...(base64Readme ? { base64Readme } : {}),
      ...(readmeEtag ? { readmeEtag } : {}),
      ...(readmeLastModified ? { readmeLastModified } : {}),
    };
  }

  const readmeEtag = response.headers.etag;
  const readmeLastModified = response.headers['last-modified'];

  return {
    base64Readme: Buffer.from(response.data).toString('base64'),
    ...(readmeEtag ? { readmeEtag } : {}),
    ...(readmeLastModified ? { readmeLastModified } : {}),
  };
};

/**
 * Set cache control directive headers when available
 *
 * @param {string} etag The last etag value returned from GitHub
 * @param {string} lastModified The last last-modified value returned from GitHub
 * @returns {Object} Object containing cache control headers for Axios
 */
const setCacheControlHeaders = (etag, lastModified) => ({
  ...(etag ? { 'If-None-Match': etag } : {}),
  ...(lastModified ? { 'If-Modified-Since': lastModified } : {}),
});

/**
 * Custom function to interpet HTTP return codes as an error
 *
 * @param {int} statusCode The HTTP return code
 * @returns {boolean} true/false indicator that results in interpretation as error
 */
const validateStatus = (statusCode) => statusCode < 400;

/**
 * Gets repository properties from GitHub API and filters based on JSONPaths
 *
 * @param {string} url GitHub repository URL as sourced by caller
 * @param {string} username GitHub username
 * @param {string} password GitHub password/access token
 * @returns {Object} Repository metadata
 */
module.exports = {
  getGithubRepositoryMetadata: async (
    url,
    username,
    password,
    repositoryMetadata = {},
  ) => {
    const paths = [
      { source: '$.data.id', target: 'repositoryId' },
      { source: '$.data.description', target: 'description' },
      { source: '$.data.created_at', target: 'created' },
      { source: '$.data.updated_at', target: 'updated' },
      { source: '$.data.language', target: 'language' },
      { source: '$.data.archived', target: 'archived' },
      { source: '$.data.stargazers_count', target: 'stars' },
      { source: '$.data.subscribers_count', target: 'watchers' },
      { source: '$.data.forks', target: 'forks' },
      { source: '$.data.organization.login', target: 'owner' },
      { source: '$.data.organization.avatar_url', target: 'logo' },
      { source: '$.data.owner.login', target: 'owner' },
      { source: '$.data.owner.avatar_url', target: 'logo' },
      { source: '$.data.license.spdx_id', target: 'license' },
      { source: '$.headers.etag', target: 'repoEtag' },
      { source: '$.headers["last-modified"]', target: 'repoLastModified' },
    ];
    const {
      repoEtag, repolastModified, readmeEtag, readmeLastModified,
    } = repositoryMetadata;

    let repoResponse;
    let readmeResponse;

    if (!url || !username || !password) {
      throw new Error('url, username and password must be supplied');
    }

    // eslint-disable-next-line no-unused-vars
    const [host, organization, repo] = url.replace(/^.*:\/\//, '').split('/');

    /* istanbul ignore if */
    if (!organization || !repo) {
      logger(`url not in expected format, organization and repository not found: ${url}`);
      return {};
    }

    const repoUrl = `https://api.github.com/repos/${organization}/${repo}`;
    let newUrl = null;
    let moved = false;

    // Get repository metadata. If a 404 is returned mark as not found, throw any other errors
    try {
      const headers = setCacheControlHeaders(repoEtag, repolastModified);

      repoResponse = await http.get(
        repoUrl,
        {
          auth: { username, password },
          headers,
          timeout: 60000,
          validateStatus,
          maxRedirects: 0,
        },
      );

      if (repoResponse.status === 301) {
      // The repository has moved so prepare to drop it out of the dataset or use the new URL
      // to identify the repository
        const targetUrl = repoResponse.data.url;

        repoResponse = await http.get(targetUrl, {
          auth: { username, password },
          timeout: 60000,
          validateStatus,
        });

        newUrl = repoResponse.data.html_url
          .toLowerCase();
        moved = true;
      }
    } catch (err) {
      if (!err.response) {
      /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'test') {
          console.error(err);
        }
        throw new Error('Could not evaluate HTTP return code when accessing metadata');
      }

      if (err.response.status === 404) {
      // The repository does not exist (there is a bunch of this in the existing sources)
      // Return an indicator that the repository does not exist
        return { repositoryMetadata: { notFound: true } };
      }

      throw new Error(`Bad HTTP response ${err.response.status} returned when calling repository URL: ${repoUrl}`);
    }

    const readmeUrl = `https://api.github.com/repos/${organization}/${repo}/readme`;

    // Get readme. If a 404 then ignore, otherwise throw the original error
    try {
      const headers = {
        Accept: 'application/vnd.github.VERSION.raw',
        ...setCacheControlHeaders(readmeEtag, readmeLastModified),
      };

      readmeResponse = await http.get(
        readmeUrl,
        {
          auth: { username, password }, headers, timeout: 60000, validateStatus,
        },
      );
    } catch (err) {
      if (!err.response) {
      /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'test') {
          console.error(err);
        }
        throw new Error('Could not evaluate HTTP return code when accessing README');
      }

      if (err.response.status !== 404) {
        throw new Error(`Bad HTTP response ${err.response.status} returned when calling README URL: ${readmeUrl}`);
      }
    }

    // If a 304 or a non-200 is returned from GitHub return the original response
    // The readme will also be updated if it has changed
    if (repoResponse.status === 304 || repoResponse.status !== 200) {
      logger(`No update for repository metadata: ${url}`);
      return {
        repositoryMetadata: {
          ...repositoryMetadata,
          ...getReadme(readmeResponse, url, repositoryMetadata),
        },
      };
    }

    // Get target metadata from the repository response based on JSONPaths
    return paths
      .reduce((output, path) => {
        const value = jsonpath.query(repoResponse, path.source).pop();

        if (value !== undefined) {
          jsonpath.apply(output, '$.repositoryMetadata', () => Object.assign(output.repositoryMetadata, { [path.target]: value }));
        }

        return output;
      }, {
        repositoryMetadata: {
          ...getReadme(readmeResponse, url, repositoryMetadata),
          ...(newUrl ? { newUrl } : {}),
          ...(moved ? { moved } : {}),
        },
      });
  },
  /**
   * Set the state of a given GitHub issue. Implemented to support closing new Tooling issues
   * raised on the repository
   *
   * @param {string} username GitHub user with access to the Tooling repository
   * @param {string} password Github access token with rights to change the state of an issue
   * @param {number} issueNumber
   * @param {string} [owner=oai] owner The repository owner
   * @param {string} [repo=Tooling] repo The repository name
   * @param {string} [state=closed] state The target state
   */
  setGithubIssueState: async (username, password, issueNumber, owner = 'OAI', repo = 'Tooling', state = 'closed') => {
    try {
      await http.patch(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
        { state },
        {
          auth: { username, password }, headers: { 'content-type': 'application/json' }, timeout: 60000, validateStatus,
        },
      );
    } catch (err) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'test') {
        console.error(err);
      }

      throw new Error(`Could not evaluate HTTP return code when closing tooling issue: ${issueNumber}`);
    }
  },
};
