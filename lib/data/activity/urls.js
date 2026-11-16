/**
 * URL helpers for identifying source code repositories and websites
 */

// Hosts where activity can be determined from the repository itself
const REPOSITORY_HOSTS = {
  'github.com': 'github',
  'gitlab.com': 'gitlab',
  'bitbucket.org': 'bitbucket',
};

const URL_PATTERN = /https?:\/\/[^\s<>()[\]"'`*]+/gi;

const parseUrl = (value) => {
  try {
    const url = new URL(String(value).trim());
    return /^https?:$/.test(url.protocol) ? url : null;
  } catch (err) {
    return null;
  }
};

const getHost = (url) => url.hostname.toLowerCase().replace(/^www\./, '');

/**
 * Extract all http(s) URLs from free text, e.g. a Markdown issue body
 *
 * @param {string} text Text to search
 * @returns {string[]} URLs in order of appearance
 */
const extractUrls = (text) => (String(text || '').match(URL_PATTERN) || [])
  .map((url) => url.replace(/[.,;:!?]+$/, ''));

/**
 * Parse a URL as a source code repository on a supported host
 *
 * @param {string} value URL to parse
 * @returns {Object|null} Repository descriptor, or null when the URL is not a repository
 */
const parseRepository = (value) => {
  const url = parseUrl(value);

  if (!url) {
    return null;
  }

  const host = getHost(url);
  const provider = REPOSITORY_HOSTS[host];

  if (!provider) {
    return null;
  }

  const segments = url.pathname.split('/').filter(Boolean).map((s) => s.replace(/\.git$/, ''));

  if (provider === 'gitlab') {
    // GitLab supports nested groups; the project path ends at the "/-/" separator
    const end = segments.indexOf('-');
    const path = end === -1 ? segments : segments.slice(0, end);

    return path.length < 2
      ? null
      : { provider, path: path.join('/'), url: `https://${host}/${path.join('/')}` };
  }

  if (segments.length < 2) {
    return null;
  }

  const [owner, name] = segments;

  return {
    provider, owner, name, path: `${owner}/${name}`, url: `https://${host}/${owner}/${name}`,
  };
};

/**
 * Indicates whether a URL is on a repository host. Organisation and user pages on these
 * hosts say nothing about whether a project is active, so they are not treated as websites.
 *
 * @param {string} value URL to test
 * @returns {boolean} true if the URL is on a repository host
 */
const isRepositoryHost = (value) => {
  const url = parseUrl(value);

  return Boolean(url && REPOSITORY_HOSTS[getHost(url)]);
};

/**
 * Get a comparable key for a website URL (host and path, ignoring scheme, www and trailing slash)
 *
 * @param {string} value URL to normalise
 * @returns {string|null} Normalised key
 */
const normaliseWebsite = (value) => {
  const url = parseUrl(value);

  return url ? `${getHost(url)}${url.pathname.replace(/\/+$/, '')}` : null;
};

module.exports = {
  extractUrls,
  isRepositoryHost,
  normaliseWebsite,
  parseRepository,
  parseUrl,
};
