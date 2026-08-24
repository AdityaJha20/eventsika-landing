---
name: minimal-change
description: >-
  Guide the agent to make the smallest safe code change when working on the Eventsika project.
  Use this skill when implementing bug fixes, making UI/functional adjustments, adding focused features,
  or investigating issues to ensure surgical precision, root-cause diagnosis, and zero collateral damage.
---

# Minimal Change Workflow

Follow this procedure to deliver the smallest, safest, and most precise code modification that solves the exact problem requested.

---

## Core Rules

1. **Understand Before Modifying**: Thoroughly inspect the existing code, call sites, and styling patterns before making any edits.
2. **Diagnose Root Cause First**: Never guess or apply superficial workarounds. Identify the exact root cause of the issue before proposing or applying a fix.
3. **Surgical Scope**: Make the smallest change that completely solves the problem. Avoid touching multiple files when editing one is sufficient.
4. **Reuse Existing Patterns**: Use existing components, CSS modules, utility functions, and design tokens rather than inventing new abstractions or duplicate styles.
5. **No Unrelated Refactoring**: Do not clean up, reformat, or refactor working code outside the immediate scope of the task.
6. **Zero Unnecessary Dependencies**: Never add external npm packages or third-party libraries if the problem can be solved cleanly with existing project code.
7. **No Speculative Abstractions**: Do not build generic wrappers, complex helpers, or configurable layers unless they solve a real, present requirement.
8. **Preserve Surrounding Behavior**: Ensure that existing props, exports, routes, layouts, and component contracts remain fully intact.
9. **Investigate When Uncertain**: If the root cause or side effects are unclear, stop and investigate using read-only inspection tools before editing.
10. **Ask Before Expanding Scope**: If a broader architectural change or refactor genuinely appears necessary, explain the trade-offs clearly and ask for user confirmation first.

---

## Step-by-Step Execution Plan

### Step 1: Investigation & Root Cause Analysis
- Locate the relevant files, components, or route handlers.
- Trace data flow, styles, or configuration to pinpoint the exact failure point or insertion location.
- Verify why the issue occurs rather than attempting trial-and-error fixes.

### Step 2: Formulate the Minimal Solution
- Identify the exact lines of code or specific file that needs adjustment.
- Check if an existing component (e.g., in `src/components/`) or style class can be reused.
- Ensure no unintended side effects or breaking changes are introduced.

### Step 3: Apply the Focused Change
- Make precise, single-purpose edits.
- Keep diffs small, readable, and directly aligned with the user prompt.

### Step 4: Verify and Validate
- Run type-checking if TypeScript code was altered: `npx tsc --noEmit`
- Run linting if styles or code structure were changed: `npm run lint`
- Validate functional output (build health, browser rendering, or response status).

---

## Verification Summary Format

After completing changes, summarize the work concisely:

```markdown
### Minimal Change Summary

- **Modified File(s)**: [List of changed file paths]
- **Root Cause**: [1-2 sentences explaining what caused the issue or required the change]
- **Solution Applied**: [Concise summary of the surgical change made]
- **Verification**: [Results of `tsc --noEmit`, `npm run lint`, or build verification]
```
