import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CommitRecord } from './types.js';

const RECORD_SEPARATOR = '---COMMIT_RECORD_START---';
const FIELD_SEPARATOR = '---COMMIT_FIELD_SEP---';

export function parseGitHistory(repoPath: string, maxCommits?: number): CommitRecord[] {
  const gitDir = path.join(repoPath, '.git');
  if (!fs.existsSync(gitDir)) {
    throw new Error(`Path is not a git repository: ${repoPath}`);
  }

  const format = `${RECORD_SEPARATOR}%n%H${FIELD_SEPARATOR}%h${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%ae${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%s`;
  const args = ['log', '--date=iso-strict', '--shortstat', `--format=${format}`];

  if (typeof maxCommits === 'number' && maxCommits > 0) {
    args.push('-n', String(Math.floor(maxCommits)));
  }

  let output: string;
  try {
    output = execFileSync('git', args, {
      cwd: repoPath,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (err: unknown) {
    const errorOutput = err instanceof Error ? err.message : String(err);
    if (
      errorOutput.includes('does not have any commits yet') ||
      errorOutput.includes('unknown revision or path not in the working tree') ||
      errorOutput.includes("fatal: ambiguous argument 'HEAD'")
    ) {
      return [];
    }
    throw err;
  }

  if (!output || !output.trim()) {
    return [];
  }

  const rawRecords = output.split(RECORD_SEPARATOR).filter(chunk => chunk.trim().length > 0);
  const commits: CommitRecord[] = [];

  for (const chunk of rawRecords) {
    const trimmedChunk = chunk.trim();
    if (!trimmedChunk) continue;

    const firstNewlineIndex = trimmedChunk.indexOf('\n');
    let metadataLine = trimmedChunk;
    let statText = '';

    if (firstNewlineIndex !== -1) {
      metadataLine = trimmedChunk.slice(0, firstNewlineIndex).trim();
      statText = trimmedChunk.slice(firstNewlineIndex).trim();
    }

    const fields = metadataLine.split(FIELD_SEPARATOR);
    if (fields.length < 6) continue;

    const [hash, shortHash, author, email, date, ...subjectParts] = fields;
    const subject = subjectParts.join(FIELD_SEPARATOR);

    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;

    if (statText) {
      const filesMatch = statText.match(/(\d+)\s+files?\s+changed/);
      const insMatch = statText.match(/(\d+)\s+insertions?\(\+\)/);
      const delMatch = statText.match(/(\d+)\s+deletions?\(-\)/);

      if (filesMatch) filesChanged = parseInt(filesMatch[1], 10);
      if (insMatch) insertions = parseInt(insMatch[1], 10);
      if (delMatch) deletions = parseInt(delMatch[1], 10);
    }

    commits.push({
      hash,
      shortHash,
      author,
      email,
      date,
      subject,
      filesChanged,
      insertions,
      deletions
    });
  }

  return commits;
}
