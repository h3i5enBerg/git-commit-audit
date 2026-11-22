import type {
  AuditGrade,
  AuditIssue,
  AuditOptions,
  AuditReport,
  CommitRecord
} from './types.js';

const CONVENTIONAL_COMMIT_REGEX =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._-]+\))?!?: .{3,}/i;

const GENERIC_WORDS = new Set([
  'update',
  'fix',
  'wip',
  'changes',
  'done',
  'asdf',
  'test',
  'misc',
  'cleanup',
  'temp',
  'patch',
  'work'
]);

function isLazySubject(subject: string): boolean {
  const trimmed = subject.trim();
  if (trimmed.length < 10) {
    return true;
  }

  const normalized = trimmed.toLowerCase().replace(/[.!?]+$/, '');
  if (GENERIC_WORDS.has(normalized)) {
    return true;
  }

  if (/^(update|fix|wip|changes|done|asdf)(\s+(all|files|code|stuff|things|changes|work|bug|commit|done))?$/i.test(normalized)) {
    return true;
  }

  return false;
}

function computeGrade(score: number): AuditGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function evaluateCommits(
  repoPath: string,
  commits: CommitRecord[],
  options?: AuditOptions
): AuditReport {
  const totalCommits = commits.length;
  const bulkFileThreshold = options?.bulkFileThreshold ?? 25;

  if (totalCommits === 0) {
    return {
      repoPath,
      totalCommits: 0,
      score: 100,
      grade: 'A',
      conventionalPercentage: 100,
      typeBreakdown: {},
      contributors: {},
      issues: [],
      commits: []
    };
  }

  const issues: AuditIssue[] = [];
  const typeBreakdown: Record<string, number> = {};
  const contributors: Record<string, number> = {};
  let conventionalCount = 0;

  for (const commit of commits) {
    contributors[commit.author] = (contributors[commit.author] || 0) + 1;

    const isConventional = CONVENTIONAL_COMMIT_REGEX.test(commit.subject);
    if (isConventional) {
      conventionalCount++;
      const typeMatch = commit.subject.match(
        /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)/i
      );
      if (typeMatch) {
        const type = typeMatch[1].toLowerCase();
        typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
      }
    } else {
      typeBreakdown['other'] = (typeBreakdown['other'] || 0) + 1;
      issues.push({
        hash: commit.hash,
        subject: commit.subject,
        author: commit.author,
        rule: 'conventional-format',
        message: `Commit subject "${commit.subject}" does not follow Conventional Commits format`,
        penalty: 15
      });
    }

    if (isLazySubject(commit.subject)) {
      issues.push({
        hash: commit.hash,
        subject: commit.subject,
        author: commit.author,
        rule: 'lazy-message',
        message: `Commit subject "${commit.subject}" is too short (< 10 chars) or generic`,
        penalty: 20
      });
    }

    if (commit.filesChanged > bulkFileThreshold) {
      issues.push({
        hash: commit.hash,
        subject: commit.subject,
        author: commit.author,
        rule: 'bulk-commit',
        message: `Bulk commit modified ${commit.filesChanged} files (threshold: ${bulkFileThreshold})`,
        penalty: 10
      });
    }
  }

  const conventionalPercentage = Math.round((conventionalCount / totalCommits) * 100);
  const totalPenalty = issues.reduce((acc, issue) => acc + issue.penalty, 0);
  const penaltyPerCommit = Math.round(totalPenalty / totalCommits);
  const score = Math.max(0, Math.min(100, 100 - penaltyPerCommit));
  const grade = computeGrade(score);

  return {
    repoPath,
    totalCommits,
    score,
    grade,
    conventionalPercentage,
    typeBreakdown,
    contributors,
    issues,
    commits
  };
}
