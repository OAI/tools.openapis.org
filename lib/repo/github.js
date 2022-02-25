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
const getReadme = (response, url) => {
  if (!response || !response.data || response.status === 304 || response.status !== 200) {
    logger(`No update for readme: ${url}`);
    return {};
  }

  const readmeEtag = response.headers.etag;
  const readmeLastModified = response.headers['last-modified'];

  logger(url, readmeEtag, readmeLastModified);

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
 * Gets repository properties from GitHub API and filters based on JSONPaths
 *
 * @param {string} url GitHub repository URL as sourced by caller
 * @param {string} username GitHub username
 * @param {string} password GitHub password/access token
 * @returns {Object} Repository metadata
 */
module.exports = async (
  url,
  username,
  password,
  repositoryMetadata = {},
) => {
  const paths = [
    { source: '$.data.description', target: 'description' },
    { source: '$.data.created_at', target: 'created' },
    { source: '$.data.updated_at', target: 'updated' },
    { source: '$.data.language', target: 'language' },
    { source: '$.data.archived', target: 'archived' },
    { source: '$.data.stargazers_count', target: 'stars' },
    { source: '$.data.watchers_count', target: 'watchers' },
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
  const validateStatus = (status) => status < 400;

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

  // Get repository metadata. If a 404 is returned mark as not found, throw any other errors
  try {
    const headers = setCacheControlHeaders(repoEtag, repolastModified);

    repoResponse = await http.get(
      `https://api.github.com/repos/${organization}/${repo}`,
      {
        auth: { username, password }, headers, validateStatus,
      },
    );
  } catch (err) {
    if (err.response.status === 404) {
      // The repository does not exist (there is a bunch of this in the existing sources)
      // Return an indicator that the repository does not exist
      return { repositoryMetadata: { notFound: true } };
    }

    throw err;
  }

  // Get readme. If a 404 then ignore, otherwise throw the original error
  try {
    const headers = {
      Accept: 'application/vnd.github.VERSION.raw',
      ...setCacheControlHeaders(readmeEtag, readmeLastModified),
    };

    readmeResponse = await http.get(
      `https://api.github.com/repos/${organization}/${repo}/readme`,
      { auth: { username, password }, headers, validateStatus },
    );
  } catch (err) {
    if (err.response.status !== 404) {
      throw err;
    }
  }

  // If a 304 or a non-200 is returned from GitHub return the original response
  // The readme will also be updated if it has changed
  if (repoResponse.status === 304 || repoResponse.status !== 200) {
    logger(`No update for repository metadata: ${url}`);
    return { repositoryMetadata: { ...repositoryMetadata, ...getReadme(readmeResponse, url) } };
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
      repositoryMetadata: getReadme(readmeResponse, url),
    });
};
