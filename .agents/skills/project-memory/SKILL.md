---
name: project-memory
description: >-
  Define how Antigravity governs, accesses, and maintains durable project memory via the local Memory MCP.
  Use this skill when retrieving historical project context, recording major architectural decisions,
  resolving memory conflicts, maintaining knowledge graph hygiene, or recovering session context.
---

# Project Memory & Knowledge Governance Guide

This skill governs how Antigravity utilizes the connected local **Memory MCP** (`@modelcontextprotocol/server-memory`) as a durable, private, and deterministic project-memory system for Eventsika.

---

## 1. Source-of-Truth Hierarchy

When stored memory, conversation context, and repository code diverge, resolve conflicts using this strict priority order:

```
1. Current Repository & Source Code  (Absolute Ground Truth)
   ↓
2. Current Project Documentation     (Official Architecture & Runbooks)
   ↓
3. Git Commit History                (Historical Intent & Evolution)
   ↓
4. Persistent Memory MCP             (Contextual Memory & Decision Cache)
   ↓
5. Conversational Assumptions        (Unverified Hypotheses)
```

### Conflict Resolution Rules:
- **Memory Must Never Override Verified Current Code**: If memory asserts something that active code contradicts, the current code is always right.
- **Flag and Quarantine Stale Memory**: When a conflict is discovered, treat the memory entry as stale, inform the user, and update or delete the obsolete graph node.

---

## 2. What Should Be Remembered

Record only high-value, durable project knowledge that prevents redundant investigations in future sessions:

- **Architectural Decisions**: Framework choices, Server vs. Client component boundaries, route patterns.
- **Technology Choices & Constraints**: Next.js 16 App Router, React 19, CSS Modules, strict vanilla CSS preference.
- **Approved Branding & Design Language**: Color palette tokens (Eventsika Crimson `#7f1010`, Gold `#b99a67`), typography standards, animation rules (direct SVG fill transitions, 180° emblem rotation, stationary wordmark).
- **Explicitly Rejected Approaches & Why**: Filter-based logo hue-rotation (rejected due to rainbow color interpolation artifacts), complex state libraries, heavy animation frameworks.
- **Important Security & Domain Rules**: Server-only environment variables, lead validation standards, read-only audit practices.
- **Cross-Component Relationships**: How shared modules, layout components, and branding assets interact across pages.

---

## 3. What Should NOT Be Remembered

Never write sensitive, ephemeral, or trivial data into the Memory MCP:

- **Zero Secrets / Credentials**: API keys (`RESEND_API_KEY`, `SENDGRID_API_KEY`), passwords, auth tokens, database connection strings, private certificates, or `.env.local` contents.  
  *(Note: Remembering that an environment variable name exists is acceptable; recording its value is strictly forbidden).*
- **No Temporary Tasks**: "Fix button margin today", "Check line 45", or transient bug triage steps.
- **No Conversational Filler**: Casual statements, speculative ideas, or unverified user hypotheses.
- **No Raw Code Dumps**: Large blocks of code, full files, or entire component definitions.

---

## 4. Before Significant Work Workflow

Before initiating any architectural refactoring, cross-file feature, security hardening, or design update:

