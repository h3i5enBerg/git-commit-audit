import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { evaluateCommits } from '../src/rules.js';
import { parseGitHistory } from '../src/gitParser.js';
import { auditRepo } from '../src/index.js';
import type { CommitRecord } from '../src/types.js';

function createMockCommit(overrides: Partial<CommitRecord> = {}): CommitRecord {
  return {
    hash: 'a1b2c3d4e5f678901234567890abcdef12345678',
    shortHash: 'a1b2c3d',
    author: 'Alice Developer',
    email: 'alice@example.com',
    date: '2026-11-20T10:00:00Z',
    subject: 'feat: add git commit auditor module',
    filesChanged: 2,
    insertions: 50,
    deletions: 5,
    ...overrides
  };
}

describe('Conventional Commits Evaluation', () => {
  it('should score 100 and grade A when all commits are valid conventional commits', () => {
    const commits: CommitRecord[] = [
      createMockCommit({ subject: 'feat: add initial feature' }),
      createMockCommit({ subject: 'fix(parser): handle empty git history' }),
      createMockCommit({ subject: 'docs: update usage instructions in readme' }),
      createMockCommit({ subject: 'chore(deps): bump typescript from 5.6 to 5.7' }),
      createMockCommit({ subject: 'refactor!: overhaul audit reporting structure' })
    ];

    const report = evaluateCommits('/mock/repo', commits);
    assert.equal(report.score, 100);
    assert.equal(report.grade, 'A');
    assert.equal(report.conventionalPercentage, 100);
    assert.equal(report.issues.length, 0);
    assert.equal(report.typeBreakdown.feat, 1);
    assert.equal(report.typeBreakdown.fix, 1);
    assert.equal(report.typeBreakdown.docs, 1);
    assert.equal(report.typeBreakdown.chore, 1);
    assert.equal(report.typeBreakdown.refactor, 1);
  });

  it('should flag commits that violate conventional commit specification', () => {
    const commits: CommitRecord[] = [
      createMockCommit({ subject: 'Added some more tests for edge cases' })
    ];

    const report = evaluateCommits('/mock/repo', commits);
    assert.equal(report.conventionalPercentage, 0);
    const issue = report.issues.find(i => i.rule === 'conventional-format');
    assert.ok(issue);
    assert.equal(issue.penalty, 15);
    assert.equal(report.score, 85);
    assert.equal(report.grade, 'B');
    assert.equal(report.typeBreakdown.other, 1);
  });
});

describe('Lazy Message Penalties', () => {
  it('should flag commit subjects shorter than 10 characters', () => {
    const commits: CommitRecord[] = [
      createMockCommit({ subject: 'fix bug' })
    ];

    const report = evaluateCommits('/mock/repo', commits);
    const lazyIssue = report.issues.find(i => i.rule === 'lazy-message');
    assert.ok(lazyIssue);
    assert.equal(lazyIssue.penalty, 20);
  });

  it('should flag generic keywords like wip, update, changes, done, asdf', () => {
    const genericSubjects = ['wip', 'update', 'changes', 'done', 'asdf', 'update files'];

    for (const subject of genericSubjects) {
      const commits: CommitRecord[] = [createMockCommit({ subject })];
      const report = evaluateCommits('/mock/repo', commits);
      const lazyIssue = report.issues.find(i => i.rule === 'lazy-message');
      assert.ok(lazyIssue, `Subject "${subject}" should be flagged as lazy`);
    }
  });

  it('should not flag detailed conventional commits as lazy', () => {
    const commits: CommitRecord[] = [
      createMockCommit({ subject: 'fix: resolve race condition in test runner' })
    ];

    const report = evaluateCommits('/mock/repo', commits);
    const lazyIssue = report.issues.find(i => i.rule === 'lazy-message');
    assert.equal(lazyIssue, undefined);
  });
});

describe('Bulk Commit Detection', () => {
  it('should flag commits modifying more than default 25 files', () => {
    const commits: CommitRecord[] = [
      createMockCommit({
        subject: 'feat: add huge bundle of files',
        filesChanged: 30
      })
    ];

    const report = evaluateCommits('/mock/repo', commits);
    const bulkIssue = report.issues.find(i => i.rule === 'bulk-commit');
    assert.ok(bulkIssue);
    assert.equal(bulkIssue.penalty, 10);
    assert.equal(report.score, 90);
  });

  it('should honor custom bulkFileThreshold option', () => {
    const commits: CommitRecord[] = [
      createMockCommit({
        subject: 'refactor: split files into subdirectories',
        filesChanged: 15
      })
    ];

    const reportDefault = evaluateCommits('/mock/repo', commits, { bulkFileThreshold: 25 });
    assert.equal(reportDefault.issues.length, 0);

    const reportCustom = evaluateCommits('/mock/repo', commits, { bulkFileThreshold: 10 });
    assert.equal(reportCustom.issues.length, 1);
    assert.equal(reportCustom.issues[0].rule, 'bulk-commit');
  });
});

