import { parseGitHistory } from './gitParser.js';
import { evaluateCommits } from './rules.js';
import type { AuditOptions, AuditReport } from './types.js';

export * from './types.js';
export { parseGitHistory } from './gitParser.js';
export { evaluateCommits } from './rules.js';

export function auditRepo(
  repoPath: string = process.cwd(),
  options: AuditOptions = {}
): AuditReport {
  const commits = parseGitHistory(repoPath, options.maxCommits);
  return evaluateCommits(repoPath, commits, options);
}
