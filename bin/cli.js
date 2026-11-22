#!/usr/bin/env node

import * as path from 'node:path';
import { auditRepo } from '../dist/index.js';

function printHelp() {
  console.log(`
Usage: git-commit-audit [repo-path] [options]

Audit a Git repository for commit health and Conventional Commits compliance.

Arguments:
  [repo-path]               Path to the Git repository (default: current working directory)

Options:
  --json                    Output audit report as JSON
  --min-score=<number>      Exit with code 1 if score is below minimum threshold
  --max-commits=<number>    Limit analysis to the most recent N commits
  --bulk-threshold=<number> Maximum files changed before flagging a bulk commit (default: 25)
  -h, --help                Show this help message
`);
}

function run() {
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  const isJson = args.includes('--json');
  let minScore = null;
  let maxCommits = undefined;
  let bulkThreshold = undefined;
  let repoPath = process.cwd();

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--json') {
      continue;
    } else if (arg.startsWith('--min-score=')) {
      minScore = Number(arg.split('=')[1]);
    } else if (arg === '--min-score' && i + 1 < args.length) {
      minScore = Number(args[++i]);
    } else if (arg.startsWith('--max-commits=')) {
      maxCommits = Number(arg.split('=')[1]);
    } else if (arg === '--max-commits' && i + 1 < args.length) {
      maxCommits = Number(args[++i]);
    } else if (arg.startsWith('--bulk-threshold=')) {
      bulkThreshold = Number(arg.split('=')[1]);
    } else if (arg === '--bulk-threshold' && i + 1 < args.length) {
      bulkThreshold = Number(args[++i]);
    } else if (!arg.startsWith('-')) {
      repoPath = path.resolve(process.cwd(), arg);
    }
  }

  let report;
  try {
    report = auditRepo(repoPath, {
      maxCommits,
      bulkFileThreshold: bulkThreshold
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isJson) {
      console.log(JSON.stringify({ error: message }, null, 2));
    } else {
      console.error(`Error: ${message}`);
    }
    process.exit(1);
  }

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('\nGit Commit Audit Report');
    console.log('='.repeat(50));
    console.log(`Repository:             ${report.repoPath}`);
    console.log(`Total Commits:          ${report.totalCommits}`);
    console.log(`Health Score:           ${report.score}/100 (Grade: ${report.grade})`);
    console.log(`Conventional Commits:   ${report.conventionalPercentage}%`);

    const typeEntries = Object.entries(report.typeBreakdown);
    if (typeEntries.length > 0) {
      console.log('\nCommit Types:');
      for (const [type, count] of typeEntries) {
        console.log(`  - ${type}: ${count}`);
      }
    }

    const contributorEntries = Object.entries(report.contributors);
    if (contributorEntries.length > 0) {
      console.log('\nTop Contributors:');
      for (const [author, count] of contributorEntries) {
        console.log(`  - ${author}: ${count} commit${count === 1 ? '' : 's'}`);
      }
    }

    if (report.issues.length === 0) {
      console.log('\nIssues Found: 0 (All commits adhere to best practices)');
    } else {
      console.log(`\nIssues Found: ${report.issues.length}`);
      for (const issue of report.issues) {
        const shortHash = issue.hash ? issue.hash.slice(0, 7) : '-------';
        console.log(`  • [${shortHash}] [${issue.rule}] ${issue.message}`);
      }
    }
    console.log('='.repeat(50) + '\n');
  }

  if (minScore !== null && !isNaN(minScore) && report.score < minScore) {
    if (!isJson) {
      console.error(`Audit failed: Health score (${report.score}) is below minimum threshold of ${minScore}.`);
    }
    process.exit(1);
  }
}

run();
