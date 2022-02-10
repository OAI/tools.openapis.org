const http = require('axios');
const log = require('fancy-log');
const dl = require('talisman/metrics/damerau-levenshtein');
const dice = require('talisman/metrics/dice');
const jsonpath = require('jsonpath');

module.exports = {
  /**
   * Gets repository properties from GitHub API and filters based on JSONPaths
   *
   * @param {string} url GitHub repository URL as sourced by caller
   * @param {string} username GitHub username
   * @param {string} password GitHub password
   * @returns {Object} Repository metadata
   */
  getGithubRepositoryMetadata: async (url, username, password) => {
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
    ];
    let repoResponse;
    let readmeResponse;

    // log(url);

    if (!url || !username || !password) {
      throw new Error('url, username and password must be supplied');
    }

    // eslint-disable-next-line no-unused-vars
    const [host, organization, repo] = url.replace(/^.*:\/\//, '').split('/');

    if (!organization || !repo) {
      log(`url not in expected format, organization and repository not found: ${url}`);
      return {};
    }

    // Get repository metadata. If a 404 is returned mark as not found
    try {
      repoResponse = await http.get(`https://api.github.com/repos/${organization}/${repo}`, { auth: { username, password } });
    } catch (err) {
      if (err.response.status === 404) {
        return { repositoryMetadata: { notFound: true } };
      }

      throw err;
    }

    // Get readme. If a 404 then ignore, otherwise throw the original error
    try {
      readmeResponse = await http.get(
        `https://api.github.com/repos/${organization}/${repo}/readme`,
        {
          auth: { username, password },
          headers: { Accept: 'application/vnd.github.VERSION.raw' },
        },
      );
    } catch (err) {
      if (err.response.status !== 404) {
        throw err;
      }
    }

    return paths
      .reduce((output, path) => {
        const value = jsonpath.query(repoResponse, path.source).pop();

        if (value !== undefined) {
          jsonpath.apply(output, '$.repositoryMetadata', () => Object.assign(output.repositoryMetadata, { [path.target]: value }));
        }

        return output;
      }, {
        repositoryMetadata: {
          ...(readmeResponse && readmeResponse.data
            ? { base64Readme: Buffer.from(readmeResponse.data).toString('base64') } : {}),
        },
      });
  },
  /**
   * Loop over source property names and normalise based on hamming distance
   * and dice (slightly rough and ready, essentially employed to handing spelling
   * mistakes and pluralisation)
   *
   * @param {string[]} sourceProperties Source property names, sourced by caller
   * @returns {Object} Object containing the property name and to what it should be mapped
   */
  normalisePropertyNames: (sourceProperties) => {
    const dlThreshold = 2;
    const propertyNames = Object.keys(sourceProperties);

    return propertyNames
      .reduce((output, propertyName) => {
        const replacementPropertyName = propertyNames
          .reduce((replacementOutput, candidateName) => {
            const distance = dl(propertyName, candidateName);
            const coefficient = dice(propertyName, candidateName);
            const nameScore = sourceProperties[propertyName];
            const candidateScore = sourceProperties[candidateName];

            // For replacement to considered the distance has to be below the replacement threshold
            // and have a strong dice coefficient of over 50%
            if (distance !== 0 && distance < dlThreshold && coefficient > 0.5) {
              log(JSON.stringify({
                propertyName,
                candidateName,
                distance,
                coefficient,
                nameScore,
                candidateScore,
              }), 'Property name mapping score');

              return nameScore > candidateScore ? propertyName : candidateName;
            }
            return replacementOutput;
          }, null);
        return Object.assign(output, { [propertyName]: replacementPropertyName || propertyName });
      }, {});
  },
  /**
   * Take a string that contains markers to split text and return an array based on those markers
   *
   * @param {string[]|string} sourceData String of source data to be split
   * @returns {string[]} An array of the source data, split on the makers after noise removed
   */
  normaliseSplitters: (sourceData) => [...new Set(
    (Array.isArray(sourceData) ? sourceData : [sourceData])
      .map((source) => source.replace(/("|\[|\])/g, '')
        .split(/[&,/]/g)
        .map((value) => value.trim()))
      .reduce((output, value) => output.concat(value), []),
  )],
};
