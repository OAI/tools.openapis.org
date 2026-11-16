const chai = require('chai');

const { expect } = chai;

const {
  extractUrls, isRepositoryHost, normaliseWebsite, parseRepository,
} = require('../../../../../lib/data/activity/urls');

describe(__filename, () => {
  describe('parseRepository', () => {
    it('Parses a GitHub repository URL, ignoring trailing paths and .git', () => {
      expect(parseRepository('https://www.github.com/OAI/Tooling.git/tree/main')).to.deep.equal({
        provider: 'github',
        owner: 'OAI',
        name: 'Tooling',
        path: 'OAI/Tooling',
        url: 'https://github.com/OAI/Tooling',
      });
    });
    it('Parses a GitLab repository URL with nested groups', () => {
      expect(parseRepository('https://gitlab.com/group/sub/project/-/tree/main')).to.deep.equal({
        provider: 'gitlab',
        path: 'group/sub/project',
        url: 'https://gitlab.com/group/sub/project',
      });
    });
    it('Parses a Bitbucket repository URL', () => {
      expect(parseRepository('https://bitbucket.org/team/repo/')).to.include({
        provider: 'bitbucket', path: 'team/repo',
      });
    });
    it('Returns null for an organisation page', () => {
      expect(parseRepository('https://github.com/spreadingai')).to.equal(null);
    });
    it('Returns null for a website or invalid URL', () => {
      expect(parseRepository('https://www.npmjs.com/package/foo')).to.equal(null);
      expect(parseRepository('N/A')).to.equal(null);
    });
  });

  describe('isRepositoryHost', () => {
    it('Identifies repository hosts', () => {
      expect(isRepositoryHost('https://github.com/spreadingai')).to.equal(true);
      expect(isRepositoryHost('https://omidgfx.github.io/opendoc-ui')).to.equal(false);
    });
  });

  describe('extractUrls', () => {
    it('Extracts URLs from Markdown, removing trailing punctuation', () => {
      expect(extractUrls('See [site](https://a.example/x), or https://b.example.'))
        .to.deep.equal(['https://a.example/x', 'https://b.example']);
    });
    it('Returns an empty list for missing text', () => {
      expect(extractUrls(undefined)).to.deep.equal([]);
    });
  });

  describe('normaliseWebsite', () => {
    it('Ignores scheme, www and trailing slash', () => {
      expect(normaliseWebsite('http://www.Example.com/tool/'))
        .to.equal(normaliseWebsite('https://example.com/tool'));
    });
  });
});
