---
name: code-quality-audit
description: >-
  Perform a read-only code quality, maintainability, and refactoring audit for the Eventsika Next.js project.
  Use this skill when analyzing technical debt, identifying code duplication, evaluating component complexity,
  detecting unused/dead code, or prioritizing targeted code improvements before making changes.
---

# Code Quality & Refactoring Audit Workflow

Conduct a disciplined, evidence-based, and strictly read-only audit of the Eventsika codebase to identify actionable improvements, maintainability risks, and technical debt.

---

## Core Principles & Guiding Philosophy

> **The Eventsika Principle**: *"Keep working code stable. Improve only where there is a clear reason."*  
> Favor minimal, targeted improvements over broad, disruptive refactors.

1. **Strictly Read-Only**: Never edit, rewrite, delete, or refactor code during the audit. Report findings and wait for explicit user approval.
2. **Large Files ≠ Automatically Bad**: Do not treat line count alone as proof of a defect. File size is merely a signal for investigation. Recommend splitting only when there is concrete evidence of mixed responsibilities, heavy coupling, or severe maintenance friction.
3. **Meaningful Duplication Only**: Do not flag intentional repetition or minor coincidental similarities. Only report duplication when consolidating it yields a clear, tangible maintenance benefit.
4. **Justified Abstractions**: Never recommend generic wrappers or abstractions simply because code *could* be more abstract. Require an immediate, practical reuse or maintainability payoff.
5. **Verified Dead Code**: Do not classify code as dead merely because it lacks references in an adjacent file. Account for Next.js App Router conventions, dynamic imports, route handlers, metadata exports, and configuration files.
6. **Verified Dependencies**: Confirm complete absence across all scripts, configs, and build assets before reporting a dependency as unused.
7. **Pragmatic Type Safety**: Do not treat every `any` as an emergency. Flag type weaknesses only when they introduce measurable risks to runtime correctness, maintainability, or developer velocity.
8. **Pragmatic Performance**: Avoid theoretical micro-optimizations. Report performance concerns only when there is clear evidence of redundant computational work, unoptimized bundle weight, or architectural bottlenecks.
9. **Separate Security Concerns**: If a potential security vulnerability is observed, briefly flag it and recommend investigating it via dedicated security review rather than turning this audit into a security assessment.
10. **"No Findings" is a Valid Result**: If an inspected component or file is clean and working well, explicitly state that it is in good health. Never invent low-value findings to inflate a report.

---

## Audit Dimensions

### 1. Structural Complexity & Maintainability
- Components mixing multiple disparate domains (e.g., complex form state, business logic, heavy presentation, and direct API calls in one place).
- Deeply nested branching or convoluted state interactions that make future maintenance risky.

### 2. Redundancy & Consolidation Opportunities
- Substantial duplicated logic, calculations, or repeated complex UI patterns across components that should share a single source of truth.

### 3. Verified Dead Code & Clutter
- Unreachable branches, orphaned utility functions, obsolete exported types, or unused CSS module classes that are safely verified as unused.

### 4. Over-Engineering & Unnecessary Indirection
- Premature abstractions, single-use wrappers, or excessive prop-drilling layers that obscure simple logic.

### 5. Dependency & Import Cleanliness
- Declared dependencies in `package.json` with verified zero usage across the repository.
- Redundant external libraries where built-in Next.js or React APIs provide a cleaner native solution.

---

## Finding Structure & Severity Scale

Every finding must include:
- **Location**: Exact file path and line numbers (e.g., [`src/components/Hero.tsx:L45-L78`](file:///d:/Persional-projects/landing/src/components/Hero.tsx#L45-L78)).
- **Evidence**: Concrete description of what the code currently does.
- **Why It Matters**: The specific maintenance, correctness, or performance risk.
- **Severity**:
  - **High**: Meaningful maintainability, correctness, or performance risk backed by strong evidence.
  - **Medium**: Clear improvement opportunity with moderate impact.
  - **Low**: Minor maintainability or cleanliness observation.
- **Confidence**: High, Medium, or Low (certainty of impact/verifiability).
- **Smallest Reasonable Recommendation**: The most minimal, localized refactor that resolves the problem.

---

## Audit Report Template

```markdown
### Code Quality Audit Report

#### Executive Summary
- **Scope Inspected**: [Directory, component group, or file list]
- **Overall Health**: [Healthy / Acceptable / Needs Targeted Improvement]
- **Findings Summary**: [High: X | Medium: Y | Low: Z | None]

---

#### Detailed Findings

##### [HIGH / MEDIUM / LOW] <Finding Title>
- **Location**: [`path/to/file:L10-L45`](file:///path/to/file#L10-L45)
- **Category**: [Complexity / Duplication / Dead Code / Over-Engineering / Maintainability]
- **Evidence**: [Concrete code observation]
- **Why It Matters**: [Impact on maintainability, stability, or performance]
- **Confidence**: [High / Medium / Low]
- **Smallest Reasonable Recommendation**: [Targeted, surgical improvement]

---

#### Security Observations (If Any)
- [Brief note identifying potential security items to investigate separately, or "None observed"]

---

#### Prioritized Action Plan
1. [Highest value, lowest risk targeted improvement]
2. [Secondary targeted improvement]

#### Next Steps
- Awaiting user review and selection of which recommended improvements (if any) to execute.
```
