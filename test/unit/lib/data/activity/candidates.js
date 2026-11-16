const chai = require('chai');

const { expect } = chai;

const {
  fromIssue,
  fromPullRequest,
  fromTool,
  getChangedLines,
  getChangedTools,
  mergeCandidates,
  parseIssueFields,
} = require('../../../../../lib/data/activity/candidates');

describe(__filename, () => {
  describe('fromTool', () => {
    it('Uses the repository field as the source repository and links as websites', () => {
      const candidate = fromTool({
        id: 'abc',
        name: 'Tool',
        repository: 'https://github.com/owner/tool',
        link: ['https://tool.example', 'https://github.com/owner/tool'],
        source: ['https://openapi.tools/', 'https://github.com/topics/openapi3'],
      });

      expect(candidate.name).to.equal('Tool');
      expect(candidate.repository.url).to.equal('https://github.com/owner/tool');
      expect(candidate.websites).to.deep.equal(['https://tool.example']);
      expect(candidate.listedOnOpenapiTools).to.equal(true);
      expect(candidate.sources).to.deep.equal([{ type: 'tools.yaml', id: 'abc' }]);
    });
    it('Uses a repository-shaped link when there is no repository field', () => {
      expect(fromTool({ id: 'abc', name: 'Tool', link: 'https://github.com/owner/tool' }).repository.path)
        .to.equal('owner/tool');
    });
    it('Uses the repository path as the name when the tool has no name', () => {
      expect(fromTool({ id: 'abc', repository: 'https://github.com/owner/tool' }).name)
        .to.equal('owner/tool');
    });
    it('Treats an organisation page as no repository and excludes it from websites', () => {
      const candidate = fromTool({
        id: 'abc', name: 'Tool', repository: 'https://github.com/owner', link: 'https://tool.example',
      });

      expect(candidate.repository).to.equal(null);
      expect(candidate.websites).to.deep.equal(['https://tool.example']);
    });
    it('Treats a non-repository URL in the repository field as a website', () => {
      expect(fromTool({ id: 'abc', name: 'Tool', repository: 'https://www.npmjs.com/package/tool' }).websites)
        .to.deep.equal(['https://www.npmjs.com/package/tool']);
    });
  });

  describe('parseIssueFields', () => {
    it('Parses the issue template format', () => {
      expect(parseIssueFields('- Display name: **APIQuality**\r\n- Repository: \r\n- Homepage: https://apiquality.io\r\n'))
        .to.deep.equal({ name: 'APIQuality', repository: '', homepage: 'https://apiquality.io' });
    });
    it('Parses bold keys and alternative field names', () => {
      expect(parseIssueFields('- **Name:** Gesso\n- **Homepage:** https://h.example/\n- **Source repository:** https://github.com/a/b'))
        .to.deep.equal({ name: 'Gesso', homepage: 'https://h.example/', repository: 'https://github.com/a/b' });
    });
    it('Parses unbulleted lines with stray bold markers', () => {
      expect(parseIssueFields('**Display name: Fidus\n\nRepository: N/A\n\nHomepage: https://f.example***'))
        .to.deep.equal({ name: 'Fidus', repository: 'N/A', homepage: 'https://f.example' });
    });
  });

  describe('fromIssue', () => {
    const issue = (title, body) => ({
      number: 1, title, body, url: 'https://github.com/OAI/tools.openapis.org/issues/1',
    });

    it('Builds a candidate from a tool submission', () => {
      const candidate = fromIssue(issue('Add Tool', '## Tool Properties\n- Display name: Tool\n- Repository: Not open source\n- Homepage: https://tool.example'));

      expect(candidate.name).to.equal('Tool');
      expect(candidate.repository).to.equal(null);
      expect(candidate.websites).to.deep.equal(['https://tool.example']);
      expect(candidate.sources[0]).to.include({ type: 'issue', number: 1 });
    });
    it('Uses a repository URL given as the homepage', () => {
      expect(fromIssue(issue('Add apigen.net', 'Display name: apigen.net\nRepository:\nHomepage: https://github.com/apiaddicts/apigen.net/')).repository.path)
        .to.equal('apiaddicts/apigen.net');
    });
    it('Falls back to the title for the name', () => {
      expect(fromIssue(issue('Add tool: Gesso', '- Homepage: https://g.example')).name).to.equal('Gesso');
    });
    it('Ignores issues that are not tool submissions', () => {
      expect(fromIssue(issue('Build fails', '- Homepage: https://g.example'))).to.equal(null);
    });
    it('Ignores tool submissions without any URLs', () => {
      expect(fromIssue(issue('Add link to the main org page', 'Any chance to add a link?'))).to.equal(null);
    });
  });

  describe('getChangedLines', () => {
    it('Returns added line numbers in the new file', () => {
      const patch = '@@ -1,3 +1,4 @@\n a\n-b\n+c\n+d\n e\n@@ -10,2 +11,2 @@\n x\n+y';

      expect([...getChangedLines(patch)]).to.deep.equal([2, 3, 12]);
    });
  });

  describe('getChangedTools', () => {
    const toolsFile = [
      '- name: One',
      '  id: 1',
      '- name: Two',
      '  id: 2',
      '  link: https://two.example',
      '- name: Three',
      '  id: 3',
    ].join('\n');

    it('Returns entries containing changed lines', () => {
      expect(getChangedTools(toolsFile, '@@ -3,2 +3,3 @@\n - name: Two\n   id: 2\n+  link: https://two.example'))
        .to.deep.equal([{ name: 'Two', id: 2, link: 'https://two.example' }]);
    });
    it('Returns a new entry at the end of the file', () => {
      expect(getChangedTools(toolsFile, '@@ -5,0 +6,2 @@\n+- name: Three\n+  id: 3'))
        .to.deep.equal([{ name: 'Three', id: 3 }]);
    });
  });

  describe('fromPullRequest', () => {
    it('Attributes tools to the Pull Request', () => {
      const [candidate] = fromPullRequest(
        { number: 2, title: 'Add Tool', url: 'https://github.com/OAI/tools.openapis.org/pull/2' },
        [{ name: 'Tool', link: 'https://tool.example' }],
      );

      expect(candidate.sources).to.deep.equal([{
        type: 'pull-request', number: 2, title: 'Add Tool', url: 'https://github.com/OAI/tools.openapis.org/pull/2',
      }]);
    });
  });

  describe('mergeCandidates', () => {
    it('Merges candidates with the same repository, ignoring case', () => {
      const merged = mergeCandidates([
        fromTool({ id: 'a', name: 'Tool', repository: 'https://github.com/Owner/Tool' }),
        fromIssue({
          number: 1, title: 'Add Tool', body: '- Repository: https://github.com/owner/tool\n- Homepage: https://tool.example', url: 'u',
        }),
      ]);

      expect(merged).to.have.length(1);
      expect(merged[0].name).to.equal('Tool');
      expect(merged[0].websites).to.deep.equal(['https://tool.example']);
      expect(merged[0].sources.map(({ type }) => type)).to.deep.equal(['tools.yaml', 'issue']);
    });
    it('Prefers an explicit name over a name derived from the repository path', () => {
      const [merged] = mergeCandidates([
        fromTool({ id: 'a', repository: 'https://github.com/owner/tool' }),
        fromIssue({
          number: 1, title: 'Add Tool', body: '- Repository: https://github.com/owner/tool', url: 'u',
        }),
      ]);

      expect(merged.name).to.equal('Tool');
    });
    it('Merges candidates without a repository by website', () => {
      expect(mergeCandidates([
        fromTool({ id: 'a', name: 'A', link: 'https://www.tool.example/' }),
        fromTool({ id: 'b', name: 'B', link: 'https://tool.example' }),
      ])).to.have.length(1);
    });
    it('Drops candidates with no repository or website and does not mutate inputs', () => {
      const first = fromTool({ id: 'a', name: 'A', link: 'https://tool.example' });

      expect(mergeCandidates([
        first,
        fromTool({ id: 'b', name: 'B', link: 'https://tool.example' }),
        fromTool({ id: 'c', name: 'C' }),
      ])).to.have.length(1);
      expect(first.sources).to.have.length(1);
    });
  });
});
