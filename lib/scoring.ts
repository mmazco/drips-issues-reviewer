export const RUBRIC = [
  { key: 'title', label: 'Title', principle: 'Real Impact', desc: 'Specific, descriptive title (5+ words). Vague titles like "fix bug" = fail.' },
  { key: 'context', label: 'Context', principle: 'Clear Context', desc: 'Body explains the why, not just the what. 200+ chars = pass.' },
  { key: 'files', label: 'File Paths', principle: 'Clear Context', desc: 'References specific files, modules, or paths. 2+ refs = pass.' },
  { key: 'scope', label: 'Scope', principle: 'Scoped for Wave', desc: 'Not stacking too many area labels. 3+ stacked areas = fail.' },
  { key: 'setup', label: 'Setup Steps', principle: 'Implementation Guidelines', desc: 'Has setup/repro steps — code blocks or commands.' },
  { key: 'acceptance', label: 'Acceptance', principle: 'Explicit Expectations', desc: 'Has acceptance criteria or checkboxes. Implicit goal only = warn.' },
  { key: 'labels', label: 'Labels', principle: 'Hygiene', desc: 'At least 2 labels applied. 0 = fail, 1 = warn.' },
  { key: 'milestone', label: 'Milestone', principle: 'Hygiene', desc: 'Attached to a milestone. Missing = warn.' },
] as const;

export type RubricKey = typeof RUBRIC[number]['key'];

export interface CheckResult {
  status: 'pass' | 'warn' | 'fail';
  note: string;
}

export interface ScoredIssue {
  issue: GitHubIssue;
  checks: Record<RubricKey, CheckResult>;
  pct: number;
  grade: 'A' | 'B' | 'C' | 'D';
  suggestedComplexity: 'Trivial' | 'Medium' | 'High';
  stackedAreas: string[];
  pathMatches: string[];
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  labels: Array<{ name: string } | string>;
  milestone: { title: string } | null;
  pull_request?: unknown;
}

export interface RepoSummary {
  scored: ScoredIssue[];
  avg: number;
  dist: Record<string, number>;
  worst: ScoredIssue[];
  topFails: [string, number][];
  complexity: { Trivial: number; Medium: number; High: number };
  pointsEstimate: number;
}

