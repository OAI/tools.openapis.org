/**
 * Builds candidate projects from tools.yaml entries, Issues and Pull Requests
 */

const YAML = require('js-yaml');

const {
  extractUrls, isRepositoryHost, normaliseWebsite, parseRepository,
} = require('./urls');

const TOOLS_FILE_PATH = 'src/_data/tools.yaml';

const asArray = (value) => (Array.isArray(value) ? value : [value])
  .filter((v) => typeof v === 'string' && v.trim());

/**
 * Create a candidate from an ordered list of URLs. The first URL that resolves to a
 * repository is used as the source repository; all other URLs (excluding pages on
 * repository hosts) are treated as websites.
 */
const buildCandidate = ({
  name, urls, source, listedOnOpenapiTools = false,
}) => {
  let repository = null;
  const websites = [];

  urls.forEach((url) => {
    const parsed = parseRepository(url);

    if (parsed) {
      repository = repository || parsed;
      return;
    }

    if (!isRepositoryHost(url) && !websites.includes(url)) {
      websites.push(url);
    }
  });

  // Most tools sourced from GitHub topics have no name, so fall back to the repository path
  return {
    name: name || (repository && repository.path) || websites[0] || null,
    repository,
    websites,
    listedOnOpenapiTools,
    sources: [source],
  };
};

/**
 * Build a candidate from a tools.yaml entry
 *
 * @param {Object} tool Entry from tools.yaml
 * @param {Object} source Overrides the source reference (used for Pull Requests)
 * @returns {Object} Candidate project
 */
const fromTool = (tool, source) => buildCandidate({
  name: asArray(tool.name)[0],
  urls: [...asArray(tool.repository), ...asArray(tool.link), ...asArray(tool.homepage)],
  source: source || { type: 'tools.yaml', id: tool.id },
  listedOnOpenapiTools: asArray(tool.source).some((s) => /openapi\.tools/.test(s)),
});

const ISSUE_FIELDS = {
  name: ['display name', 'name', 'tool name'],
  repository: ['repository', 'source repository', 'source code', 'repo', 'code repository'],
  homepage: ['homepage', 'home page', 'website', 'url', 'link'],
};

/**
 * Parse "Key: value" lines from an issue body, tolerating the Markdown formatting
 * variations seen in submitted issues (bold markers, bullets, quotes)
 *
 * @param {string} body Issue body
 * @returns {Object} name, repository and homepage values where present
 */
