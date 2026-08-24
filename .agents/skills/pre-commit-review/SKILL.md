---
name: pre-commit-review
description: >-
  Perform a structured pre-commit review for the Eventsika Next.js project.
  Use this skill when preparing to commit code, reviewing uncommitted git changes,
  auditing git diffs, or verifying TypeScript types and ESLint rules before committing.
---

# Pre-Commit Review Workflow

Perform a read-only review of working tree changes before committing. Do not commit, push, or modify files during the review unless explicitly instructed by the user.

---

## Core Principles

1. **Review First**: Perform an audit and present findings; do not automatically refactor code.
2. **Minimal & Safe**: Do not touch unrelated files or fix unrelated warnings. Keep recommendations minimal and focused.
3. **No Automatic Commits**: Never run `git commit` or `git push` automatically.
4. **Read-Only Inspection**: Do not modify files while performing the review. If issues are found, explain them and recommend the smallest appropriate fix.

---

## Review Checklist

### 1. Git Status & Diff Inspection
- Run `git status` to identify all modified, deleted, and untracked files.
- Run `git diff` (and `git diff --cached`) to inspect exact line-by-line changes.
- Check for accidental or leftover changes (e.g., debug `console.log` statements, temporary files, `.env` values, build archives, or commented-out blocks).

### 2. TypeScript Type-Checking
- Run `npx tsc --noEmit` from the project root.
- Ensure all type definitions, props, and imports are valid with 0 errors.

### 3. ESLint Verification
- Run `npm run lint` from the project root.
- Ensure changed files comply with project ESLint rules (`eslint-config-next`).

### 4. Security & Sensitive Data Check
- Scan modified files for hardcoded API keys, private tokens, passwords, or webhook secrets.
- Verify environment variables are referenced via `process.env` and documented in `.env.example`.
- Check Route Handlers and Server Actions for basic input validation and safe response structures.

### 5. Dependency & Code Cleanliness Check
- Verify that no unnecessary npm packages or unused imports were introduced.
- Verify that CSS module classes, assets, and component exports match current usage.

### 6. Scope & Intent Alignment
- Confirm that all modifications directly correspond to the intended task.
- Flag any unintended side effects on shared components or layouts.

---

## Reporting Template

Present review findings using the following format:

```markdown
### Pre-Commit Review Summary

- **Changed Files**:
  - `[MODIFIED]` path/to/file
  - `[DELETED]` path/to/file
  - `[UNTRACKED]` path/to/file
- **Type-Check (`tsc --noEmit`)**: [Pass / Fail (with details)]
- **Lint (`npm run lint`)**: [Pass / Fail (with details)]
- **Security & Secrets**: [Clean / Issue detected]
- **Scope Alignment**: [Verified / Out-of-scope changes detected]

#### Observations & Recommendations
- [Bullet points describing any issues found and the smallest recommended fix]

#### Next Steps
- [Ready to commit / Awaiting user decision on recommended fixes]
```