export function scoreIssue(issue: GitHubIssue): ScoredIssue {
  const body = issue.body || '';
  const title = issue.title || '';
  const labels = (issue.labels || []).map(l => (typeof l === 'string' ? l : l.name));
  const labelsLower = labels.map(l => l.toLowerCase());

  const checks = {} as Record<RubricKey, CheckResult>;

  // Title specificity
  const vagueTitleRegex = /^(fix|update|improve|refactor|clean|work on|wip|tweak|change)$/i;
  const titleWords = title.trim().split(/\s+/).length;
  if (vagueTitleRegex.test(title.trim()) || titleWords < 3) {
    checks.title = { status: 'fail', note: 'too vague' };
  } else if (titleWords < 5) {
    checks.title = { status: 'warn', note: 'could be more specific' };
  } else {
    checks.title = { status: 'pass', note: `${titleWords} words` };
  }

  // Context: body length
  if (body.length === 0) checks.context = { status: 'fail', note: 'empty body' };
  else if (body.length < 200) checks.context = { status: 'warn', note: `${body.length} chars` };
  else checks.context = { status: 'pass', note: `${body.length} chars` };

  // File paths
  const pathRegex = /(?:`[^`]*\.(?:jsx?|tsx?|py|rs|sol|go|md|json|ya?ml|css|scss|html|sh|toml|rb|java|c|cpp|h|hpp|swift|kt)`|(?:src|app|packages|lib|components|pages|features|contracts)\/[\w\-./]+)/gi;
  const pathMatches = body.match(pathRegex) || [];
  if (pathMatches.length === 0) checks.files = { status: 'fail', note: 'no file paths' };
  else if (pathMatches.length < 2) checks.files = { status: 'warn', note: '1 path ref' };
  else checks.files = { status: 'pass', note: `${pathMatches.length} refs` };

  // Scope: area label stacking
  const areaLabels = ['frontend', 'backend', 'smart-contract', 'smartcontract', 'infrastructure', 'contracts', 'ui', 'api'];
  const stackedAreas = labelsLower.filter(l => areaLabels.some(a => l.includes(a)));
  if (stackedAreas.length >= 3) {
    checks.scope = { status: 'fail', note: `${stackedAreas.length} areas stacked` };
  } else if (stackedAreas.length === 2) {
    checks.scope = { status: 'warn', note: '2 areas — may be too big' };
  } else {
    checks.scope = { status: 'pass', note: 'focused scope' };
  }

  // Setup / repro steps
  const codeBlocks = (body.match(/```/g) || []).length / 2;
  const commandRegex = /(npm |yarn |pnpm |cargo |pip |python |cd |make |soroban |stellar |docker )/i;
  if (codeBlocks >= 1 || commandRegex.test(body)) {
    checks.setup = { status: 'pass', note: codeBlocks ? `${Math.floor(codeBlocks)} code blocks` : 'has commands' };
  } else {
    checks.setup = { status: 'fail', note: 'no setup/repro steps' };
  }

  // Acceptance criteria
  const acceptRegex = /(acceptance criteria|expected behavior|definition of done|- \[ \])/i;
  const checkboxes = (body.match(/- \[ \]/g) || []).length;
  if (acceptRegex.test(body) || checkboxes >= 2) {
    checks.acceptance = { status: 'pass', note: checkboxes ? `${checkboxes} checkboxes` : 'has criteria' };
  } else if (body.match(/goal:|should|must|needs to/i)) {
    checks.acceptance = { status: 'warn', note: 'implicit goal only' };
  } else {
    checks.acceptance = { status: 'fail', note: 'no acceptance criteria' };
  }

  // Labels
  if (labels.length === 0) checks.labels = { status: 'fail', note: 'no labels' };
  else if (labels.length < 2) checks.labels = { status: 'warn', note: '1 label' };
  else checks.labels = { status: 'pass', note: `${labels.length} labels` };

  // Milestone
  if (issue.milestone) checks.milestone = { status: 'pass', note: issue.milestone.title };
  else checks.milestone = { status: 'warn', note: 'no milestone' };

  // Grade: pass=2, warn=1, fail=0. Max 16.
  const total = Object.values(checks).reduce(
    (sum, c) => sum + (c.status === 'pass' ? 2 : c.status === 'warn' ? 1 : 0),
    0
  );
  const pct = Math.round((total / 16) * 100);
  const grade = pct >= 80 ? 'A' : pct >= 65 ? 'B' : pct >= 45 ? 'C' : 'D';

  // Complexity suggestion
  const complexKeywords = /(refactor|migrate|integrate|architect|entire|all|across|cross-|multi)/i;
  const trivialKeywords = /(typo|copy|rename|docs|readme|comment|lint|format)/i;
  let suggestedComplexity: 'Trivial' | 'Medium' | 'High' = 'Medium';
  if (trivialKeywords.test(title) || trivialKeywords.test(body.slice(0, 300))) {
    suggestedComplexity = 'Trivial';
  } else if (complexKeywords.test(title) || (stackedAreas.length >= 2 && body.length > 500)) {
    suggestedComplexity = 'High';
  }

  return { issue, checks, pct, grade: grade as 'A' | 'B' | 'C' | 'D', suggestedComplexity, stackedAreas, pathMatches };
}

export function summarizeRepo(issues: GitHubIssue[]): RepoSummary | null {
  if (!issues.length) return null;
  const scored = issues.map(i => scoreIssue(i));
  const avg = Math.round(scored.reduce((s, x) => s + x.pct, 0) / scored.length);
  const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  scored.forEach(x => dist[x.grade]++);

  const worst = [...scored].sort((a, b) => a.pct - b.pct).slice(0, 3);

  const failCounts: Record<string, number> = {};
  scored.forEach(x => {
    Object.entries(x.checks).forEach(([k, v]) => {
      if (v.status === 'fail') failCounts[k] = (failCounts[k] || 0) + 1;
    });
  });
  const topFails = Object.entries(failCounts).sort((a, b) => b[1] - a[1]).slice(0, 3) as [string, number][];

  const complexity = { Trivial: 0, Medium: 0, High: 0 };
  scored.forEach(x => complexity[x.suggestedComplexity]++);
  const pointsEstimate = complexity.Trivial * 100 + complexity.Medium * 150 + complexity.High * 200;

  return { scored, avg, dist, worst, topFails, complexity, pointsEstimate };
}