describe('Grade Boundaries and Edge Cases', () => {
  it('should return grade A for score >= 90', () => {
    const report = evaluateCommits('/mock/repo', [
      createMockCommit({ subject: 'feat: valid commit message' })
    ]);
    assert.equal(report.score, 100);
    assert.equal(report.grade, 'A');
  });

  it('should return grade B for score between 80 and 89', () => {
    const report = evaluateCommits('/mock/repo', [
      createMockCommit({ subject: 'non-conventional commit message over ten chars' })
    ]);
    assert.equal(report.score, 85);
    assert.equal(report.grade, 'B');
  });

  it('should return grade D for score between 60 and 69', () => {
    const report = evaluateCommits('/mock/repo', [
      createMockCommit({ subject: 'wip' })
    ]);
    // wip gets non-conventional (15) + lazy-message (20) = 35 penalty -> score 65
    assert.equal(report.score, 65);
    assert.equal(report.grade, 'D');
  });

  it('should return grade F for score < 60', () => {
    const report = evaluateCommits('/mock/repo', [
      createMockCommit({
        subject: 'wip',
        filesChanged: 50
      })
    ]);
    // wip (non-conventional 15 + lazy 20 + bulk 10) = 45 penalty -> score 55
    assert.equal(report.score, 55);
    assert.equal(report.grade, 'F');
  });

  it('should handle empty commit history gracefully', () => {
    const report = evaluateCommits('/mock/repo', []);
    assert.equal(report.totalCommits, 0);
    assert.equal(report.score, 100);
    assert.equal(report.grade, 'A');
    assert.equal(report.conventionalPercentage, 100);
    assert.deepEqual(report.issues, []);
  });

  it('should aggregate contributors accurately', () => {
    const commits: CommitRecord[] = [
      createMockCommit({ author: 'Alice' }),
      createMockCommit({ author: 'Bob' }),
      createMockCommit({ author: 'Alice' })
    ];

    const report = evaluateCommits('/mock/repo', commits);
    assert.equal(report.contributors['Alice'], 2);
    assert.equal(report.contributors['Bob'], 1);
  });
});

describe('Git Parser & Live Repository Audit', () => {
  it('should throw when path is not a git repository', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-'));
    try {
      assert.throws(() => parseGitHistory(tempDir), /not a git repository/i);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should safely parse commits and file stats from a real git repo', () => {
    const tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-audit-test-'));
    try {
      execFileSync('git', ['init'], { cwd: tempRepo });
      execFileSync('git', ['config', 'user.name', 'Auditor Test'], { cwd: tempRepo });
      execFileSync('git', ['config', 'user.email', 'auditor@example.com'], { cwd: tempRepo });

      // Test zero-commit repo
      const emptyHistory = parseGitHistory(tempRepo);
      assert.deepEqual(emptyHistory, []);

      // Commit 1
      fs.writeFileSync(path.join(tempRepo, 'index.ts'), 'export const a = 1;\n');
      execFileSync('git', ['add', '.'], { cwd: tempRepo });
      execFileSync('git', ['commit', '-m', 'feat: initial commit'], { cwd: tempRepo });

      // Commit 2
      fs.writeFileSync(path.join(tempRepo, 'index.ts'), 'export const a = 2;\nexport const b = 3;\n');
      execFileSync('git', ['add', '.'], { cwd: tempRepo });
      execFileSync('git', ['commit', '-m', 'wip'], { cwd: tempRepo });

      const parsed = parseGitHistory(tempRepo);
      assert.equal(parsed.length, 2);
      assert.equal(parsed[0].subject, 'wip');
      assert.equal(parsed[1].subject, 'feat: initial commit');

      // Test auditRepo integration
      const report = auditRepo(tempRepo);
      assert.equal(report.totalCommits, 2);
      assert.equal(report.conventionalPercentage, 50);
      assert.ok(report.issues.length >= 1);
    } finally {
      fs.rmSync(tempRepo, { recursive: true, force: true });
    }
  });
});
