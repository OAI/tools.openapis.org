const chai = require('chai');
const sinon = require('sinon');

const { expect } = chai;

const providers = require('../../../../../lib/data/activity/providers');
const {
  evaluateCandidate, findActiveProjects, getActiveSince,
} = require('../../../../../lib/data/activity');

const NOW = new Date('2026-11-16T00:00:00Z');
const SINCE = getActiveSince(NOW, 3);

const candidate = (repository, websites = []) => ({
  name: 'Tool',
  repository: repository ? {
    provider: 'github', owner: 'o', name: 'r', path: 'o/r', url: 'https://github.com/o/r',
  } : null,
  websites,
  sources: [],
});

const reachable = async () => ({ reachable: true, status: 200 });
const evaluate = (c, activity, checkWebsite = reachable) => evaluateCandidate(c, {
  since: SINCE,
  repositoryActivity: new Map(activity ? [['github:o/r', activity]] : []),
  checkWebsite,
});

describe(__filename, () => {
  describe('getActiveSince', () => {
    it('Subtracts the window in months', () => {
      expect(SINCE.toISOString()).to.equal('2026-08-16T00:00:00.000Z');
    });
  });

  describe('evaluateCandidate', () => {
    it('Marks a repository with a recent commit as active', async () => {
      expect(await evaluate(candidate(true), { found: true, lastCommit: '2026-10-01T00:00:00Z', stars: 51 }))
        .to.deep.equal({
          status: 'active',
          condition: 'repository-activity',
          evidence: { repository: 'https://github.com/o/r', lastCommit: '2026-10-01T00:00:00Z', stars: 51 },
        });
    });
    it('Marks a GitHub repository with a recent commit and not more than 50 stars as inactive', async () => {
      expect(await evaluate(candidate(true), { found: true, lastCommit: '2026-10-01T00:00:00Z', stars: 50 }))
        .to.deep.equal({ status: 'inactive', reason: '50 stars (more than 50 required)' });
    });
    it('Applies a custom star threshold', async () => {
      const result = await evaluateCandidate(candidate(true), {
        since: SINCE,
        repositoryActivity: new Map([['github:o/r', { found: true, lastCommit: '2026-10-01T00:00:00Z', stars: 11 }]]),
        checkWebsite: reachable,
        minStars: 10,
      });

      expect(result.status).to.equal('active');
    });
    it('Does not apply the star threshold to repositories outside GitHub', async () => {
      const gitlab = {
        ...candidate(false),
        repository: {
          provider: 'gitlab', path: 'g/p', url: 'https://gitlab.com/g/p',
        },
      };
      const result = await evaluateCandidate(gitlab, {
        since: SINCE,
        repositoryActivity: new Map([['gitlab:g/p', { found: true, lastCommit: '2026-10-01T00:00:00Z' }]]),
        checkWebsite: reachable,
      });

      expect(result.status).to.equal('active');
    });
    it('Marks a repository without a recent commit as inactive, regardless of website', async () => {
      const checkWebsite = sinon.stub().resolves({ reachable: true, status: 200 });
      const result = await evaluate(
        candidate(true, ['https://tool.example']),
        { found: true, lastCommit: '2026-08-15T23:59:59Z', stars: 100 },
        checkWebsite,
      );

      expect(result.status).to.equal('inactive');
      expect(checkWebsite.called).to.equal(false);
    });
    it('Marks a project without a repository and with a reachable website as active', async () => {
      const checkWebsite = sinon.stub();

      checkWebsite.onFirstCall().resolves({ reachable: false, error: 'ENOTFOUND' });
      checkWebsite.onSecondCall().resolves({ reachable: true, status: 200 });

      expect(await evaluate(candidate(false, ['https://a.example', 'https://b.example']), null, checkWebsite))
        .to.deep.equal({
          status: 'active',
          condition: 'website-reachable',
          evidence: { website: 'https://b.example', status: 200 },
        });
    });
    it('Falls back to the website when the repository no longer exists', async () => {
      const result = await evaluate(candidate(true, ['https://tool.example']), { found: false });

      expect(result.condition).to.equal('website-reachable');
      expect(result.evidence.notes).to.deep.equal(['Repository not found: https://github.com/o/r']);
    });
    it('Marks a project without a repository and with an unreachable website as inactive', async () => {
      const result = await evaluate(candidate(false, ['https://tool.example']), null, async () => ({ reachable: false, status: 503 }));

      expect(result).to.deep.equal({ status: 'inactive', reason: 'Website not reachable: https://tool.example (503)' });
    });
    it('Marks a project as unresolved when the repository check fails', async () => {
      expect((await evaluate(candidate(true), { error: 'timeout' })).status).to.equal('unresolved');
    });
  });

  describe('findActiveProjects', () => {
    afterEach(() => sinon.restore());

    it('Reports active projects from tools.yaml, Issues and Pull Requests', async () => {
      sinon.stub(providers, 'getOpenIssues').resolves([
        {
          number: 1, title: 'Add Site Tool', body: '- Homepage: https://site.example', url: 'https://i/1',
        },
        {
          number: 2, title: 'Build fails', body: 'Broken', url: 'https://i/2',
        },
      ]);
      sinon.stub(providers, 'getOpenPullRequests').resolves([
        {
          number: 3, title: 'Add PR Tool', url: 'https://p/3', headRefOid: 'sha', files: ['src/_data/tools.yaml'],
        },
        {
          number: 4, title: 'Fix build', url: 'https://p/4', headRefOid: 'sha', files: ['lib/x.js'],
        },
      ]);
      sinon.stub(providers, 'getPullRequestFilePatch').resolves('@@ -0,0 +1,2 @@\n+- name: PR Tool\n+  repository: https://github.com/pr/tool');
      sinon.stub(providers, 'getFileAtRef').resolves('- name: PR Tool\n  repository: https://github.com/pr/tool\n');
      sinon.stub(providers, 'getGithubActivity').resolves(new Map([
        ['yaml/active', { found: true, lastCommit: '2026-11-01T00:00:00Z', stars: 100 }],
        ['yaml/stale', { found: true, lastCommit: '2025-01-01T00:00:00Z', stars: 100 }],
        ['pr/tool', { found: true, lastCommit: '2026-09-01T00:00:00Z', stars: 100 }],
      ]));
      sinon.stub(providers, 'checkWebsite').resolves({ reachable: true, status: 200 });

      const report = await findActiveProjects([
        { id: 'a', name: 'Active', repository: 'https://github.com/yaml/active' },
        { id: 's', name: 'Stale', repository: 'https://github.com/yaml/stale' },
      ], {
        token: 't', owner: 'OAI', repo: 'tools.openapis.org', now: NOW,
      });

      expect(report.projects.map(({ name, condition }) => ({ name, condition }))).to.deep.equal([
        { name: 'Active', condition: 'repository-activity' },
        { name: 'PR Tool', condition: 'repository-activity' },
        { name: 'Site Tool', condition: 'website-reachable' },
      ]);
      expect(report.summary).to.deep.equal({
        projectsChecked: 4,
        active: 3,
        inactive: 1,
        unresolved: 0,
        activeByCondition: { 'repository-activity': 2, 'website-reachable': 1 },
        activeBySource: { 'tools.yaml': 1, 'pull-request': 1, issue: 1 },
      });
      expect(providers.getFileAtRef.calledOnce).to.equal(true);
    });
  });
});