1. **Read Core Agent Rules**: Review [`AGENTS.md`](file:///d:/Persional-projects/landing/AGENTS.md) and [`CLAUDE.md`](file:///d:/Persional-projects/landing/CLAUDE.md).
2. **Inspect Current Repository**: Check the actual source files and CSS modules directly.
3. **Query Persistent Memory**: Use `search_nodes` or `open_nodes` to check for prior approved decisions or rejected experiments related to the task.
4. **Inspect Git History**: Review recent commits and diffs when historical context is relevant.
5. **Reconcile Reality**: Compare retrieved memory against current codebase state.
6. **Plan & Execute**: Formulate the plan based on verified facts.

*(Do not query memory for trivial, single-line edits or minor styling tweaks).*

---

## 5. When to Save Memory

Write to memory only when a decision meets all three criteria:
1. **Durable**: Will remain valid for months across future development sessions.
2. **Actionable**: Directly affects how future features or fixes should be built.
3. **Investigative Value**: Saves meaningful time by avoiding re-auditing or re-debating.

### Examples:
- **Save**: `"The Eventsika logo animation uses direct SVG fill transitions from gold to crimson #7f1010 with 180° emblem rotation; filter hue-rotate is permanently rejected."`
- **Do Not Save**: `"Edited Navbar.module.css line 34."`

---

## 6. Memory Update & Hygiene Rules

When an existing project decision or architecture evolves:

1. **Verify New State**: Confirm the change is fully implemented and working in the codebase.
2. **Update Project Docs**: Update relevant markdown documentation if applicable.
3. **Synchronize Memory Graph**: Use `add_observations` or `create_entities` to record the new decision.
4. **Prune Stale Entries**: Use `delete_observations` or `delete_entities` to remove conflicting or superseded facts.
5. **Prevent Duplication**: Always search existing entities before creating new ones.

---

## 7. Memory is Context Assistance, Not the Codebase

- The Memory MCP is a lightweight semantic context layer, not a database mirror or code repository.
- Keep observations concise, atomic, and structured.
- Store facts, constraints, decisions, and reasons—not implementations.

---

## 8. Session Context Recovery

When starting a fresh conversation or when previous session history was truncated:

1. Use `search_nodes` or `read_graph` to reload foundational project knowledge.
2. Re-verify critical retrieved facts against active workspace files before acting on them.
3. Never claim to remember something unless it was explicitly retrieved from the knowledge graph or verified in code.

---

## 9. Hallucination Control & Fact Verification

- Persistent memory aids recall but is not self-verifying.
- If memory is silent or ambiguous on a topic, do not guess or fabricate history.
- Inspect active files, consult official framework documentation via Context7, or state the ambiguity clearly to the user.

---

## 10. Memory MCP Tool Reference

Interact with `@modelcontextprotocol/server-memory` using the standard tool suite:

Tool | Action | When to Use
:--- | :--- | :---
`search_nodes` | Search entities by query | Looking up past decisions (e.g., `"logo animation"`, `"Next.js routing"`)
`open_nodes` | Fetch specific entity details | Inspecting full observation history for a known entity name
`read_graph` | Read complete knowledge graph | Reviewing total project memory or performing full audits
`create_entities` | Add new conceptual nodes | Documenting a new major subsystem, architectural pattern, or tool
`create_relations` | Connect two existing entities | Linking concepts (e.g., `Navbar` -> `uses` -> `EventsikaLogo`)
`add_observations` | Append facts to existing entity | Adding approved decisions, constraints, or verified rules to a node
`delete_observations` | Remove specific outdated facts | Pruning stale observations from an active entity
`delete_entities` | Delete entire entity node | Removing obsolete, deprecated, or erroneous concepts
`delete_relations` | Remove relation between nodes | Disconnecting obsolete dependencies

---

## 11. Eventsika Engineering Principle

> **"Keep working code stable. Improve only where there is a clear reason."**

All memory operations and recalled context must reinforce this principle. Memory should prevent unnecessary churn, protect proven working patterns, and enforce minimal, surgical modifications.

---

## 12. Memory Reporting Protocol

Whenever a durable memory entry is created, updated, or deleted:

- **Summarize What Was Saved**: Provide a 1-sentence note of the entity and observation.
- **State Why It Was Saved**: Explain the long-term utility for future sessions.
- **Zero Secrets**: Ensure no sensitive configuration values or environment strings are echoed.
- **Report Conflicts**: If retrieved memory conflicted with active code, explicitly notify the user that memory was updated to match current code reality.

---

## 13. Read-Only Default for Memory Operations

- **Reading & Searching**: Unrestricted and safe during any planning or investigation turn.
- **Writing, Updating & Deleting**: Permitted only when information has been verified against working code or explicitly requested by the user.

---

## 14. Graph Cleanliness & Format Standards

- **Entity Names**: PascalCase or Upper_Snake_Case identifiers representing clean domains (e.g., `Eventsika_Branding_System`, `NextJS_App_Architecture`, `Logo_Animation_Standard`).
- **Entity Types**: Semantic categories (e.g., `architecture_decision`, `brand_guideline`, `security_policy`, `rejected_pattern`).
- **Observations**: Atomic, declarative statements (1 durable fact per observation).
- **Avoid Noise**: Never store conversational phrases, transient debug traces, or redundant restatements.