const parseIssueFields = (body) => String(body || '')
  .split(/\r?\n/)
  .reduce((fields, line) => {
    const match = line
      .replace(/[*`]/g, '')
      .replace(/^\s*>\s*/, '')
      .match(/^\s*(?:[-+]\s+)?([A-Za-z][A-Za-z ]*?)\s*:\s*(.*)$/);

    if (!match) {
      return fields;
    }

    const key = match[1].toLowerCase();
    const field = Object.keys(ISSUE_FIELDS).find((f) => ISSUE_FIELDS[f].includes(key));

    return field && fields[field] === undefined
      ? { ...fields, [field]: match[2].trim() }
      : fields;
  }, {});

/**
 * Indicates whether an issue is a tool submission, either using the issue template or
 * titled as a request to add or register a tool
 */
const isToolIssue = ({ title, body }) => /##\s*Tool\s+Properties/i.test(body || '')
  || /^\s*(add|register)\b/i.test(title || '');

/**
 * Build a candidate from a tool submission Issue
 *
 * @param {Object} issue Issue with number, title, body and url
 * @returns {Object|null} Candidate project, or null if the issue is not a tool submission
 */
const fromIssue = (issue) => {
  if (!isToolIssue(issue)) {
    return null;
  }

  const fields = parseIssueFields(issue.body);
  const urls = [...extractUrls(fields.repository), ...extractUrls(fields.homepage)];

  if (urls.length === 0) {
    return null;
  }

  return buildCandidate({
    name: fields.name || issue.title.replace(/^\s*(add|register)\s*(tool\s*:)?\s*/i, ''),
    urls,
    source: {
      type: 'issue', number: issue.number, title: issue.title, url: issue.url,
    },
  });
};

/**
 * Get the line numbers in the new version of a file that were added or changed by a patch
 *
 * @param {string} patch Unified diff for a single file
 * @returns {Set<number>} 1-based line numbers in the new file
 */
const getChangedLines = (patch) => {
  const changed = new Set();
  let line = 0;

  String(patch || '').split('\n').forEach((text) => {
    const hunk = text.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);

    if (hunk) {
      line = parseInt(hunk[1], 10);
    } else if (text.startsWith('+')) {
      changed.add(line);
      line += 1;
    } else if (text.startsWith(' ')) {
      line += 1;
    }
  });

  return changed;
};

/**
 * Find the tools.yaml entries added or changed by a Pull Request. Each top-level entry
 * starts with "- " at column zero; any entry containing a changed line is returned.
 *
 * @param {string} toolsFile Contents of tools.yaml at the head of the Pull Request
 * @param {string} patch Unified diff of tools.yaml from the Pull Request
 * @returns {Object[]} Parsed tools.yaml entries
 */
const getChangedTools = (toolsFile, patch) => {
  const changed = getChangedLines(patch);
  const lines = toolsFile.split('\n');
  const starts = lines.reduce((output, text, index) => (/^- /.test(text) ? output.concat(index) : output), []);

  return starts
    .map((start, i) => ({ start, end: i + 1 < starts.length ? starts[i + 1] : lines.length }))
    .filter(({ start, end }) => [...changed].some((n) => n - 1 >= start && n - 1 < end))
    .map(({ start, end }) => (YAML.load(lines.slice(start, end).join('\n')) || [])[0])
    .filter(Boolean);
};

/**
 * Build candidates from a Pull Request that adds or changes tools.yaml entries
 *
 * @param {Object} pullRequest Pull Request with number, title and url
 * @param {Object[]} tools tools.yaml entries changed by the Pull Request
 * @returns {Object[]} Candidate projects
 */
const fromPullRequest = (pullRequest, tools) => tools.map((tool) => fromTool(tool, {
  type: 'pull-request', number: pullRequest.number, title: pullRequest.title, url: pullRequest.url,
}));

const getCandidateKey = ({ repository, websites }) => {
  if (repository) {
    return `repository:${repository.provider}:${repository.path.toLowerCase()}`;
  }

  return websites.length > 0 ? `website:${normaliseWebsite(websites[0])}` : null;
};

/**
 * Combine candidates that refer to the same project (same repository or, where there is
 * no repository, the same primary website), so each project is checked and reported once.
 * Candidates with no repository and no website cannot be checked and are dropped.
 *
 * @param {Object[]} candidates Candidate projects
 * @returns {Object[]} Merged candidate projects
 */
const mergeCandidates = (candidates) => [...candidates
  .reduce((merged, candidate) => {
    const key = getCandidateKey(candidate);

    if (!key) {
      return merged;
    }

    const existing = merged.get(key);

    if (!existing) {
      return merged.set(key, {
        ...candidate, websites: [...candidate.websites], sources: [...candidate.sources],
      });
    }

    candidate.websites
      .filter((w) => !existing.websites.includes(w))
      .forEach((w) => existing.websites.push(w));
    existing.sources.push(...candidate.sources);
    // Prefer an explicit name (e.g. from an Issue) over one derived from the repository path
    if (existing.repository && existing.name === existing.repository.path) {
      existing.name = candidate.name;
    }
    existing.listedOnOpenapiTools = existing.listedOnOpenapiTools
      || candidate.listedOnOpenapiTools;

    return merged;
  }, new Map())
  .values()];

module.exports = {
  TOOLS_FILE_PATH,
  fromIssue,
  fromPullRequest,
  fromTool,
  getChangedLines,
  getChangedTools,
  isToolIssue,
  mergeCandidates,
  parseIssueFields,
};
