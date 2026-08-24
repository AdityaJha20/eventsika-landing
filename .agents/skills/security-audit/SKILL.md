---
name: security-audit
description: >-
  Perform a read-only, evidence-based security audit for the Eventsika Next.js project.
  Use this skill when auditing API endpoints, Route Handlers, authentication/authorization flows,
  input validation, secret management, injection vectors, or general web security posture.
---

# Security Audit Workflow

Conduct a disciplined, evidence-based, non-destructive, and strictly read-only security audit of the Eventsika application.

---

## Core Principles

1. **Strictly Read-Only**: Never edit, rewrite, delete, or reconfigure code, authentication, or secrets during an audit.
2. **Evidence Over Theory**: Never report speculative or theoretical vulnerabilities. Every finding must be grounded in verified code paths, actual data flows, or measurable risks.
3. **Trace Full Context**: Do not assume an endpoint lacks validation or auth simply because a single file doesn't show it. Trace middlewares, parent route handlers, server actions, and shared utilities before concluding.
4. **Distinguish Status**: Clearly separate confirmed vulnerabilities from potential risks that require dynamic verification.
5. **Separate Security from Style**: Focus strictly on security impact, abuse risks, and data safety. Do not conflate security findings with general code cleanliness or refactoring preferences.
6. **Minimal Remediation**: Recommend the smallest, safest, and most localized fix for each issue rather than proposing sweeping architectural rewrites.
7. **No Automatic Actions**: Report all findings clearly and wait for explicit user approval before taking any remediation steps. Never commit or push.

---

## Audit Dimensions

### 1. Route Handlers & API Endpoints
- Audit all routes in `src/app/api/` (e.g., lead capture, vendor applications).
- Verify HTTP method handling, request body parsing safety, and response content types.

### 2. Input Validation & Sanitization
- Check that all incoming user input (names, emails, phone numbers, dates, messages) is validated for type, presence, and reasonable length before processing.
- Verify safe payload handling when forwarding data to third-party services (e.g., email providers or webhooks).

### 3. Secrets & Environment Variables
- Ensure private API keys (e.g., `RESEND_API_KEY`, `SENDGRID_API_KEY`, webhook secrets) are accessed only on the server and never exposed to the client bundle or prefixed with `NEXT_PUBLIC_`.
- Verify `.env.local` is ignored by Git and only sanitized placeholders exist in `.env.example`.

### 4. Injection & XSS Vectors
- Inspect any use of `dangerouslySetInnerHTML` (such as schema JSON-LD scripts) to ensure content is safely serialized and not derived from unescaped user input.
- Check for unsafe URL handling, dynamic script evaluation, or unvalidated redirects.

### 5. Sensitive Data Exposure & Error Responses
- Ensure error responses return generic, safe messages to clients without leaking stack traces, internal database details, or raw third-party API error responses.
- Verify that PII (customer names, phone numbers, addresses) is handled securely and not logged unnecessarily.

### 6. Authentication & Authorization Boundaries
- Audit protected routes, login portals, and session handlers for proper credential verification and access control.
- Verify that administrative or sensitive endpoints cannot be accessed by unauthenticated callers.

### 7. Abuse Prevention & Rate Limiting
- Evaluate public-facing endpoints (e.g., lead generation, partner applications) for spam submission or brute-force risks.
- Identify whether rate-limiting, CAPTCHA, or honeypot safeguards are present or warranted.

### 8. Headers & Configuration
- Check `next.config.ts` for security configurations, headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy), and allowed image domains.
- Review dependencies for known critical vulnerabilities (`npm audit` when applicable).

---

## Finding Structure & Severity Scale

Every finding must include:
- **Severity**:
  - **Critical**: Direct remote execution, auth bypass, or unauthenticated access to sensitive user data.
  - **High**: Severe vulnerability (e.g., secret leakage, injection vector, broken access control).
  - **Medium**: Meaningful security risk (e.g., missing input bounds, excessive error disclosure, unthrottled public endpoint).
  - **Low**: Minor security hardening observation or missing defense-in-depth header.
  - **Informational**: Architectural observation or security best-practice note.
- **Confidence**: High, Medium, or Low (certainty based on code evidence).
- **Location**: Exact file path and line numbers (e.g., [`src/app/api/leads/route.ts:L15-L35`](file:///d:/Persional-projects/landing/src/app/api/leads/route.ts#L15-L35)).
- **Evidence**: What the code currently does.
- **Risk**: What could happen, the threat scenario, and under what conditions.
- **Smallest Reasonable Recommendation**: The most targeted, surgical fix to mitigate the risk.
- **Further Verification Required**: Yes/No (and what to test dynamically if needed).

---

## Audit Report Template

```markdown
### Security Audit Report

#### Executive Summary
- **Scope Audited**: [Files, routes, or entire application]
- **Overall Security Posture**: [Strong / Good / Needs Targeted Hardening / At Risk]
- **Findings Summary**: [Critical: X | High: Y | Medium: Z | Low: W | Info: V]

---

#### Detailed Findings

##### [<SEVERITY>] <Finding Title>
- **Location**: [`path/to/file:L10-L45`](file:///path/to/file#L10-L45)
- **Category**: [Route Handlers / Input Validation / Secrets / Injection / Auth / Rate Limiting / Headers]
- **Confidence**: [High / Medium / Low]
- **Evidence**: [Concrete code observation]
- **Risk & Threat Scenario**: [What could occur and under what conditions]
- **Smallest Reasonable Recommendation**: [Targeted, surgical mitigation]
- **Further Verification Required**: [Yes/No - detail any manual/dynamic tests needed]

---

#### Positive Security Controls Noted
- [List verified existing defenses, e.g., "Secrets properly kept out of client bundles", "Safe JSON-LD encoding"]

---

#### Prioritized Remediation Plan
1. [Immediate / high-priority remediation item]
2. [Secondary hardening item]

#### Next Steps
- Awaiting user review and authorization before proposing or implementing any security fixes.
```
