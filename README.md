# @nirajsatam/git-commit-audit

> Zero-runtime-dependency Git commit history auditor, Conventional Commits health checker, and developer hygiene scoring engine.

[![npm version](https://img.shields.io/npm/v/@nirajsatam/git-commit-audit.svg)](https://www.npmjs.com/package/@nirajsatam/git-commit-audit)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)]()

`@nirajsatam/git-commit-audit` inspects your Git commit history directly through safe native child processes without third-party runtime dependencies. It evaluates Conventional Commits compliance, flags lazy or ambiguous commit messages, detects risky bulk file changes, and calculates a 0–100 health score with letter grades (A–F).

---

## Features

- **Zero Runtime Dependencies**: Powered entirely by Node.js built-ins (`node:child_process`, `node:fs`, `node:path`).
- **Conventional Commits 1.0.0**: Validates types (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`), optional scopes, breaking change flags (`!`), and subject formatting.
- **Lazy Message Detection**: Flags messages that are too short (`< 10` characters) or generic placeholders (`update`, `fix`, `wip`, `changes`, `done`, `asdf`).
- **Bulk Commit Guard**: Identifies commits with excessive file changes (customizable threshold, default 25).
- **Comprehensive Analytics**: Provides overall score, letter grade, conventional percentage, commit type breakdown, and contributor statistics.
- **Dual CLI & Library**: Use from terminal in CI/CD pipelines or embed directly in TypeScript/JavaScript applications.
- **Modern ESM & CJS**: Full dual module support with complete TypeScript declarations.

---

## Installation

```bash
# Global installation for CLI usage
npm install -g @nirajsatam/git-commit-audit

# Or install locally in your project
npm install --save-dev @nirajsatam/git-commit-audit
```

---

## CLI Usage

Run without installing via `npx`:

```bash
# Audit current repository
npx @nirajsatam/git-commit-audit

# Audit a specific directory or repo path
npx @nirajsatam/git-commit-audit /path/to/repo

# Output machine-readable JSON
npx @nirajsatam/git-commit-audit --json

# Enforce a minimum score in CI (exits with code 1 if score < 85)
npx @nirajsatam/git-commit-audit --min-score=85

# Limit audit to the last 50 commits
npx @nirajsatam/git-commit-audit --max-commits=50

# Custom bulk file threshold (default: 25)
npx @nirajsatam/git-commit-audit --bulk-threshold=15
```

### Example CLI Output

```text
Git Commit Audit Report
==================================================
Repository:             /Users/dev/my-project
Total Commits:          42
Health Score:           94/100 (Grade: A)
Conventional Commits:   95%

Commit Types:
  - feat: 22
  - fix: 12
  - chore: 4
  - docs: 2

Top Contributors:
  - h3i5enBerg: 35 commits
  - Contributor: 7 commits

Issues Found: 2
  • [c4b12d9] [conventional-format] Commit subject "update docs" does not follow Conventional Commits format
  • [f7a810c] [lazy-message] Commit subject "update docs" is too short (< 10 chars) or generic
==================================================
```

---

## Programmatic API

### TypeScript / ESM

```typescript
import { auditRepo, type AuditReport } from '@nirajsatam/git-commit-audit';

const report: AuditReport = auditRepo('./path/to/repo', {
  maxCommits: 100,
  bulkFileThreshold: 30
});

console.log(`Repository Score: ${report.score}/100 (${report.grade})`);
console.log(`Conventional Percentage: ${report.conventionalPercentage}%`);
console.log('Type Breakdown:', report.typeBreakdown);
```

### CommonJS

```javascript
const { auditRepo } = require('@nirajsatam/git-commit-audit');

const report = auditRepo(process.cwd());
console.log(report);
```

### Granular Functions

You can also use lower-level functions independently:

```typescript
import { parseGitHistory, evaluateCommits } from '@nirajsatam/git-commit-audit';

// 1. Safely extract structured commit records
const commits = parseGitHistory(process.cwd(), 50);

// 2. Evaluate commit records against rules
const report = evaluateCommits(process.cwd(), commits, {
  bulkFileThreshold: 20
});
```

---

## Scoring Rules & Penalties

Audits compute a normalized **0–100** score based on the severity and frequency of issues across your commit history:

| Rule | Penalty | Description |
| :--- | :--- | :--- |
| `conventional-format` | **15 pts** | Subject does not match Conventional Commits format (`type(scope)?: description`). |
| `lazy-message` | **20 pts** | Subject is `< 10` characters or contains generic keywords (`update`, `wip`, `fix`, `changes`, `done`, `asdf`). |
| `bulk-commit` | **10 pts** | Commit modified more files than the configured threshold (default `25`). |

### Grade Scale

- **A**: 90 – 100 (Excellent developer hygiene)
- **B**: 80 – 89 (Good compliance with minor infractions)
- **C**: 70 – 79 (Average; needs standardization)
- **D**: 60 – 69 (Poor commit message discipline)
- **F**: < 60 (Critical non-compliance or widespread placeholder messages)

---

## Development & Testing

```bash
# Clone and install dependencies
git clone https://github.com/h3i5enBerg/git-commit-audit.git
cd git-commit-audit
npm install

# Build CJS, ESM and TypeScript declarations
npm run build

# Run unit tests
npm test
```

---

## License

[MIT](LICENSE) © [h3i5enBerg](https://github.com/h3i5enBerg)
