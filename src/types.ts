export interface CommitRecord {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: string;
  subject: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export type AuditRule = 'conventional-format' | 'lazy-message' | 'bulk-commit';

export interface AuditIssue {
  hash: string;
  subject: string;
  author: string;
  rule: AuditRule;
  message: string;
  penalty: number;
}

export interface AuditOptions {
  maxCommits?: number;
  bulkFileThreshold?: number;
}

export type AuditGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface AuditReport {
  repoPath: string;
  totalCommits: number;
  score: number;
  grade: AuditGrade;
  conventionalPercentage: number;
  typeBreakdown: Record<string, number>;
  contributors: Record<string, number>;
  issues: AuditIssue[];
  commits: CommitRecord[];
}
